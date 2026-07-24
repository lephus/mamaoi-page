/**
 * Kho số chỗ còn lại dùng chung cho cả trang.
 *
 * Có hai nguồn ghi vào đây, và chúng KHÔNG ngang hàng:
 *
 *  - `datTuServer` — lượt đọc `/api/cho-trong` lúc mở trang. Endpoint đó có bộ
 *    nhớ tạm 30 giây nên con số có thể cũ tới nửa phút.
 *  - `datSauDangKy` — con số đi kèm response của `/api/dang-ky`, tính ngay tại
 *    thời điểm dòng Sheet được ghi. Đây là con số MỚI NHẤT có thể có.
 *
 * Vì thế số sau đăng ký luôn thắng: mẹ submit trên mạng chậm thì lượt đọc lúc
 * mở trang có thể về sau khi đăng ký xong, và widget sẽ nhảy ngược lên nếu để
 * nó đè.
 *
 * Nằm ở `lib` chứ không nằm trong component vì đây là phần duy nhất có logic
 * thật (thứ tự ghi đè) — ở đây thì test được mà không cần dựng DOM.
 */

export type SoCho = { gioiHan: number; conLai: number | null };

let soCho: SoCho | null = null;
/** Đã có số từ đăng ký chưa — cờ chặn lượt đọc về muộn ghi đè. */
let coSoSauDangKy = false;
const nguoiNghe = new Set<() => void>();

function bao(): void {
  for (const f of nguoiNghe) f();
}

/**
 * Trả về CHÍNH tham chiếu đang giữ, không dựng object mới.
 * `useSyncExternalStore` so sánh snapshot bằng `Object.is` sau mỗi lần render —
 * object mới mỗi lượt gọi là render vô tận.
 */
export function docKho(): SoCho | null {
  return soCho;
}

export function theoDoiKho(fn: () => void): () => void {
  nguoiNghe.add(fn);
  return () => void nguoiNghe.delete(fn);
}

/** Số đọc lúc mở trang. Nhường chỗ nếu đã có số mới hơn từ lượt đăng ký. */
export function datTuServer(so: SoCho): void {
  if (coSoSauDangKy) return;
  soCho = so;
  bao();
}

/** Số đi kèm response đăng ký — luôn thắng. */
export function datSauDangKy(so: SoCho): void {
  coSoSauDangKy = true;
  soCho = so;
  bao();
}

/** Chỉ dùng trong test: trả kho về trạng thái chưa biết gì. */
export function datLaiKho(): void {
  soCho = null;
  coSoSauDangKy = false;
  nguoiNghe.clear();
}
