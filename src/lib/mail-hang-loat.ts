import { escapeHtml, FOOTNOTE_BTC, P, shell } from "./brevo";
import { CHO_DIEN } from "./cho-dien";
import type { RegistrationRow } from "./supabase";

/**
 * Dựng nội dung email gửi hàng loạt. THUẦN — không gọi mạng, không đọc DB, nên
 * test được đủ ca. Việc GỬI nằm ở `guiHangLoat` trong brevo.ts.
 *
 * Server-only (import brevo.ts). Phần client cần dùng thì lấy ở `cho-dien.ts`.
 */

/** Chỉ hai cột này được dùng để thay chỗ điền — không nhận cả dòng để khỏi lỡ tay dùng thêm. */
export type MeNhan = Pick<RegistrationRow, "ho_ten" | "checkin_code">;

function giaTri(row: MeNhan): Record<string, string> {
  return { ten: row.ho_ten, ma: row.checkin_code };
}

/**
 * Thay `{{ten}}` / `{{ma}}` bằng `bien`. Chỗ điền lạ giữ NGUYÊN VĂN thay vì
 * thành chuỗi rỗng: route đã chặn chúng từ trước (`choDienLa`), nên tới được
 * đây nghĩa là cổng chặn hỏng — và lúc đó `{{name}}` hiện ra trong email thử là
 * cách nhanh nhất để ai đó thấy, còn nuốt thành rỗng thì không ai biết.
 */
function thay(s: string, bien: Record<string, string>): string {
  return s.replace(/\{\{([^}]*)\}\}/g, (nguyenVan, ten: string) =>
    ten in bien ? bien[ten] : nguyenVan,
  );
}

/**
 * Chữ admin gõ → HTML an toàn.
 *
 * THỨ TỰ Ở ĐÂY LÀ VẤN ĐỀ BẢO MẬT, đừng đảo:
 *  1. escape chữ admin gõ TRƯỚC — spec chốt không cho gõ HTML thô, nên
 *     `<script>` phải ra chữ chứ không ra thẻ;
 *  2. xuống dòng đơn thành `<br>`;
 *  3. RỒI mới thay chỗ điền, bằng giá trị đã escape riêng.
 *
 * `{{ten}}` không chứa ký tự đặc biệt nên nó sống sót nguyên vẹn qua bước 1;
 * còn mẹ tên "Trần & Lê" thì dấu `&` được escape đúng ở bước 3.
 */
function thanThanhHtml(noiDung: string, row: MeNhan): string {
  const v = giaTri(row);
  const bien = Object.fromEntries(CHO_DIEN.map((k) => [k, escapeHtml(v[k])]));
  return noiDung
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((doan) => doan.trim())
    .filter(Boolean)
    .map(
      (doan) => `<p ${P}>${thay(escapeHtml(doan).replace(/\n/g, "<br>"), bien)}</p>`,
    )
    .join("\n");
}

/**
 * Tiêu đề + HTML đã sẵn sàng gửi cho MỘT mẹ.
 *
 * Trả `{ subject, html }` để khớp `noiDungEmail` ngay cạnh và khớp đúng tên
 * trường của payload Brevo — bớt một lần đổi tên ở route.
 *
 * Tiêu đề KHÔNG escape: nó là chuỗi thường, không phải HTML. Escape ở đây làm
 * mẹ nhận email tiêu đề "Chào chị Trần &amp; Lê".
 *
 * `null` ở tham số chữ ký nghĩa là KHÔNG ký tên — khác hẳn bỏ trống, vốn rơi về
 * mặc định "Đội ngũ Mama Ơi". Nội dung ở đây do admin gõ tay nên lời kết là
 * việc của họ; một chữ ký đóng cứng bên dưới sẽ đá nhau với lời kết họ vừa
 * viết. Hai mẫu cố định `capLai` / `suCo` trong brevo.ts KHÔNG đổi — chúng vẫn
 * ký tên BTC đúng câu chữ đã duyệt.
 */
export function dungEmail(
  tieuDe: string,
  noiDung: string,
  row: MeNhan,
): { subject: string; html: string } {
  return {
    subject: thay(tieuDe, giaTri(row)),
    html: shell(thanThanhHtml(noiDung, row), FOOTNOTE_BTC, null),
  };
}
