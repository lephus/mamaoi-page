import { isAdmin } from "@/lib/admin-auth";
import { guiEmailTheoMau } from "@/lib/mail";
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
 * Ba dịch vụ ngoài chạy tuần tự (Supabase, SMTP, Sheets) — cùng lý do
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

  // Mã MỚI, không tra lại mã cũ.
  //
  // Trước đây đoạn này gọi `existingCheckinCode` để dùng lại mã mẹ đã có ở
  // Brevo khi dòng Supabase bị mất do sự cố. Brevo đã bị gỡ khỏi dự án, và
  // `existingCheckinCode` nay đọc từ CHÍNH bảng mà cổng chặn trùng bên trên vừa
  // tra — tới được đây nghĩa là chắc chắn không có dòng nào, nên nó luôn trả
  // null. Giữ lại chỉ là một lượt gọi DB thừa và một lời hứa không còn thật.
  const code = generateCheckinCode();

  const nguoiNhan = { email: data.email, hoTen: data.hoTen };

  const hang = thuCongToRow(data, code);

  // Supabase BẮT BUỘC thành công. Nó vừa là nơi `findByCode` đọc khi quét QR,
  // vừa là nơi `existingCheckinCode` đọc để cố định mã của một email — Brevo đã
  // bị gỡ khỏi dự án nên không còn bản sao thứ hai nào giữ MA_CHECKIN nữa.
  // Thiếu dòng ở đây nghĩa là QR quét vào báo "không tìm thấy mã", VÀ lần sau mẹ
  // tự đăng ký bằng email này sẽ được cấp mã MỚI làm tấm QR vừa gửi chết.
  //
  // Bấm lại an toàn: chưa ghi được thì cũng chưa gửi email nào, và lượt sau sinh
  // mã mới cho một email chưa từng có dòng nào — không giẫm lên gì cả.
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
