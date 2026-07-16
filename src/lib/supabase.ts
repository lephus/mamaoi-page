import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Registration } from "./validation";

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
  be_thang_tuoi: number | null;
  di_cung_chong: boolean;
  dong_y_nhan_tin: boolean;
  nguon: string;
  checked_in: boolean;
  checked_in_at: string | null;
  checked_in_source: "qr" | "admin" | null;
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
 * Upsert on email so a mother who submits the form twice stays ONE row. The
 * check-in columns are deliberately omitted from the payload: on conflict,
 * Postgres only updates the columns provided, so an existing check-in is never
 * wiped by a later re-submission.
 */
export async function insertRegistration(data: Registration, code: string): Promise<void> {
  const { error } = await db()
    .from("registrations")
    .upsert(
      {
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
      },
      { onConflict: "email" },
    );
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
