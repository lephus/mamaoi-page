import { isAdmin } from "@/lib/admin-auth";
import { guiHangLoat, type BanGuiMot } from "@/lib/brevo";
import { choDienLa } from "@/lib/cho-dien";
import { dungEmail } from "@/lib/mail-hang-loat";
import { listRegistrations, type RegistrationRow } from "@/lib/supabase";

/**
 * Gửi email hàng loạt cho mẹ đăng ký sự kiện — nội dung do admin gõ tay.
 *
 * KHÁC HẲN `/api/admin/gui-mail`: cái kia gửi MẪU CỐ ĐỊNH đã duyệt câu chữ cho
 * MỘT mẹ theo mã. Cái này gửi chữ gõ tay cho HÀNG TRĂM mẹ. Hai mức rủi ro khác
 * nhau nên tách route, đừng gộp.
 *
 * Ba chế độ, phân biệt bằng THAM SỐ BẮT BUỘC KHÁC NHAU chứ không chỉ bằng một
 * cờ — để một lượt "thu" không thể vô tình biến thành lượt bắn 500 email.
 */
// Một lượt gọi Brevo mang 500 bản riêng cần thời gian thật.
export const maxDuration = 60;

const TOI_DA_TIEU_DE = 200;
const TOI_DA_NOI_DUNG = 5000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const loi = (text: string, status: number) =>
  Response.json({ error: text }, { status });

/** Dòng DB → một bản gửi. Địa chỉ nhận truyền riêng vì chế độ "thu" đổi nó. */
function banGui(row: RegistrationRow, toiEmail: string, tieuDe: string, noiDung: string): BanGuiMot {
  const { subject, html } = dungEmail(tieuDe, noiDung, row);
  return { email: toiEmail, hoTen: row.ho_ten, subject, html };
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return loi("Chưa đăng nhập", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return loi("Dữ liệu không hợp lệ", 400);
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const che_do = b.che_do;
  if (che_do !== "xem" && che_do !== "thu" && che_do !== "that") {
    return loi("Chế độ không hợp lệ", 400);
  }

  const tieuDe = typeof b.tieuDe === "string" ? b.tieuDe.trim() : "";
  const noiDung = typeof b.noiDung === "string" ? b.noiDung.trim() : "";
  if (!tieuDe || !noiDung) return loi("Thiếu tiêu đề hoặc nội dung", 400);
  if (tieuDe.length > TOI_DA_TIEU_DE) return loi(`Tiêu đề quá ${TOI_DA_TIEU_DE} ký tự`, 400);
  if (noiDung.length > TOI_DA_NOI_DUNG) return loi(`Nội dung quá ${TOI_DA_NOI_DUNG} ký tự`, 400);

  // Chặn chỗ điền lạ TRƯỚC mọi thứ khác: đây là lỗi duy nhất mà admin không
  // thấy được cho tới khi mẹ mở email ra.
  const la = [...choDienLa(tieuDe), ...choDienLa(noiDung)];
  if (la.length > 0) {
    return loi(`Chỗ điền không hợp lệ: ${la.join(", ")}. Chỉ dùng {{ten}} và {{ma}}.`, 400);
  }

  let rows: RegistrationRow[];
  try {
    rows = await listRegistrations();
  } catch (err) {
    console.error("[admin/gui-mail-hang-loat] đọc DB hỏng:", err);
    return loi("Không đọc được danh sách đăng ký", 502);
  }

  // ---------- xem trước / gửi thử: cần một mẹ làm dữ liệu mẫu ----------
  if (che_do === "xem" || che_do === "thu") {
    const idMau = typeof b.idMau === "string" ? b.idMau : "";
    if (!idMau) return loi("Thiếu mẹ làm mẫu", 400);
    const mau = rows.find((r) => r.id === idMau);
    if (!mau) return loi("Không tìm thấy mẹ làm mẫu", 404);

    if (che_do === "xem") {
      const { subject, html } = dungEmail(tieuDe, noiDung, mau);
      return Response.json({ ok: true, subject, html });
    }

    const toiEmail = typeof b.toiEmail === "string" ? b.toiEmail.trim() : "";
    if (!EMAIL_RE.test(toiEmail)) return loi("Địa chỉ nhận thử không hợp lệ", 400);

    // Có dấu vết cho lượt gửi thử: đây là đường DUY NHẤT của route này chấp
    // nhận địa chỉ do client khai (spec §7), nên nó phải để lại log.
    console.log("[admin/gui-mail-hang-loat] gửi thử tới:", toiEmail);
    try {
      await guiHangLoat([banGui(mau, toiEmail, tieuDe, noiDung)]);
    } catch (err) {
      console.error("[admin/gui-mail-hang-loat] gửi thử hỏng:", err);
      return loi(err instanceof Error ? err.message : "Gửi thử thất bại", 502);
    }
    return Response.json({ ok: true, daGui: 1 });
  }

  // ---------- gửi thật ----------
  const ids = b.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((i) => typeof i !== "string")) {
    return loi("Thiếu danh sách người nhận", 400);
  }
  // Cổng chặn cốt lõi: admin phải GÕ đúng số người nhận. Một cú bấm nhầm không
  // vượt qua được cái này, vì nó đòi cả danh sách id lẫn con số khớp.
  if (b.xacNhanSoLuong !== ids.length) {
    return loi(`Số xác nhận không khớp — cần đúng ${ids.length}`, 400);
  }

  const muon = new Set(ids as string[]);
  const nhan = rows.filter((r) => muon.has(r.id));
  // Lệch nghĩa là client và DB không cùng một danh sách — con số admin vừa gõ
  // không còn nghĩa như họ tưởng. Dừng thay vì gửi cho một tập khác.
  if (nhan.length !== ids.length) {
    return loi("Danh sách người nhận đã thay đổi. Tải lại trang rồi chọn lại.", 400);
  }

  try {
    // Địa chỉ lấy từ `r.email` của DB, KHÔNG từ client — cùng nguyên tắc
    // /api/admin/export: client chỉ được nói "gửi cho id nào".
    const daGui = await guiHangLoat(
      nhan.map((r) => banGui(r, r.email, tieuDe, noiDung)),
    );
    return Response.json({ ok: true, daGui });
  } catch (err) {
    console.error("[admin/gui-mail-hang-loat] gửi hỏng:", err);
    return loi(err instanceof Error ? err.message : "Gửi email thất bại", 502);
  }
}
