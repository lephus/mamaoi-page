import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { thangTuoiTuNgaySinh, type Registration } from "./validation";

/**
 * Structured registration store + check-in ledger. THIS is the source of
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
  /**
   * `null` chỉ có ở dòng ops TẠO TAY từ /admin (khi chỉ có email + họ tên).
   * Mọi lượt đăng ký qua form đều có giá trị — schema bắt buộc. Chỗ hiển thị
   * phải đi qua `trangThaiLabel`, hàm này đã quy `null` thành "--".
   */
  trang_thai: "chuan_bi_mang_thai" | "ivf" | "mang_thai" | "da_sinh" | null;
  thai_tuan: number | null;
  ten_be: string | null;
  /** Dạng "YYYY-MM-DD" — cột `date` của Postgres, không có phần giờ. */
  be_ngay_sinh: string | null;
  be_gioi_tinh: "nam" | "nu" | null;
  /** DẪN XUẤT từ be_ngay_sinh lúc ghi. Nguồn sự thật là be_ngay_sinh. */
  be_thang_tuoi: number | null;
  chu_de_quan_tam: string[];
  /** Ô tự do kèm `chu_de_quan_tam`. Null khi mẹ để trống. */
  chu_de_khac: string | null;
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
  /**
   * Có nằm trong danh sách khách mời đã chốt hay không. `false` = ẩn khỏi MỌI
   * chỗ liệt kê (`listRegistrations`), nhưng vẫn tra được bằng mã
   * (`findByCode`) nên check-in QR không đổi hành vi.
   *
   * DB đặt `default true`, và KHÔNG đường ghi MỚI nào được gửi cột này lên — đó
   * là lý do nó nằm trong `RegistrationInsertRow` bên dưới, dùng ở
   * `registrationToRow` / `thuCongToRow` / `insertRegistrationThuCong` /
   * `hangDbToSheetRow` / `appendRegistrationThuCong`. Nhờ vậy dòng ops tạo tay
   * mặc định hiện, còn một mẹ đã ẩn gửi lại form thì upsert không bật cô ấy
   * hiện lại.
   *
   * NGOẠI LỆ DUY NHẤT: `adminCheckinPayload` bật `true` khi ops check-in hộ —
   * mẹ đã được cho vào cửa thì phải hiện trên /admin. Xem doc hàm đó.
   */
  duoc_moi: boolean;
};

/**
 * Hàng ghi MỚI của `registrations` — đủ cột trừ những cột DB tự đặt giá trị,
 * KHÔNG bao giờ do code gán: `id`/`created_at` (Postgres tự sinh lúc insert),
 * `checked_in`/`checked_in_at`/`checked_in_source` (chỉ đổi qua các hàm
 * check-in), và `duoc_moi` (default `true` của Postgres quyết định — xem chú
 * thích tại chỗ khai báo). Cùng một điểm khai báo cho năm chỗ dựng hàng ghi mới
 * (`registrationToRow`, `thuCongToRow`, `insertRegistrationThuCong`,
 * `hangDbToSheetRow`, `appendRegistrationThuCong`) nghĩa là đổi danh sách cột bị
 * loại trừ chỉ phải sửa một chỗ, và TypeScript chặn NGAY nếu một trong năm chỗ
 * đó lỡ tay gán `duoc_moi`.
 */
export type RegistrationInsertRow = Omit<
  RegistrationRow,
  "id" | "created_at" | "checked_in" | "checked_in_at" | "checked_in_source" | "duoc_moi"
