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

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
/** Không kèm tên sheet → trỏ sheet đầu tiên, khỏi phải encode tên tiếng Việt. */
const RANGE = "A1";
/**
 * Có tới bốn lượt gọi Google tuần tự trong một lượt đăng ký (token, đọc A1,
 * append header, append dòng), tất cả cộng dồn vào thời gian mẹ đang chờ —
 * ngay sau Brevo và email. Mỗi cuộc gọi phải giữ ngân sách nhỏ để tổng thời
 * gian còn nằm trong maxDuration của route, không phải để "đủ thời gian".
 */
const TIMEOUT_MS = 5_000;

/** Dòng đầu Sheet: append thuần tuý có thể đếm ra số sai, phải nói rõ ngay đó. */
const NOTE =
  "⚠ Bản ghi thô, tự động — có thể có dòng trùng và KHÔNG có trạng thái check-in. Số liệu chính thức: /admin → Xuất Excel.";

export function sheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SHEET_ID &&
      process.env.GOOGLE_CLIENT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY,
  );
}

/**
 * Dựng RegistrationRow rồi đưa qua `rowsToSheet` để lấy đúng 15 ô theo đúng
 * thứ tự cột của file .xlsx. Không tự viết mảng cột ở đây: thứ tự cột chỉ được
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

/** base64url không đệm — định dạng bắt buộc của JWT. */
function b64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importKey(): Promise<CryptoKey> {
  // Vercel lưu xuống dòng thành hai ký tự `\n`. Không thay thế thì importKey ném lỗi.
  const pem = (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  const der = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  if (!der) throw new Error("GOOGLE_PRIVATE_KEY chưa được cấu hình");
  return crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(der), (c) => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

// Token sống 1 tiếng. Không cache thì mỗi lượt đăng ký tốn hai request thay vì một.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.token;

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: process.env.GOOGLE_CLIENT_EMAIL,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signed = `${header}.${claims}`;
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    await importKey(),
    new TextEncoder().encode(signed),
  );

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${signed}.${b64url(sig)}`,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Google token ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: now + data.expires_in - 60 };
  return data.access_token;
}

async function sheetsFetch(path: string, init?: RequestInit): Promise<Response> {
  // Không caller nào tự set header — bỏ hẳn việc "forward" `init?.headers`: object-spread
  // một HeadersInit ra {} khi đó là Headers hoặc mảng entry, nên trước đây nó im lặng
  // không làm gì. Authorization và Content-Type dưới đây luôn là header duy nhất được gửi.
  const res = await fetch(`${SHEETS_API}/${process.env.GOOGLE_SHEET_ID}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // 403 ở đây gần như luôn là: Sheet chưa share Editor cho GOOGLE_CLIENT_EMAIL.
  if (!res.ok) {
    throw new Error(`Google Sheets ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res;
}

/**
 * RAW, không phải USER_ENTERED. Hai lý do, cả hai đều bắt buộc:
 *  1. Họ tên là ô nhập tự do từ internet công cộng. USER_ENTERED sẽ CHẠY một
 *     giá trị dạng `=IMPORTXML(...)` như công thức.
 *  2. USER_ENTERED biến "0901234567" thành số 901234567, mất số 0 đầu.
 * Export hằng số này để test khẳng định được giá trị mà không cần mock fetch.
 */
export const VALUE_INPUT_OPTION = "RAW";

async function appendValues(values: (string | number)[][]): Promise<void> {
  await sheetsFetch(
    `/values/${RANGE}:append?valueInputOption=${VALUE_INPUT_OPTION}&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values }) },
  );
}

// Một lần cho mỗi tiến trình server, không phải mỗi lượt đăng ký. Giữ chính
// promise (không phải cờ boolean) để hai đăng ký đồng thời trên cùng một
// instance cùng chờ một lần kiểm tra, thay vì cùng ghi header hai lần.
let headerPromise: Promise<void> | null = null;

async function ensureHeader(): Promise<void> {
  // Lỗi thì xoá promise đã nhớ để lần sau thử lại, không nhớ luôn thất bại.
  headerPromise ??= doEnsureHeader().catch((err) => {
    headerPromise = null;
    throw err;
  });
  return headerPromise;
}

async function doEnsureHeader(): Promise<void> {
  const res = await sheetsFetch(`/values/${RANGE}`);
  const data = (await res.json()) as { values?: string[][] };
  if (!data.values || data.values.length === 0) {
    await appendValues([[NOTE], rowsToSheet([]).headers]);
  }
}

export async function appendRegistration(
  data: Registration,
  code: string,
): Promise<void> {
  await ensureHeader();
  await appendValues([registrationToSheetRow(data, code)]);
}
