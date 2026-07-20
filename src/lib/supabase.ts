import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { thangTuoiTuNgaySinh, type Registration } from "./validation";

/**
 * Structured registration store + check-in ledger. Brevo remains the source of
 * truth for contacts; this table is the queryable operational record that
 * powers /check-in and /admin. Accessed server-side only, with the service
 * role key — clients never touch Supabase, so no RLS is needed.
 */
export type RegistrationRow = {
  id: string;
  created_at: string;
  checkin_code: string;
  ho_ten: string;
  email: string;
  sdt: string;
  facebook: string | null;
  tinh_thanh: string;
  trang_thai: "mang_thai" | "da_sinh";
  thai_tuan: number | null;
  ten_be: string | null;
  /** Dạng "YYYY-MM-DD" — cột `date` của Postgres, không có phần giờ. */
  be_ngay_sinh: string | null;
  be_gioi_tinh: "nam" | "nu" | null;
  /** DẪN XUẤT từ be_ngay_sinh lúc ghi. Nguồn sự thật là be_ngay_sinh. */
  be_thang_tuoi: number | null;
  chu_de_quan_tam: string[];
  /**
   * Nullable vì migration `add column` không đặt được NOT NULL trên bảng đã có
   * dòng test. Mọi lượt ghi MỚI luôn có giá trị (schema bắt buộc); null chỉ có
   * thể là dòng test cũ trước migration. Chỗ hiển thị phải tự phòng.
   */
  nguon_biet_den: string | null;
  di_cung_chong: boolean;
  dong_y_nhan_tin: boolean;
  nguon: string;
  checked_in: boolean;
  checked_in_at: string | null;
  checked_in_source: "qr" | "admin" | null;
};

/** Waitlist app: chỉ email + consent. Không có gì để check-in. */
export type WaitlistRow = {
  id: string;
  created_at: string;
  email: string;
  dong_y_nhan_tin: boolean;
};

let client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY chưa được cấu hình");
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Registration → hàng DB. Tách khỏi `insertRegistration` để test được toàn bộ
 * phép ánh xạ mà không cần Supabase thật.
 *
 * `moc` truyền vào chứ không gọi `new Date()` bên trong — test cần mốc cố định,
 * và `be_thang_tuoi` phải là ảnh chụp tại thời điểm đăng ký.
 *
 * Không trả về cột check-in (checked_in / checked_in_at / checked_in_source):
 * `insertRegistration` upsert nguyên payload của hàm này, và upsert chỉ update
 * cột được gửi — nếu hàm này trả kèm cột check-in, một lần submit lại sẽ xoá
 * mất check-in đã ghi trước đó.
 */
export function registrationToRow(
  data: Registration,
  code: string,
  moc: Date,
): Omit<RegistrationRow, "id" | "created_at" | "checked_in" | "checked_in_at" | "checked_in_source"> {
  const daSinh = data.trangThai === "da_sinh";
  return {
    checkin_code: code,
    ho_ten: data.hoTen,
    email: data.email,
    sdt: data.sdt,
    facebook: data.facebook || null,
    tinh_thanh: data.tinhThanh,
    trang_thai: data.trangThai,
    thai_tuan: data.trangThai === "mang_thai" ? data.thaiTuan : null,
    ten_be: daSinh ? data.tenBe : null,
    // toISOString rồi cắt 10 ký tự: cột Postgres là `date`, gửi kèm giờ sẽ bị
    // ép kiểu theo múi giờ server và có thể lùi một ngày.
    be_ngay_sinh: daSinh ? data.beNgaySinh.toISOString().slice(0, 10) : null,
    be_gioi_tinh: daSinh ? data.beGioiTinh : null,
    be_thang_tuoi: daSinh ? thangTuoiTuNgaySinh(data.beNgaySinh, moc) : null,
    chu_de_quan_tam: data.chuDeQuanTam,
    nguon_biet_den: data.nguonBietDen,
    di_cung_chong: data.diCungChong,
    dong_y_nhan_tin: data.dongYNhanTin,
    nguon: data.nguon,
  };
}

/**
 * Upsert on email so a mother who submits the form twice stays ONE row.
 */
export async function insertRegistration(data: Registration, code: string): Promise<void> {
  const { error } = await db()
    .from("registrations")
    .upsert(registrationToRow(data, code, new Date()), { onConflict: "email" });
  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
}

export async function findByCode(code: string): Promise<RegistrationRow | null> {
  const { data, error } = await db()
    .from("registrations")
    .select("*")
    .eq("checkin_code", code)
    .maybeSingle();
  if (error) throw new Error(`Supabase findByCode failed: ${error.message}`);
  return (data as RegistrationRow | null) ?? null;
}

export type CheckinResult =
  | { status: "ok"; name: string; time: string }
  | { status: "already"; name: string; time: string }
  | { status: "not_found" };

/**
 * Atomic, idempotent check-in. The `.eq("checked_in", false)` guard makes the
 * UPDATE affect the row only on the first scan; a second scan updates nothing,
 * and we return the original time.
 */
export async function checkinByCode(code: string): Promise<CheckinResult> {
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from("registrations")
    .update({ checked_in: true, checked_in_at: now, checked_in_source: "qr" })
    .eq("checkin_code", code)
    .eq("checked_in", false)
    .select("ho_ten, checked_in_at");
  if (error) throw new Error(`Supabase checkin failed: ${error.message}`);

  if (data && data.length > 0) {
    return {
      status: "ok",
      name: data[0].ho_ten as string,
      time: data[0].checked_in_at as string,
    };
  }
  // No row updated: either already checked in, or the code doesn't exist.
  const row = await findByCode(code);
  if (!row) return { status: "not_found" };
  return { status: "already", name: row.ho_ten, time: row.checked_in_at ?? now };
}

export async function listRegistrations(): Promise<RegistrationRow[]> {
  const { data, error } = await db()
    .from("registrations")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Supabase list failed: ${error.message}`);
  return (data as RegistrationRow[]) ?? [];
}

export async function adminUpdateCheckin(
  id: string,
  checkedIn: boolean,
  checkedInAt: string | null,
): Promise<RegistrationRow> {
  const { data, error } = await db()
    .from("registrations")
    .update({
      checked_in: checkedIn,
      checked_in_at: checkedIn ? (checkedInAt ?? new Date().toISOString()) : null,
      checked_in_source: checkedIn ? "admin" : null,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`Supabase adminUpdateCheckin failed: ${error.message}`);
  return data as RegistrationRow;
}

/**
 * Upsert theo email: mẹ bấm "Nhận tin" hai lần vẫn là MỘT dòng, khớp cách
 * `insertRegistration` xử lý trùng.
 */
export async function insertWaitlist(email: string, dongY: boolean): Promise<void> {
  const { error } = await db()
    .from("waitlist")
    .upsert({ email, dong_y_nhan_tin: dongY }, { onConflict: "email" });
  if (error) throw new Error(`Supabase waitlist insert failed: ${error.message}`);
}

export async function listWaitlist(): Promise<WaitlistRow[]> {
  const { data, error } = await db()
    .from("waitlist")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Supabase waitlist list failed: ${error.message}`);
  return (data as WaitlistRow[]) ?? [];
}
