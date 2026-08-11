import { NextResponse } from "next/server";
import {
  existingCheckinCode,
  sendEventEmail,
  sendWaitlistEmail,
} from "@/lib/mail";
import {
  appendRegistration,
  appendWaitlist,
  docSoLieuDangKy,
  sheetsConfigured,
} from "@/lib/sheets";
import { insertRegistration, insertWaitlist, supabaseConfigured } from "@/lib/supabase";
import {
  choConLai,
  daDayThuCong,
  ketQuaSucChua,
  sucChua,
  type KetQuaSucChua,
} from "@/lib/suc-chua";
import type { SoLieuDangKy } from "@/lib/sheets";
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

// Ba dịch vụ ngoài chạy tuần tự trong request này — Supabase, SMTP, Sheets —
// cùng chia sẻ ngân sách thời gian dưới đây. Bị nền tảng giết giữa
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
  // Tra lỗi → sinh mã mới: xấu nhất là quay lại hành vi cũ cho đúng lượt này,
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
  // Đứng TRƯỚC cả cổng sức chứa và lượt ghi Supabase, cùng một lý do: đặt sau thì mẹ đã cầm
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
  // PHẢI đứng TRƯỚC lượt ghi Supabase. Đặt sau thì mẹ đã nhận email xác nhận kèm mã QR rồi
  // mới bị báo hết chỗ — không rút lại được.
  //
  // Đếm từ Google Sheet (tab register) theo yêu cầu của khách: ops nhìn Sheet
  // nên con số chặn phải là đúng con số ops nhìn thấy. Đánh đổi đã biết — xem
  // doc đầu suc-chua.ts: không nguyên tử như bản đếm trong transaction Postgres,
  // hai mẹ submit cùng nhịp có thể cùng lọt qua mốc cuối.
  //
  // Chỉ áp cho đăng ký sự kiện; waitlist app không giới hạn số lượng.
  const gioiHan = sucChua();

  // Ops đóng đăng ký thủ công (`DANG_KY_DA_DAY`). Đứng TRƯỚC lượt đọc Sheet: đây
  // là quyết định của khách, không phụ thuộc con số đếm được — và mỗi đơn bị từ
  // chối cũng khỏi tốn một lượt gọi Google.
  //
  // Khác cổng đếm bên dưới ở đúng một điểm: KHÔNG có ngoại lệ cho email đã đăng
  // ký. Ngoại lệ đó tồn tại để mẹ đang giữ chỗ vẫn sửa được thông tin của mình;
  // khi đăng ký đã đóng hẳn thì không đơn nào được nhận nữa, kể cả đơn sửa.
  if (isRegistration(data) && daDayThuCong()) {
    return NextResponse.json(
      { error: HET_CHO.tieuDe(gioiHan), full: true, gioiHan },
      { status: 409 },
    );
  }

  /**
   * Số liệu đọc được ở cổng chặn, giữ lại tới cuối route để tính `conLai` trả về
   * cho client. `null` = không đọc được (chưa cấu hình Sheets, hoặc Google lỗi):
   * khi đó response không kèm `conLai`, vì đoán một con số còn tệ hơn không nói.
   */
  let soLieu: SoLieuDangKy | null = null;

  if (isRegistration(data)) {
    // Chưa cấu hình Sheets (dev) thì không có gì để đếm — cho đi tiếp.
    let ket: KetQuaSucChua = "khong_cau_hinh";
    if (sheetsConfigured()) {
      try {
        soLieu = await docSoLieuDangKy();
        ket = ketQuaSucChua(soLieu, data.email, gioiHan);
      } catch (err) {
        console.error("[dang-ky] đếm chỗ trên Sheet thất bại:", data.email, err);
        soLieu = null;
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

  // Supabase GIỮ bản ghi thành viên. Hỏng ở đây thì lượt đăng ký THẬT SỰ không
  // xảy ra — trả lỗi thật thay vì một lời an ủi.
  //
  // TRƯỚC ĐÂY VAI TRÒ NÀY LÀ CỦA BREVO, và ghi Supabase chỉ là non-fatal. Brevo
  // đã bị gỡ khỏi dự án, nên Supabase là nơi DUY NHẤT còn giữ dữ liệu này —
  // để nó non-fatal nghĩa là mẹ điền form, thấy màn hình thành công, mà không
  // có bản ghi nào ở đâu cả, và mã check-in vừa cấp thì không ai tra lại được.
  // `existingCheckinCode` cũng đọc từ đúng bảng này, nên một lượt ghi hụt sẽ
  // khiến lần đăng ký sau cấp mã MỚI và giết tấm QR đã gửi.
  //
  // Hỏng ở đây thì cổng chặn sức chứa bên trên không phải dọn gì: ghế chỉ thực
  // sự bị chiếm khi dòng Sheet được append ở cuối route, mà tới đó thì không còn.
  //
  // Thiếu cấu hình Supabase cũng là lỗi, không phải lý do để bỏ qua — không có
  // kho thì không có đăng ký.
  if (!supabaseConfigured()) {
    console.error("[dang-ky] Supabase chưa được cấu hình — không thể ghi nhận đăng ký");
    return NextResponse.json(
      { error: "Không thể hoàn tất đăng ký. Vui lòng thử lại sau ít phút." },
      { status: 502 },
    );
  }
  try {
    if (isRegistration(data)) {
      // Upsert theo email nên mẹ gửi lại form chỉ làm mới đúng dòng cũ.
      await insertRegistration(data, checkinCode!);
    } else {
      await insertWaitlist(data.email, data.dongYNhanTin);
    }
  } catch (err) {
    console.error("[dang-ky] Supabase insert failed:", data.email, err);
    return NextResponse.json(
      { error: "Không thể hoàn tất đăng ký. Vui lòng thử lại sau ít phút." },
      { status: 502 },
    );
  }

  // Qua điểm này mẹ ĐÃ đăng ký. Không gì bên dưới được phép làm hỏng request của
  // mẹ — mẹ sẽ phải điền lại form để sửa một vấn đề hoàn toàn của chúng ta.

  try {
    if (isRegistration(data)) {
      await sendEventEmail(data, checkinCode!);
    } else {
      await sendWaitlistEmail(data);
    }
  } catch (err) {
    console.error("[dang-ky] Email failed:", err);
    warnings.push("email");
  }

  // Bản mirror thô cho ops. Cố tình KHÔNG phụ thuộc kết quả của Supabase ở
  // trên: lý do tồn tại của bản sao thứ hai là dự phòng, nối tiếp thì Supabase
  // sập sẽ kéo mất luôn dòng Sheet, đúng lúc nó có giá trị nhất.
  //  - Đăng ký sự kiện → tab "register".
  //  - Waitlist app    → tab "waitlist".
  let daGhiSheet = false;
  if (sheetsConfigured()) {
    try {
      if (isRegistration(data)) {
        await appendRegistration(data, checkinCode!);
      } else {
        await appendWaitlist(data.email, data.dongYNhanTin);
      }
      daGhiSheet = true;
    } catch (err) {
      console.error("[dang-ky] Sheets append failed:", data.email, err);
      warnings.push("sheets");
    }
  }

  /**
   * Số chỗ còn lại SAU lượt đăng ký này, để widget "Còn N/500 chỗ" trên trang
   * cập nhật ngay mà mẹ không phải tải lại.
   *
   * Tính ở đây chứ không để client gọi lại `/api/cho-trong`: endpoint đó có bộ
   * nhớ tạm 30 giây, gọi ngay sau khi submit sẽ nhận đúng con số cũ.
   *
   * Cộng email vào chính tập vừa đọc rồi đếm lại, thay vì trừ tay đi một: `Set`
   * bỏ qua giá trị trùng, nên mẹ gửi lại form tự động KHÔNG bị trừ thêm chỗ —
   * đúng luật "một email một QR" mà không cần nhánh if riêng.
   *
   * Chỉ cộng khi dòng Sheet ghi thành công: ghi hỏng thì mẹ không được đếm ở lần
   * đọc sau (xem doc `suc-chua.ts`), nên trừ ở đây là nói sai.
   */
  let conLai: number | undefined;
  if (soLieu) {
    if (daGhiSheet) soLieu.emails.add(data.email.trim().toLowerCase());
    conLai = choConLai(soLieu, gioiHan);
  }

  return NextResponse.json({ ok: true, code: checkinCode, warnings, gioiHan, conLai });
}
