/**
 * Danh mục chỗ điền được phép trong email gửi hàng loạt, và phép kiểm chúng.
 *
 * File này CỐ Ý không import gì từ `mail.ts`. `mail.ts` kéo theo nodemailer và
 * qrcode (thuần server); import nó vào một component "use client" là gãy build —
 * cùng lý do `mau-email.ts` được tách ra khỏi `mail.ts`. Màn hình soạn mail phải
 * cảnh báo chỗ điền sai ngay lúc admin gõ, nên phép kiểm phải sống được ở client.
 *
 * Phép THAY thật nằm ở `mail-hang-loat.ts` (server-only, cần khung HTML của
 * mail.ts). Hai nơi đọc chung `CHO_DIEN` nên không bao giờ lệch danh mục.
 */
export const CHO_DIEN = ["ten", "ma"] as const;

export type ChoDien = (typeof CHO_DIEN)[number];

/** Bắt MỌI cụm `{{...}}`, kể cả rỗng và có khoảng trắng — để báo đúng cái sai. */
const MOI_CHO_DIEN = /\{\{([^}]*)\}\}/g;

/**
 * Những chỗ điền KHÔNG hợp lệ trong `s`. Trả token NGUYÊN VĂN (kèm dấu ngoặc)
 * để thông báo lỗi chỉ đúng thứ admin đã gõ, chứ không bắt họ tự dò.
 *
 * Mảng rỗng nghĩa là sạch.
 */
export function choDienLa(s: string): string[] {
  const la: string[] = [];

  // Tìm cụm `{{...}}` không hợp lệ (tên chỗ điền sai).
  for (const m of s.matchAll(MOI_CHO_DIEN)) {
    if (!(CHO_DIEN as readonly string[]).includes(m[1])) la.push(m[0]);
  }

  // Loại bỏ TẤT CẢ cụm `{{...}}` hoàn chỉnh (đúng lẫn sai), rồi kiểm stray braces.
  // Nếu để `{{ten}` hoặc `{ten}}` qua, regex thay thế ở task 2 cũng không khớp,
  // 500 email sẽ mang chữ `{{ten}` nguyên si — lỗi không sửa được.
  // CHỈ báo {{ hoặc }} từng đôi — các { hay } riêng lẻ là prose thường (CSS, JSON,
  // emoticon), không phải lỗi. Báo chúng sẽ khiến admin bỏ qua cảnh báo và bỏ lỡ
  // cái typo `{{ten}` thật — mục đích của hàm sẽ bị phá hoại.
  const cleaned = s.replace(/\{\{[^}]*\}\}/g, "");

  // Tìm {{ hoặc }} trong chuỗi "sạch", bỏ qua { hay } riêng lẻ.
  let i = 0;
  while (i < cleaned.length) {
    if (cleaned[i] === "{" && i + 1 < cleaned.length && cleaned[i + 1] === "{") {
      la.push("{{");
      i += 2;
    } else if (cleaned[i] === "}" && i + 1 < cleaned.length && cleaned[i + 1] === "}") {
      la.push("}}");
      i += 2;
    } else {
      i += 1;
    }
  }

  return la;
}
