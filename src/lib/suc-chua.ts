import { SUC_CHUA_MAC_DINH } from "./constants";
import type { SoLieuDangKy } from "./sheets";

/**
 * Sức chứa sự kiện: còn chỗ hay đã đầy, quyết định từ SỐ EMAIL KHÁC NHAU trong
 * Google Sheet (tab register).
 *
 * Nguồn đếm là Sheet theo yêu cầu của khách. Con số chặn là SỐ QR ĐÃ GỬI RA —
 * khách chốt trong feedback 24/07/2026: "unique email => 1 QR" và "ngưng nhận
 * đơn khi đã có 500 QR được gửi ra". Một email chỉ bao giờ có một mã (xem
 * `existingCheckinCode` trong route), nên số email khác nhau chính là số QR.
 *
 * Ba hệ quả đã biết và chấp nhận:
 *
 *  0. Số dòng ops đếm bằng mắt trên Sheet LỚN HƠN số chỗ đã dùng khi có mẹ gửi
 *     lại form. Đó là chủ ý: mẹ sửa số điện thoại rồi gửi lại không được phép
 *     ăn thêm một ghế trong 500.
 *  1. KHÔNG nguyên tử. Dòng Sheet chỉ được append ở CUỐI route (sau Supabase), nên
 *     hai mẹ submit trong cùng một nhịp đều đọc ra cùng một con số và cùng đi
 *     qua — sự kiện có thể nhận dôi vài chỗ quanh mốc 500. Bản cũ đếm-và-ghi
 *     trong một transaction Postgres nên không hở; đổi nguồn đếm là mất tính đó.
 *     Vì thế `choConLai` phải kẹp ở 0, không bao giờ trả số âm.
 *  2. Lượt ghi Sheet hỏng thì mẹ đó đăng ký thành công nhưng KHÔNG được đếm —
 *     ghế của mẹ vẫn bán tiếp cho người sau. Route log cảnh báo `sheets` khi việc
 *     đó xảy ra.
 *
 * Tách khỏi `sheets.ts` và `route.ts` để test được toàn bộ phần quyết định mà
 * không cần gọi Google — repo chạy vitest ở env `node`, không có mạng trong test.
 */

/**
 * Giới hạn chỗ đang áp dụng.
 *
 * `raw` truyền vào chứ không đọc thẳng `process.env` bên trong: test cần thử
 * từng giá trị mà không phải ghi đè biến môi trường toàn cục. Route gọi
 * `sucChua()` không tham số và lấy đúng env.
 *
 * Mọi giá trị không phải số nguyên dương đều rơi về mặc định — xem test để biết
 * vì sao NaN ở đây là lỗi im lặng chứ không phải lỗi ồn ào.
 */
export function sucChua(raw: string | undefined = process.env.EVENT_CAPACITY): number {
  const s = raw?.trim();
  // Chặn "5.5" / "1e3" / "500 mẹ": parseInt nuốt phần đuôi và trả về số sai.
  // Chỉ nhận chuỗi TOÀN chữ số.
  if (!s || !/^\d+$/.test(s)) return SUC_CHUA_MAC_DINH;
  const n = Number.parseInt(s, 10);
  return n > 0 ? n : SUC_CHUA_MAC_DINH;
}

/**
 * Cờ đóng đăng ký thủ công (`DANG_KY_DA_DAY`): bật là coi như ĐÃ ĐỦ CHỖ, bất kể
 * Sheet đang đếm ra bao nhiêu.
 *
 * Tồn tại vì việc ngưng nhận đơn là một QUYẾT ĐỊNH của khách, không phải hệ quả
 * của con số: khách chốt "đủ rồi, đóng đi" trong khi Sheet mới có 480 dòng thì
 * không có cách nào diễn đạt điều đó bằng `EVENT_CAPACITY` mà không nói dối về
 * giới hạn (hạ xuống 480 là câu từ chối đọc thành "sự kiện đã đủ 480 mẹ").
 *
 * Là biến môi trường chứ không phải hằng trong code: ops bật/tắt trên Vercel,
 * áp dụng ngay, không cần deploy lại — và mở lại cũng nhanh như đóng.
 *
 * CHỈ nhận "1"/"true". KHÔNG dùng `Boolean(process.env.X)`: mọi giá trị env đều
 * là chuỗi, nên `"0"` và `"false"` — đúng hai thứ ops gõ vào để TẮT — đều là
 * truthy và sẽ đóng đăng ký thay vì mở.
 */
export function daDayThuCong(
  raw: string | undefined = process.env.DANG_KY_DA_DAY,
): boolean {
  const s = raw?.trim().toLowerCase();
  return s === "1" || s === "true";
}

export type KetQuaSucChua =
  /** Còn chỗ, email chưa có trong Sheet. */
  | "moi"
  /** Email đã có dòng trong Sheet — mẹ này đang giữ chỗ của chính mẹ. */
  | "da_dang_ky"
  /** Đã đủ số chỗ: route trả 409, mẹ KHÔNG được gửi email xác nhận. */
  | "het_cho"
  /** Đọc Sheet hỏng — fail open. */
  | "loi"
  /** Chưa cấu hình Google Sheets (dev): không có gì để đếm. */
  | "khong_cau_hinh";

/**
 * Số QR đã gửi ra = số email khác nhau trong tab register. Một email chỉ có một
 * mã, nên hai con số này luôn là một.
 */
export function soQRDaGui(soLieu: SoLieuDangKy): number {
  return soLieu.emails.size;
}

/**
 * `soLieu` đọc từ tab register (xem `soLieuTuCotSheet`).
 *
 * Chặn theo SỐ QR ĐÃ GỬI, tức số email khác nhau — luật khách chốt 24/07/2026.
 * Mẹ gửi lại form sinh thêm dòng trong Sheet nhưng không sinh thêm mã QR, nên
 * không được tính thêm một chỗ.
 *
 * Email đã đăng ký LUÔN đi tiếp, kể cả khi đã đủ 500: mẹ này đang giữ chỗ của
 * chính mẹ — chặn ở đây là đuổi mẹ khỏi chỗ đó, chỉ vì mẹ bấm gửi lại form để
 * sửa số điện thoại.
 *
 * So sánh `>=` chứ không `>`: gửi đủ 500 QR là ĐÃ hết chỗ, mẹ tiếp theo là người
 * thứ 501.
 */
export function ketQuaSucChua(
  soLieu: SoLieuDangKy,
  email: string,
  gioiHan: number,
): KetQuaSucChua {
  if (soLieu.emails.has(email.trim().toLowerCase())) return "da_dang_ky";
  return soQRDaGui(soLieu) >= gioiHan ? "het_cho" : "moi";
}

/**
 * Số chỗ còn lại để hiện công khai trên trang ("Còn N/500 chỗ").
 *
 * Kẹp ở 0: cổng chặn không nguyên tử (xem doc đầu file) nên số QR có thể vượt
 * giới hạn vài cái quanh mốc cuối, và "Còn -3 chỗ" là thứ không được phép xuất
 * hiện trước mặt mẹ.
 */
export function choConLai(soLieu: SoLieuDangKy, gioiHan: number): number {
  return Math.max(0, gioiHan - soQRDaGui(soLieu));
}
