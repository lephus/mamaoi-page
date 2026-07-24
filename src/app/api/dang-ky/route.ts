import { NextResponse } from "next/server";
import {
  existingCheckinCode,
  sendEventEmail,
  sendWaitlistEmail,
  upsertContact,
} from "@/lib/brevo";
import {
  appendRegistration,
  appendWaitlist,
  docSoLieuDangKy,
  sheetsConfigured,
} from "@/lib/sheets";
import { insertRegistration, insertWaitlist, supabaseConfigured } from "@/lib/supabase";
import { ketQuaSucChua, sucChua, type KetQuaSucChua } from "@/lib/suc-chua";
import { daDongDangKy } from "@/lib/countdown";
import { DA_DONG, HET_CHO } from "@/lib/constants";
import {
  chungSchema,
  generateCheckinCode,
  isRegistration,
  registrationSchema,
  waitlistSchema,
  type Submission,
} from "@/lib/validation";

// Bốn dịch vụ ngoài chạy tuần tự trong request này — Brevo, SMTP, Supabase,
// Sheets — cùng chia sẻ ngân sách thời gian dưới đây. Bị nền tảng giết giữa
// chừng sẽ báo thất bại cho một lượt đăng ký thực ra đã thành công.
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  // The two forms carry different shapes; `nguon` says which one this is.
  const nguon = (body as { nguon?: string })?.nguon;
  const schema = nguon === "app-waitlist" ? waitlistSchema : registrationSchema;
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    const thu = (issues: { path: PropertyKey[]; message: string }[]) => {
      for (const issue of issues) {
        const key = String(issue.path[0] ?? "form");
        // Không form nào có field tên `nguon` — nó không bao giờ render, nên
        // bỏ qua thay vì để lọt chuỗi literal-mismatch tiếng Anh của Zod vào
        // một payload lỗi mà mọi chỗ khác đều tiếng Việt.
        if (key === "nguon") continue;
        fieldErrors[key] ??= issue.message;
      }
    };
    thu(parsed.error.issues);

    // Union short-circuit ở discriminator: khi `trangThai` sai, Zod KHÔNG kiểm
    // một field chung nào. Chạy thêm schema field chung để mẹ thấy hết chỗ
    // thiếu trong MỘT lần, thay vì sửa một lỗi rồi submit lại mới lộ ra sáu.
    if (schema === registrationSchema) {
      const chung = chungSchema.safeParse(body);
      if (!chung.success) thu(chung.error.issues);
    }

    return NextResponse.json(
      { error: "Vui lòng kiểm tra lại thông tin", fieldErrors },
      { status: 400 },
    );
  }

  const data = parsed.data as Submission;

  // Honeypot. Answer 200 so the bot believes it won and does not retry.
  if (data.website) {
    return NextResponse.json({ ok: true });
  }

  // Mã check-in: nếu email đã đăng ký sự kiện trước đó thì DÙNG LẠI mã cũ để mã
  // của một email không bao giờ đổi (QR/email cũ vẫn quét được, hết lỗi "không
  // tìm thấy mã" do upsert-theo-email ghi đè mã). Chỉ sinh mã mới ở lần đầu. Tra
  // Brevo lỗi → sinh mã mới: xấu nhất là quay lại hành vi cũ cho đúng lượt này,
  // chứ không chặn mẹ đăng ký.
  let checkinCode: string | undefined;
  if (isRegistration(data)) {
    let reused: string | null = null;
    try {
      reused = await existingCheckinCode(data.email);
    } catch (err) {
      console.error("[dang-ky] existingCheckinCode failed:", data.email, err);
    }
    checkinCode = reused ?? generateCheckinCode();
  }

  const warnings: string[] = [];

  // ---------- Cổng chặn hết hạn ----------
  //
  // Nút xám ở client là chặn CÁI NÚT, không phải việc đăng ký: một tab mở sẵn từ
  // hôm trước, một đồng hồ máy chạy chậm, hay một cú curl đều gửi được sau hạn —
  // và vẫn nhận email xác nhận kèm mã QR cho sự kiện đã xong.
  //
  // Đứng TRƯỚC cả cổng sức chứa và Brevo, cùng một lý do: đặt sau thì mẹ đã cầm
  // email xác nhận rồi mới bị báo là muộn.
  //
  // Waitlist app không có hạn — chỉ đăng ký sự kiện mới đóng.
  if (isRegistration(data) && daDongDangKy(Date.now())) {
    return NextResponse.json(
      { error: DA_DONG.tieuDe, closed: true },
      { status: 409 },
    );
  }

  // ---------- Cổng chặn sức chứa ----------
  //
  // PHẢI đứng TRƯỚC Brevo. Đặt sau thì mẹ đã nhận email xác nhận kèm mã QR rồi
  // mới bị báo hết chỗ — không rút lại được.
  //
  // Đếm từ Google Sheet (tab register) theo yêu cầu của khách: ops nhìn Sheet
  // nên con số chặn phải là đúng con số ops nhìn thấy. Đánh đổi đã biết — xem
  // doc đầu suc-chua.ts: không nguyên tử như bản đếm trong transaction Postgres,
  // hai mẹ submit cùng nhịp có thể cùng lọt qua mốc cuối.
  //
  // Chỉ áp cho đăng ký sự kiện; waitlist app không giới hạn số lượng.
  const gioiHan = sucChua();

  if (isRegistration(data)) {
    // Chưa cấu hình Sheets (dev) thì không có gì để đếm — cho đi tiếp.
    let ket: KetQuaSucChua = "khong_cau_hinh";
    if (sheetsConfigured()) {
      try {
        ket = ketQuaSucChua(await docSoLieuDangKy(), data.email, gioiHan);
      } catch (err) {
        console.error("[dang-ky] đếm chỗ trên Sheet thất bại:", data.email, err);
        ket = "loi";
      }
    }

    if (ket === "het_cho") {
      return NextResponse.json(
        { error: HET_CHO.tieuDe(gioiHan), full: true, gioiHan },
        { status: 409 },
      );
    }

    // Cảnh báo RIÊNG, không gộp vào "sheets": ở đây nghĩa là lượt đăng ký này đi
    // qua mà KHÔNG đối chiếu được sức chứa (fail open) — không đọc được Sheet là
    // sự cố của mình, không phải lỗi của mẹ. Khác hẳn với việc ghi dòng hỏng.
    if (ket === "loi") warnings.push("suc-chua");
  }

  // Brevo holds the member record. If this fails, the registration genuinely
  // did not happen — surface a real error rather than a comforting lie.
  //
  // Brevo hỏng ở đây thì cổng chặn ở trên không phải dọn gì: ghế chỉ thực sự bị
  // chiếm khi dòng Sheet được append ở cuối route, mà tới đó thì không còn.
  try {
    await upsertContact(data, checkinCode);
  } catch (err) {
    console.error("[dang-ky] Brevo contact failed:", err);
    return NextResponse.json(
      { error: "Không thể hoàn tất đăng ký. Vui lòng thử lại sau ít phút." },
      { status: 502 },
    );
  }

  // Past this point she IS registered. Nothing below may fail her request —
  // she would be refilling the form to fix a problem that is entirely ours.

  try {
    if (isRegistration(data)) {
      await sendEventEmail(data, checkinCode!);
    } else {
      await sendWaitlistEmail(data);
    }
  } catch (err) {
    // Most likely cause: no verified sender in Brevo yet.
    console.error("[dang-ky] Email failed:", err);
    warnings.push("email");
  }

  // Bản ghi có cấu trúc cho /check-in + /admin.
  //  - Đăng ký sự kiện → bảng `registrations` (có mã check-in, thông tin bé).
  //  - Waitlist app    → bảng `waitlist` (chỉ email + consent).
  // Hai bảng RIÊNG, không gộp: gộp thì phải nới NOT NULL của ho_ten/sdt/
  // tinh_thanh/checkin_code, tức gỡ luôn lưới an toàn của đăng ký sự kiện thật.
  //
  // Non-fatal ở CẢ HAI nhánh: mẹ đã đăng ký xong ở Brevo rồi. Lỗi ở đây chỉ
  // log thật to để ops back-fill từ Brevo.
  if (supabaseConfigured()) {
    try {
      if (isRegistration(data)) {
        // Upsert theo email nên mẹ gửi lại form chỉ làm mới đúng dòng cũ.
        await insertRegistration(data, checkinCode!);
      } else {
        await insertWaitlist(data.email, data.dongYNhanTin);
      }
    } catch (err) {
      console.error("[dang-ky] Supabase insert failed:", data.email, err);
      warnings.push("supabase");
    }
  }

  // Bản mirror thô cho ops. Cố tình KHÔNG phụ thuộc kết quả của Supabase ở
  // trên: lý do tồn tại của bản sao thứ hai là dự phòng, nối tiếp thì Supabase
  // sập sẽ kéo mất luôn dòng Sheet, đúng lúc nó có giá trị nhất.
  //  - Đăng ký sự kiện → tab "register".
  //  - Waitlist app    → tab "waitlist".
  if (sheetsConfigured()) {
    try {
      if (isRegistration(data)) {
        await appendRegistration(data, checkinCode!);
      } else {
        await appendWaitlist(data.email, data.dongYNhanTin);
      }
    } catch (err) {
      console.error("[dang-ky] Sheets append failed:", data.email, err);
      warnings.push("sheets");
    }
  }

  return NextResponse.json({ ok: true, code: checkinCode, warnings });
}
