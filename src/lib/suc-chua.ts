import { SUC_CHUA_MAC_DINH } from "./constants";

/**
 * Sức chứa sự kiện: còn chỗ hay đã đầy, quyết định từ SỐ EMAIL trong Google
 * Sheet (tab register).
 *
 * Nguồn đếm là Sheet theo yêu cầu của khách — ops nhìn Sheet nên con số chặn
 * phải là đúng con số ops nhìn thấy. Hai hệ quả đã biết và chấp nhận:
 *
 *  1. KHÔNG nguyên tử. Dòng Sheet chỉ được append ở CUỐI route (sau Brevo), nên
 *     hai mẹ submit trong cùng một nhịp đều đọc ra cùng một con số và cùng đi
 *     qua — sự kiện có thể nhận dôi vài chỗ quanh mốc 500. Bản cũ đếm-và-ghi
 *     trong một transaction Postgres nên không hở; đổi nguồn đếm là mất tính đó.
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
 * `emails` là tập email đã có trong Sheet (xem `emailsTuCotSheet`).
 *
 * Email đã đăng ký LUÔN đi tiếp, kể cả khi đã đủ 500: mẹ này không chiếm thêm
 * ghế nào — chặn ở đây là đuổi mẹ khỏi chỗ mẹ đang giữ, chỉ vì mẹ bấm gửi lại
 * form để sửa số điện thoại.
 *
 * So sánh `>=` chứ không `>`: đủ 500 email trong Sheet là ĐÃ hết chỗ, mẹ tiếp
 * theo là người thứ 501.
 */
export function ketQuaSucChua(
  emails: Set<string>,
  email: string,
  gioiHan: number,
): KetQuaSucChua {
  if (emails.has(email.trim().toLowerCase())) return "da_dang_ky";
  return emails.size >= gioiHan ? "het_cho" : "moi";
}
