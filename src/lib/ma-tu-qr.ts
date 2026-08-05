import { isValidCheckinCode } from "./validation";

/**
 * Text đọc được từ một mã QR → mã check-in, hoặc `null`.
 *
 * QR trong email chứa CẢ URL (`checkinUrl` trong checkin-url.ts), không phải mã
 * trần — nên phải rút đoạn cuối đường dẫn ra. Vẫn nhận mã trần, phòng QR do nơi
 * khác sinh hoặc nhân viên gõ tay.
 *
 * Trả `null` cho mọi thứ còn lại, và ĐÓ MỚI LÀ VIỆC CHÍNH của hàm này: ở quầy,
 * camera quét trúng QR wifi, QR Momo, QR trên tờ rơi liên tục. Chặn ngay tại
 * đây thì màn hình quét không phải bắn request rác, và không phải nhấp nháy báo
 * lỗi mỗi khung hình.
 *
 * Tách khỏi component vì nó THUẦN — test được đầy đủ mà không cần camera, mà
 * camera thì không unit test được.
 */
export function maTuQr(text: string): string | null {
  const s = text.trim();
  if (!s) return null;

  // Thử đọc như URL trước. Mã trần "MO-ABC234" không parse thành URL nên rơi
  // xuống nhánh catch và được thử tiếp như mã trần.
  //
  // Dùng `new URL` + tách pathname chứ KHÔNG dò chuỗi "/check-in/": một QR
  // chứa "https://mamaoi.vn/x?next=/check-in/MO-ABC234" cũng khớp phép dò đó,
  // và mã phải là ĐOẠN CUỐI đường dẫn thì mới đúng là link check-in.
  let ungVien = s;
  try {
    const doan = new URL(s).pathname.split("/").filter(Boolean);
    if (doan.length < 2 || doan[doan.length - 2] !== "check-in") return null;
    ungVien = doan[doan.length - 1];
  } catch {
    // Không phải URL — để nguyên `ungVien = s` rồi thử như mã trần.
  }

  // KHÔNG kiểm tên miền, có chủ đích: mã mới là vé vào cửa, tên miền chỉ là
  // trang trí. Ai dựng được QR mang một mã THẬT thì đã biết mã đó, và đọc miệng
  // cho nhân viên gõ tay cũng ra kết quả y hệt — chặn tên miền không thêm được
  // lớp bảo vệ nào. Đổi lại, chặn nó sẽ làm QR sinh trên prod quét trên bản
  // preview (*.vercel.app) là hỏng, đúng lúc đang đi thử máy trước sự kiện.
  const ma = ungVien.toUpperCase();
  return isValidCheckinCode(ma) ? ma : null;
}
