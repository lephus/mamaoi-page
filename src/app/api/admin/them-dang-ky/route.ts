import { isAdmin } from "@/lib/admin-auth";
import {
  existingCheckinCode,
  guiEmailTheoMau,
  upsertContactThuCong,
} from "@/lib/brevo";
import { thuCongSchema, thuCongToRow } from "@/lib/dang-ky-thu-cong";
import { appendRegistrationThuCong, sheetsConfigured } from "@/lib/sheets";
import { findByEmail, insertRegistrationThuCong } from "@/lib/supabase";
import { generateCheckinCode } from "@/lib/validation";

/**
 * Tạo MỘT đăng ký sự kiện từ `/admin/them-dang-ky`, khi ops chỉ có email + họ tên.
 *
 * Vì sao là route riêng chứ không phải một cờ trên `/api/dang-ky`: route kia là
 * endpoint CÔNG KHAI, và một tham số làm nó bỏ qua validation lẫn cổng sức chứa
 * là thứ chỉ cần lộ một lần là hỏng cả sự kiện.
 *
 * KHÔNG kiểm hạn đăng ký, KHÔNG kiểm sức chứa 500. Công cụ này sinh ra đúng để
 * xử lý ngoại lệ — ops thêm mẹ thứ 501, hay thêm sau ngày đóng đăng ký, là quyết
 * định có chủ ý của ban tổ chức chứ không phải tai nạn cần chặn.
 *
 * Bốn dịch vụ ngoài chạy tuần tự (Brevo, Supabase, SMTP, Sheets) — cùng lý do
 * `/api/dang-ky` phải nới ngân sách thời gian.
 */
export const maxDuration = 60;

/**
 * Câu lỗi gốc, để UI in ra cạnh thông báo thân thiện.
 *
 * Route này CHỈ admin gọi được, nên lộ chi tiết kỹ thuật ở đây không phải rủi ro
 * — mà là thứ duy nhất phân biệt được "Supabase sập" với "chưa chạy file SQL
 * nới `trang_thai`". Thiếu nó, ops chỉ thấy một chữ 502 và phải đi tìm người
 * biết đọc log server. Cùng cách `/api/admin/gui-mail` trả lỗi SMTP nguyên văn.
 */
