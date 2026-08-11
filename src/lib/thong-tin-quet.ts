import type { RegistrationRow } from "./supabase";

/**
 * Những gì màn hình quét QR ở `/admin/quet-qr` được biết về một mẹ.
 *
 * Tách khỏi `supabase.ts` để component "use client" import được mà không kéo
 * theo `@supabase/supabase-js` — cùng lý do `mau-email.ts` được tách khỏi
 * `mail.ts`.
 *
 * CỐ TÌNH thiếu `email`, `sdt`, `facebook`. Thẻ xác nhận không cần chúng, và
 * màn hình này chạy trên điện thoại CÁ NHÂN của nhân viên thời vụ. Khác
 * `/api/admin/registrations` (trả full row cho bảng ops trên máy ops) một cách
 * có chủ ý — đừng "dọn cho nhất quán".
 */
export type ThongTinQuet = Pick<
  RegistrationRow,
  | "id"
  | "ho_ten"
  | "checkin_code"
  | "tinh_thanh"
  | "trang_thai"
  | "thai_tuan"
  | "be_thang_tuoi"
  | "di_cung_chong"
  | "checked_in"
  | "checked_in_at"
  | "checked_in_source"
>;

/** Rút đúng các trường trên khỏi một dòng đầy đủ. Một chỗ khai, không rải rác. */
export function rutGonChoQuet(row: RegistrationRow): ThongTinQuet {
  return {
    id: row.id,
    ho_ten: row.ho_ten,
    checkin_code: row.checkin_code,
    tinh_thanh: row.tinh_thanh,
    trang_thai: row.trang_thai,
    thai_tuan: row.thai_tuan,
    be_thang_tuoi: row.be_thang_tuoi,
    di_cung_chong: row.di_cung_chong,
    checked_in: row.checked_in,
    checked_in_at: row.checked_in_at,
    checked_in_source: row.checked_in_source,
  };
}
