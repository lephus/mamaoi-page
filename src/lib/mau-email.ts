/**
 * Danh mục mẫu email — tách riêng khỏi `brevo.ts` để CLIENT import được.
 *
 * `brevo.ts` kéo theo qrcode và đọc BREVO_API_KEY (thuần server); import nó vào một
 * component "use client" là gãy build. Ở đây chỉ có type và nhãn hiển thị.
 */
export type MauEmail = "xacNhan" | "capLai" | "suCo";

/** Thứ tự hiện trên dropdown /admin/gui-mail — hai mẫu xử lý sự cố lên trước. */
export const MAU_THU_TU: MauEmail[] = ["capLai", "suCo", "xacNhan"];

/**
 * Dữ liệu ví dụ cho bản xem trước KHI CHƯA chọn mẹ nào.
 *
 * Có nó thì dropdown "Mẫu email" sống ngay từ lúc mở trang: người dùng đọc được
 * câu chữ từng mẫu trước, rồi mới đi tìm mẹ — đúng thứ tự người ta nghĩ. Khung
 * xem trước phải gắn nhãn rõ đây là bản mẫu, không ai được nhầm là sắp gửi thật.
 */
export const VI_DU = { hoTen: "Nguyễn Thị Lan", code: "MO-ABC234" } as const;

export const NHAN_MAU: Record<MauEmail, string> = {
  capLai: "Ấn nhầm check-in — cấp lại mã QR",
  suCo: "Có mã nhưng chưa nhận mail — sự cố kỹ thuật",
  xacNhan: "Đăng ký thành công (mail gốc landing page gửi)",
};
