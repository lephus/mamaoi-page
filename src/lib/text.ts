/**
 * Chuẩn hoá chuỗi tiếng Việt để so khớp khi tìm kiếm.
 *
 * Mẹ gõ trên điện thoại, một tay, đang bế bé — không ai bỏ dấu đúng để tìm
 * "TP. Hồ Chí Minh". Gõ "ho chi minh" phải ra.
 *
 * NFD tách nguyên âm khỏi dấu thanh/dấu mũ rồi xoá dải dấu kết hợp
 * (U+0300–U+036F): "ồ" → "o" + dấu huyền + dấu mũ → "o".
 *
 * `đ` KHÔNG đi theo đường đó: nó là một code point riêng (U+0111), NFD không
 * tách được, nên phải thay tay — thiếu bước này thì "dak lak" không tìm ra
 * "Đắk Lắk". Thay SAU toLowerCase để chỉ phải xử lý một dạng chữ.
 */
export function boDau(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d");
}
