import { SITE } from "./constants";

/**
 * Đích của QR check-in. Email (brevo) và QR trên trang admin BẮT BUỘC dùng chung
 * hàm này — ghép URL riêng ở hai nơi là mầm mống lỗi hai QR trỏ khác nhau, mà
 * cả hai đều trông đúng cho tới ngày sự kiện.
 */
export function checkinUrl(code: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? SITE.url;
  return `${base}/check-in/${code}`;
}