function chiTiet(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const parsed = thuCongSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return Response.json(
      { error: "Vui lòng kiểm tra lại thông tin", fieldErrors },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // ---------- Cổng chặn trùng ----------
  //
  // TỪ CHỐI, không ghi đè. `insertRegistration` sẵn có upsert theo email; nếu
  // đường này dùng nó thì ops gõ trùng một email đã đăng ký đầy đủ sẽ biến SĐT
  // và tỉnh/thành THẬT của mẹ thành "--" — mất im lặng, không có đường lấy lại.
  //
  // Trả kèm mã cũ để ops làm tiếp được ngay: cái họ cần gần như luôn là gửi lại
  // email cho mã đó, ở /admin/gui-mail.
  let daCo;
  try {
    daCo = await findByEmail(data.email);
  } catch (err) {
    console.error("[admin/them-dang-ky] findByEmail failed:", data.email, err);
    return Response.json(
      { error: "Không đọc được dữ liệu đăng ký. Vui lòng thử lại." },
      { status: 502 },
    );
  }
  if (daCo) {
    return Response.json(
      {
        error: `Email này đã có đăng ký (mã ${daCo.checkin_code}). Vào "Gửi lại email QR" nếu cần gửi lại mã cho mẹ.`,
        trung: true,
        code: daCo.checkin_code,
        hoTen: daCo.ho_ten,
      },
      { status: 409 },
    );
  }

  // Mã cũ của email này (nếu có) được DÙNG LẠI — giữ mã của một email cố định
  // thì mọi QR đã gửi trước đó còn quét được. Đúng ca mà tính năng này hay gặp
  // nhất: mẹ có contact ở Brevo kèm mã, nhưng dòng Supabase bị mất do sự cố.
  // Tra hỏng thì sinh mã mới — xấu nhất là quay lại hành vi cũ, chứ không chặn ops.
  let reused: string | null = null;
  try {
    reused = await existingCheckinCode(data.email);
  } catch (err) {
    console.error("[admin/them-dang-ky] existingCheckinCode failed:", data.email, err);
  }
  const code = reused ?? generateCheckinCode();

  const nguoiNhan = { email: data.email, hoTen: data.hoTen };

  // Brevo giữ MA_CHECKIN — nguồn mà `existingCheckinCode` đọc để cố định mã của
  // một email. Ghi hỏng ở đây thì lần sau mẹ tự đăng ký bằng email này sẽ được
  // cấp mã MỚI và tấm QR ta sắp gửi chết, nên phải dừng hẳn.
  try {
    // `sdt` chỉ đi kèm khi ops thực sự nhập — chuỗi rỗng bị bỏ qua trong
    // `upsertContactThuCong`, không được biến thành "--" trong CRM.
    await upsertContactThuCong(
      { ...nguoiNhan, sdt: data.sdt, dongYNhanTin: data.dongYNhanTin },
      code,
    );
  } catch (err) {
    console.error("[admin/them-dang-ky] Brevo contact failed:", data.email, err);
    return Response.json(
      {
        error: "Không ghi được contact lên Brevo. Chưa tạo gì cả, thử lại sau ít phút.",
        chiTiet: chiTiet(err),
      },
      { status: 502 },
    );
  }

  const hang = thuCongToRow(data, code);

  // Supabase BẮT BUỘC thành công — khác `/api/dang-ky`, nơi đây chỉ là cảnh báo.
  // Ở đó có một mẹ đang chờ trước màn hình và lượt submit của mẹ đáng được cứu;
  // ở đây không có ai chờ, mà `findByCode` đọc từ chính bảng này: thiếu dòng
  // nghĩa là QR quét vào báo "không tìm thấy mã".
  //
  // Bấm lại an toàn: Brevo đã giữ mã, nên lần thử sau dùng lại ĐÚNG mã đó.
  try {
    await insertRegistrationThuCong(hang);
  } catch (err) {
    console.error("[admin/them-dang-ky] Supabase insert failed:", data.email, err);
    return Response.json(
      {
        error:
          "Không lưu được vào cơ sở dữ liệu — chưa gửi email cho mẹ. Bấm tạo lại (mã đã được giữ nguyên).",
        chiTiet: chiTiet(err),
      },
      { status: 502 },
    );
  }

  // Từ đây trở xuống mẹ ĐÃ có chỗ. Không bước nào được phép làm hỏng kết quả đó.
  const warnings: string[] = [];

  // Gửi email đứng SAU lượt ghi Supabase, không bao giờ trước: không được đưa mẹ
  // một tấm QR trước khi biết chắc nó quét được.
  if (data.guiEmail) {
    try {
      await guiEmailTheoMau("xacNhan", nguoiNhan, code);
    } catch (err) {
      console.error("[admin/them-dang-ky] Email failed:", data.email, err);
      warnings.push("email");
    }
  }

  // Bản mirror cho ops, và cũng là nơi đếm sức chứa (số email khác nhau ở tab
  // register) — nên mẹ tạo tay chiếm một chỗ trong 500 y như đăng ký thật.
  // Dùng lại ĐÚNG object `hang` đã ghi xuống Supabase, không dựng lại lần hai.
  if (sheetsConfigured()) {
    try {
      await appendRegistrationThuCong(hang);
    } catch (err) {
      console.error("[admin/them-dang-ky] Sheets append failed:", data.email, err);
      warnings.push("sheets");
    }
  }

  // Trả kèm `sdt` ĐÃ CHUẨN HOÁ (bỏ khoảng trắng/dấu chấm) chứ không phải chuỗi
  // ops gõ: nhập "090 123 4567" mà bảng lưu "0901234567" thì ops phải thấy đúng
  // cái đã lưu, không phải cái mình vừa gõ.
  return Response.json({ ok: true, code, warnings, ...nguoiNhan, sdt: data.sdt });
}