>;

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
): RegistrationInsertRow {
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
    chu_de_khac: data.chuDeKhac || null,
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

/**
 * Dòng đăng ký của một email, hoặc null.
 *
 * Dùng bởi cổng chặn trùng của `/api/admin/them-dang-ky`: ops gõ một email đã
 * có đăng ký thì phải BỊ TỪ CHỐI kèm mã cũ, chứ không được ghi đè — đăng ký thật
 * của mẹ có SĐT và tỉnh/thành thật, ghi đè bằng bản tạo tay là biến chúng thành
 * "--" và không có đường lấy lại.
 *
 * Email đã được schema hạ về chữ thường trước khi tới đây.
 */
export async function findByEmail(email: string): Promise<RegistrationRow | null> {
  const { data, error } = await db()
    .from("registrations")
    .select("*")
    .eq("email", email)
    .maybeSingle();
  if (error) throw new Error(`Supabase findByEmail failed: ${error.message}`);
  return (data as RegistrationRow | null) ?? null;
}

/**
 * Ghi một dòng đăng ký ops tạo tay.
 *
 * `insert` THUẦN, không upsert — khác hẳn `insertRegistration` ở trên. Upsert ở
 * đây nghĩa là gõ trùng một email đã đăng ký sẽ ghi đè SĐT/tỉnh/thành thật của
 * mẹ thành "--". Cổng chặn trùng ở route đã bắt hầu hết; unique index trên
 * `email` là lưới cuối cho trường hợp hai tab admin bấm cùng lúc, và nó phải
 * NÉM LỖI chứ không âm thầm ghi đè.
 */
export async function insertRegistrationThuCong(row: RegistrationInsertRow): Promise<void> {
  const { error } = await db().from("registrations").insert(row);
  if (error) throw new Error(`Supabase insert (thủ công) failed: ${error.message}`);
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

/**
 * Danh sách đăng ký cho MỌI màn hình admin — bảng check-in, xuất Excel, gửi mail
 * hàng loạt, picker gửi lại QR.
 *
 * `.eq("duoc_moi", true)` là ĐIỂM NGHẼN DUY NHẤT thực thi danh sách khách mời.
 * Đặt ở đây thay vì ở từng nơi gọi là có chủ ý: năm chỗ tiêu thụ hàm này, và
 * quên lọc ở một chỗ nghĩa là một lượt gửi mail hàng loạt bay tới 486 người
 * không được mời — lỗi không thể thu hồi.
 *
 * Lọc ở SQL chứ không ở JS vì `/api/admin/registrations` poll mỗi 5 giây suốt
 * ngày sự kiện; lọc ở JS là kéo thừa 486 dòng PII mỗi nhịp.
 *
 * `findByCode` CỐ Ý không có mệnh đề này: mẹ ngoài danh sách quét QR ở quầy vẫn
 * phải check-in được. Xem spec 2026-08-06-an-dang-ky-ngoai-danh-sach-design.md §3.
 *
 * KHÔNG có `.range()` — không phải bỏ sót, mà project Supabase này đặt
 * `db-max-rows = 1000` ở tầng PostgREST: một truy vấn `limit=2000` vẫn trả về
 * `HTTP 200` kèm `content-range: 0-999/*`, bị CẮT NGẦM ở dòng 1000, và
 * `supabase-js` KHÔNG ném lỗi cho việc này — nó trông y hệt một trang kết quả
 * đầy đủ. Trước nhánh `duoc_moi`, `/admin` vì vậy từng âm thầm chỉ hiện 1000/1003
 * dòng; việc lọc còn 517 hôm nay tình cờ dọn sạch triệu chứng đó, không phải sửa
 * nó. Còn dư khoảng 483 dòng trước khi chạm lại trần 1000 — vượt trần đúng lúc số
 * đăng ký lớn nhất (gần ngày sự kiện) là lúc cắt ngầm gây thiệt hại nặng nhất.
 * Có nên thêm phân trang hay không là quyết định con người chưa đưa ra; comment
 * này chỉ để lần sau ai đó không phải dò lại từ đầu.
 */
export async function listRegistrations(): Promise<RegistrationRow[]> {
  const { data, error } = await db()
    .from("registrations")
    .select("*")
    .eq("duoc_moi", true)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Supabase list failed: ${error.message}`);
  return (data as RegistrationRow[]) ?? [];
}

/**
 * Payload UPDATE cho một lượt admin check-in / bỏ tick. Tách thuần để test.
 *
 * Check-in thì bật luôn `duoc_moi = true` — đây là đường ghi DUY NHẤT được
 * phép gửi cột này lên (xem chú thích tại `RegistrationRow.duoc_moi`). Lý do:
 * ops ở quầy `/admin/quet-qr` bấm "Check In" cho một mẹ ngoài danh sách nghĩa
 * là mẹ ấy ĐÃ được cho vào cửa; để `duoc_moi = false` thì mẹ không hiện trên
 * `/admin`, không nằm trong "Đã check-in: N / …", và không có trong file xuất
 * Excel — tức là hệ thống coi như chưa từng có người này trong hội trường.
 *
 * Bỏ tick KHÔNG đụng `duoc_moi`: bỏ tick là sửa nhầm lẫn về check-in, không
 * phải quyết định lại danh sách mời.
 */
export function adminCheckinPayload(
  checkedIn: boolean,
  checkedInAt: string | null,
): Partial<Pick<RegistrationRow, "checked_in" | "checked_in_at" | "checked_in_source" | "duoc_moi">> {
  if (!checkedIn) {
    return { checked_in: false, checked_in_at: null, checked_in_source: null };
  }
  return {
    checked_in: true,
    checked_in_at: checkedInAt ?? new Date().toISOString(),
    checked_in_source: "admin",
    duoc_moi: true,
  };
}

export async function adminUpdateCheckin(
  id: string,
  checkedIn: boolean,
  checkedInAt: string | null,
): Promise<RegistrationRow> {
  const { data, error } = await db()
    .from("registrations")
    .update(adminCheckinPayload(checkedIn, checkedInAt))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`Supabase adminUpdateCheckin failed: ${error.message}`);
  return data as RegistrationRow;
}
