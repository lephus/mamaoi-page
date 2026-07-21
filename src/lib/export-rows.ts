import { chuDeLabel, nguonBietDenLabel, trangThaiLabel } from "./constants";
import type { RegistrationRow, WaitlistRow } from "./supabase";
import { formatCheckinTime, ngayVN } from "./time";

/**
 * Tên bốn cột mà `sheets.ts` phải định vị theo tên khi cập nhật check-in vào
 * Sheet (tìm dòng theo "Mã check-in", ghi ba cột check-in). Khai một chỗ rồi
 * nhét vào HEADERS bên dưới: đổi tên cột ở đây là đổi cả HEADERS lẫn nơi ghi,
 * hai bên không bao giờ lệch tên.
 */
export const HEADER_CODE = "Mã check-in";
export const HEADER_DA_CHECKIN = "Đã check-in";
export const HEADER_GIO_CHECKIN = "Giờ check-in";
export const HEADER_NGUON_CHECKIN = "Nguồn check-in";

/**
 * 22 cột = toàn bộ RegistrationRow trừ `id` (khoá nội bộ, vô nghĩa với ops).
 * Thứ tự cột này là thứ tự cột trong file Excel VÀ trong Google Sheet — đổi ở
 * đây là đổi cả hai. `sheets.ts` cố tình đọc lại từ đây thay vì tự khai mảng.
 */
const HEADERS = [
  "Họ tên",
  "Email",
  "SĐT",
  "Facebook",
  "Thành phố",
  "Tình trạng",
  "Thai (tuần)",
  "Tên bé",
  "Ngày sinh bé",
  "Giới tính bé",
  "Bé (tháng tuổi)",
  "Chủ đề quan tâm",
  "Chủ đề khác",
  "Nguồn biết đến",
  "Đi cùng chồng",
  "Đồng ý nhận tin",
  HEADER_CODE,
  "Nguồn đăng ký",
  "Thời điểm đăng ký",
  HEADER_DA_CHECKIN,
  HEADER_GIO_CHECKIN,
  HEADER_NGUON_CHECKIN,
] as const;

const WAITLIST_HEADERS = ["Email", "Đồng ý nhận tin", "Thời điểm đăng ký"] as const;

const yesNo = (v: boolean) => (v ? "Có" : "—");

/**
 * Ba ô check-in (Đã check-in, Giờ check-in, Nguồn check-in) — MỘT phép định dạng
 * dùng chung cho cả file Excel (`rowsToSheet`) lẫn lượt cập nhật Sheet khi mẹ quét
 * QR (`markCheckedInInSheet` trong sheets.ts). Hai đường ghi tách rời sẽ trôi lệch
 * nhau, mà Sheet là nơi lệch đó khó phát hiện nhất — nên chỉ được có một chỗ.
 */
export function checkinCells(
  checkedIn: boolean,
  checkedInAt: string | null,
  source: string | null,
): [string, string, string] {
  return [
    yesNo(checkedIn),
    checkedInAt ? formatCheckinTime(checkedInAt) : "",
    source ?? "",
  ];
}

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
      trangThaiLabel(r.trang_thai),
      r.thai_tuan ?? "",
      r.ten_be ?? "",
      ngayVN(r.be_ngay_sinh),
      r.be_gioi_tinh === "nam" ? "Nam" : r.be_gioi_tinh === "nu" ? "Nữ" : "",
      r.be_thang_tuoi ?? "",
      r.chu_de_quan_tam.map(chuDeLabel).join(", "),
      r.chu_de_khac ?? "",
      r.nguon_biet_den ? nguonBietDenLabel(r.nguon_biet_den) : "",
      yesNo(r.di_cung_chong),
      yesNo(r.dong_y_nhan_tin),
      r.checkin_code,
      r.nguon,
      formatCheckinTime(r.created_at),
      ...checkinCells(r.checked_in, r.checked_in_at, r.checked_in_source),
    ]),
  };
}

/** Waitlist chỉ có ba cột — không có gì để check-in, không có thông tin bé. */
export function waitlistToSheet(rows: WaitlistRow[]): {
  headers: string[];
  rows: (string | number)[][];
} {
  return {
    headers: [...WAITLIST_HEADERS],
    rows: rows.map((r) => [
      r.email,
      yesNo(r.dong_y_nhan_tin),
      formatCheckinTime(r.created_at),
    ]),
  };
}
