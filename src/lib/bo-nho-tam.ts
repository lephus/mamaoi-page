/**
 * Bộ nhớ tạm theo thời gian cho một phép nạp tốn kém.
 *
 * Sinh ra cho con số "còn N chỗ" hiện trên landing: trang đó là trang tĩnh mà ai
 * cũng mở, còn con số thì phải đọc Google Sheet. Không có lớp này thì mỗi lượt
 * xem trang là một lần gọi Google — chậm cho mẹ và đụng hạn ngạch API đúng vào
 * ngày mở đăng ký.
 *
 * Nhớ chính PROMISE chứ không phải giá trị đã xong (cùng thủ pháp với
 * `ensureHeader` trong sheets.ts): hàng trăm lượt mở trang trong cùng một nhịp
 * sẽ cùng chờ MỘT lần đọc, thay vì mỗi lượt bắn một lần đọc riêng vì lần đầu
 * chưa kịp xong.
 *
 * Bộ nhớ nằm trong tiến trình, nên mỗi instance serverless giữ bản riêng — con
 * số có thể lệch nhau tối đa một cửa sổ TTL giữa hai instance. Chấp nhận được:
 * đây là con số khích lệ trên trang, còn cổng chặn đăng ký thật thì luôn đọc
 * Sheet trực tiếp trong `/api/dang-ky`.
 */
export function boNhoTamTheoThoiGian<T>(
  nap: () => Promise<T>,
  ttlMs: number,
  /** Tiêm được để test không phải chờ thật hết TTL. */
  now: () => number = Date.now,
): () => Promise<T> {
  let nho: { luc: number; ket: Promise<T> } | null = null;

  return () => {
    if (nho && now() - nho.luc < ttlMs) return nho.ket;

    // Quên ngay khi hỏng, để lần gọi sau thử lại. Nhớ cả thất bại thì một cú
    // Google 503 nhất thời khoá con số suốt cả cửa sổ TTL.
    const ket = nap().catch((err) => {
      nho = null;
      throw err;
    });
    nho = { luc: now(), ket };
    return ket;
  };
}
