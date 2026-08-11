/**
 * Tách chuỗi admin dán thành danh sách địa chỉ email.
 *
 * Không import gì, cùng ranh giới `cho-dien.ts` và `dinh-kem.ts` đang giữ: client
 * cần hàm này để bật/tắt nút "Gửi thử" ngay lúc admin gõ, server cần đúng nó để
 * quyết định. Một bộ luật, hai nơi đọc.
 */

/**
 * Cùng biểu thức route vẫn dùng cho địa chỉ đơn. Cố tình LỎNG: việc ở đây là bắt
 * lỗi gõ nhầm nhìn thấy được ("thieu-a-cong"), không phải phán một địa chỉ có
 * tồn tại hay không — chỉ máy chủ nhận mới trả lời được câu đó.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Phẩy, chấm phẩy, xuống dòng, khoảng trắng — admin dán từ Excel, Zalo, ô To của Gmail. */
const NGAN_CACH = /[\s,;]+/;

export function tachEmail(s: string): { hopLe: string[]; sai: string[] } {
  const hopLe: string[] = [];
  const sai: string[] = [];
  const daThayHopLe = new Set<string>();
  const daThaySai = new Set<string>();

  for (const tho of s.split(NGAN_CACH)) {
    const mot = tho.trim();
    if (!mot) continue;

    if (!EMAIL_RE.test(mot)) {
      // Giữ NGUYÊN VĂN thứ admin gõ để họ dò lại được trong ô nhập, đúng cách
      // `choDienLa` trả token nguyên văn.
      if (!daThaySai.has(mot)) {
        daThaySai.add(mot);
        sai.push(mot);
      }
      continue;
    }

    // Bỏ trùng không phân biệt hoa thường: "A@x.vn" và "a@x.vn" là MỘT hộp thư,
    // gửi hai bản là người ta nhận hai email giống hệt nhau.
    const khoa = mot.toLowerCase();
    if (daThayHopLe.has(khoa)) continue;
    daThayHopLe.add(khoa);
    hopLe.push(mot);
  }

  return { hopLe, sai };
}
