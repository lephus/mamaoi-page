import { rowsToSheet } from "./export-rows";
import type { RegistrationRow } from "./supabase";
import type { Registration } from "./validation";

/**
 * Bản mirror thô cho ops: mỗi lượt đăng ký append một dòng vào Google Sheet,
 * độc lập với Supabase. Supabase vẫn là kho chính của /admin và /check-in;
 * Sheet chỉ để ops mở link ra xem nhanh.
 *
 * Append thuần tuý — không bao giờ sửa dòng cũ. Hệ quả đã chấp nhận: mẹ submit
 * hai lần thì Sheet có hai dòng, và Sheet không bao giờ biết ai đã check-in.
 * Số liệu chính thức lấy ở /admin → Xuất Excel.
 */

/**
 * Dựng RegistrationRow rồi đưa qua `rowsToSheet` để lấy đúng 15 ô theo đúng
 * thứ tự cột của file .xlsx. Không tự viết mảy cột ở đây: thứ tự cột chỉ được
 * phép tồn tại một chỗ, là HEADERS trong export-rows.ts.
 */
export function registrationToSheetRow(
  data: Registration,
  code: string,
): (string | number)[] {
  const row: RegistrationRow = {
    id: "", // rowsToSheet không xuất id — giá trị này không bao giờ được đọc
    created_at: new Date().toISOString(), // giờ server, lệch vài ms so với Postgres
    checkin_code: code,
    ho_ten: data.hoTen,
    email: data.email,
    sdt: data.sdt,
    facebook: data.facebook || null,
    tinh_thanh: data.tinhThanh,
    trang_thai: data.trangThai,
    be_thang_tuoi:
      data.trangThai === "da_sinh" && data.beThangTuoi !== undefined
        ? data.beThangTuoi
        : null,
    di_cung_chong: data.diCungChong,
    dong_y_nhan_tin: data.dongYNhanTin,
    nguon: data.nguon,
    // Sheet chụp lại thời điểm đăng ký, không theo dõi check-in.
    checked_in: false,
    checked_in_at: null,
    checked_in_source: null,
  };
  return rowsToSheet([row]).rows[0];
}
