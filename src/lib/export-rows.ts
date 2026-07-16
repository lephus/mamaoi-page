import type { RegistrationRow } from "./supabase";
import { formatCheckinTime } from "./time";

/**
 * 15 cột = toàn bộ RegistrationRow trừ `id` (khoá nội bộ, vô nghĩa với ops).
 * Thứ tự cột này là thứ tự cột trong file Excel — đổi ở đây là đổi file.
 */
const HEADERS = [
  "Họ tên",
  "Email",
  "SĐT",
  "Facebook",
  "Tỉnh/Thành",
  "Tình trạng",
  "Bé (tháng tuổi)",
  "Đi cùng chồng",
  "Đồng ý nhận tin",
  "Mã check-in",
  "Nguồn đăng ký",
  "Thời điểm đăng ký",
  "Đã check-in",
  "Giờ check-in",
  "Nguồn check-in",
] as const;

const yesNo = (v: boolean) => (v ? "Có" : "—");

/**
 * Hàm thuần: RegistrationRow[] → header + ô dữ liệu. Mọi giá trị rỗng thành ""
 * (không phải null) để exceljs không ghi ra chữ "null" trong file.
 */
export function rowsToSheet(rows: RegistrationRow[]): {
  headers: string[];
  rows: (string | number)[][];
} {
  return {
    headers: [...HEADERS],
    rows: rows.map((r) => [
      r.ho_ten,
      r.email,
      r.sdt,
      r.facebook ?? "",
      r.tinh_thanh,
      r.trang_thai === "mang_thai" ? "Mang thai" : "Đã sinh",
      r.be_thang_tuoi ?? "",
      yesNo(r.di_cung_chong),
      yesNo(r.dong_y_nhan_tin),
      r.checkin_code,
      r.nguon,
      formatCheckinTime(r.created_at),
      yesNo(r.checked_in),
      r.checked_in_at ? formatCheckinTime(r.checked_in_at) : "",
      r.checked_in_source ?? "",
    ]),
  };
}
