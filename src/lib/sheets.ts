import {
  checkinCells,
  HEADER_CODE,
  HEADER_DA_CHECKIN,
  HEADER_GIO_CHECKIN,
  HEADER_NGUON_CHECKIN,
  rowsToSheet,
  waitlistToSheet,
} from "./export-rows";
import { registrationToRow, type RegistrationRow, type WaitlistRow } from "./supabase";
import type { Registration } from "./validation";

/**
 * Bản mirror thô cho ops: mỗi lượt đăng ký append một dòng vào Google Sheet,
 * độc lập với Supabase. Supabase vẫn là kho chính của /admin và /check-in;
 * Sheet chỉ để ops mở link ra xem nhanh.
 *
 * Hai tab RIÊNG trong cùng một spreadsheet:
 *  - Đăng ký sự kiện → tab "register" (22 cột, có mã check-in + thông tin bé).
 *  - Waitlist app    → tab "waitlist" (3 cột: email, consent, thời điểm).
 * Ops tự đặt tên hai tab này trong Sheet; API `values.append` KHÔNG tự tạo tab,
 * nên tab thiếu / gõ sai tên sẽ làm lượt ghi lỗi — nhưng non-fatal (Brevo giữ
 * lead), route chỉ log cảnh báo.
 *
 * Chủ yếu là append lúc đăng ký. NGOẠI LỆ DUY NHẤT: khi mẹ quét QR check-in,
 * `markCheckedInInSheet` cập nhật TẠI CHỖ ba cột check-in — các cột đăng ký khác
 * không bao giờ bị sửa. Hệ quả đã chấp nhận: mẹ submit hai lần thì Sheet có hai
 * dòng CÙNG một mã (mã của một email được giữ cố định, xem `existingCheckinCode`),
 * và khi mẹ quét QR thì CẢ HAI dòng cùng mã đó đều được đánh dấu check-in. Số
 * liệu chính thức vẫn lấy ở /admin → Xuất Excel.
 */

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

/** Tên hai tab — ops phải đặt CHÍNH XÁC như thế này trong Google Sheet. */
const REGISTER_TAB = "register";
const WAITLIST_TAB = "waitlist";

/**
 * `tab!A1` đã escape cho URL. encodeURIComponent KHÔNG escape `!`, mà Google
 * muốn ký tự phân tách range ở dạng `%21` trong path — nên ghép tay. Tên tab
 * toàn ASCII nên encodeURIComponent(tab) trả về chính nó; chỉ `!A1` cần escape.
 */
function range(tab: string): string {
  return `${encodeURIComponent(tab)}%21A1`;
}
/**
 * Có tới bốn lượt gọi Google tuần tự trong một lượt đăng ký (token, đọc A1,
 * append header, append dòng), tất cả cộng dồn vào thời gian mẹ đang chờ —
 * ngay sau Brevo và email. Mỗi cuộc gọi phải giữ ngân sách nhỏ để tổng thời
 * gian còn nằm trong maxDuration của route, không phải để "đủ thời gian".
 */
const TIMEOUT_MS = 5_000;

/**
 * Dòng đầu Sheet: append có thể đếm ra số sai, phải nói rõ ngay đó. Chỉ được ghi
 * MỘT lần lúc tab còn trống (doEnsureHeader), nên tab đã tạo trước thay đổi này
 * vẫn giữ ghi chú cũ cho tới khi ops sửa tay — thuần cảnh báo, không ảnh hưởng dữ liệu.
 */
const NOTE =
  "⚠ Bản ghi thô, tự động — có thể có dòng trùng; cột check-in chỉ điền khi mẹ quét QR (nguồn admin không mirror sang đây). Số liệu chính thức: /admin → Xuất Excel.";
/** Waitlist không có check-in; chỉ cảnh báo dòng trùng do append thuần tuý. */
const WAITLIST_NOTE =
  "⚠ Bản ghi thô, tự động — có thể có dòng trùng. Số liệu chính thức: /admin → Xuất Excel.";

export function sheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SHEET_ID &&
      process.env.GOOGLE_CLIENT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY,
  );
}

/**
 * Dựng RegistrationRow rồi đưa qua `rowsToSheet` để lấy đúng 22 ô theo đúng
 * thứ tự cột của file .xlsx. Không tự viết mảng cột ở đây: thứ tự cột chỉ được
 * phép tồn tại một chỗ, là HEADERS trong export-rows.ts.
 *
 * Dùng lại `registrationToRow` của supabase.ts cho phần ánh xạ nghiệp vụ
 * (nhánh mang thai/đã sinh, suy ra tháng tuổi) — hai bản sao của cùng phép ánh
 * xạ sẽ trôi lệch nhau, và Sheet là nơi sai lệch đó khó bị phát hiện nhất.
 */
export function registrationToSheetRow(
  data: Registration,
  code: string,
): (string | number)[] {
  const now = new Date();
  const row: RegistrationRow = {
    id: "", // rowsToSheet không xuất id — giá trị này không bao giờ được đọc
    created_at: now.toISOString(), // giờ server, lệch vài ms so với Postgres
    ...registrationToRow(data, code, now),
    // Lúc append, ba cột check-in để rỗng; `markCheckedInInSheet` điền sau khi
    // mẹ quét QR.
    checked_in: false,
    checked_in_at: null,
    checked_in_source: null,
  };
  return rowsToSheet([row]).rows[0];
}

/**
 * Dựng WaitlistRow tạm rồi đưa qua `waitlistToSheet` để lấy đúng 3 ô theo đúng
 * thứ tự cột — y hệt cách `registrationToSheetRow` tái dùng `rowsToSheet`. Thứ
 * tự cột chỉ tồn tại một chỗ (export-rows.ts), nên Sheet và file Excel không bao
 * giờ lệch nhau. `created_at` chụp ngay lúc ghi.
 */
export function waitlistToSheetRow(
  email: string,
  dongY: boolean,
): (string | number)[] {
  const row: WaitlistRow = {
    id: "", // waitlistToSheet không xuất id — giá trị này không bao giờ được đọc
    created_at: new Date().toISOString(), // giờ server, lệch vài ms so với Postgres
    email,
    dong_y_nhan_tin: dongY,
  };
  return waitlistToSheet([row]).rows[0];
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

async function appendValues(
  tab: string,
  values: (string | number)[][],
): Promise<void> {
  await sheetsFetch(
    `/values/${range(tab)}:append?valueInputOption=${VALUE_INPUT_OPTION}&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values }) },
  );
}

// Một lần cho MỖI TAB, cho mỗi tiến trình server — không phải mỗi lượt đăng ký.
// Giữ chính promise (không phải cờ boolean) để hai đăng ký đồng thời trên cùng
// một instance cùng chờ một lần kiểm tra, thay vì cùng ghi header hai lần. Map
// theo tên tab vì register và waitlist có bộ header khác nhau, mỗi tab tự đảm
// bảo header của riêng mình.
const headerPromises = new Map<string, Promise<void>>();

function ensureHeader(
  tab: string,
  headerRows: (string | number)[][],
): Promise<void> {
  let promise = headerPromises.get(tab);
  if (!promise) {
    // Lỗi thì xoá promise đã nhớ để lần sau thử lại, không nhớ luôn thất bại.
    promise = doEnsureHeader(tab, headerRows).catch((err) => {
      headerPromises.delete(tab);
      throw err;
    });
    headerPromises.set(tab, promise);
  }
  return promise;
}

async function doEnsureHeader(
  tab: string,
  headerRows: (string | number)[][],
): Promise<void> {
  const res = await sheetsFetch(`/values/${range(tab)}`);
  const data = (await res.json()) as { values?: string[][] };
  if (!data.values || data.values.length === 0) {
    await appendValues(tab, headerRows);
  }
}

export async function appendRegistration(
  data: Registration,
  code: string,
): Promise<void> {
  await ensureHeader(REGISTER_TAB, [[NOTE], rowsToSheet([]).headers]);
  await appendValues(REGISTER_TAB, [registrationToSheetRow(data, code)]);
}

export async function appendWaitlist(email: string, dongY: boolean): Promise<void> {
  await ensureHeader(WAITLIST_TAB, [[WAITLIST_NOTE], waitlistToSheet([]).headers]);
  await appendValues(WAITLIST_TAB, [waitlistToSheetRow(email, dongY)]);
}

/**
 * Chỉ số cột 0 → chữ cột A1 (0→A, 25→Z, 26→AA). Bảng 22 cột chỉ chạm tới V,
 * nhưng viết đủ tổng quát để đổi thứ tự / thêm cột không âm thầm sai.
 */
export function colLetter(index0: number): string {
  let n = index0;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/**
 * TẤT CẢ số dòng A1 (1-based) của `code` trong mảng giá trị cột "Mã check-in" mà
 * `values.get` trả về: values[0] = dòng 1 (ô ghi chú), values[1] = dòng 2
 * (header), values[2..] = dữ liệu. Trả mảng rỗng nếu không thấy. So khớp bỏ
 * hoa/thường và khoảng trắng, phòng khi ô được sửa tay.
 *
 * Trả về NHIỀU dòng vì mã của một email được giữ cố định + Sheet chỉ append: mẹ
 * đăng ký lại tạo thêm dòng CÙNG mã, và cả cụm đó phải cùng được đánh dấu check-in.
 */
export function findCheckinRows(
  colValues: (string[] | undefined)[],
  code: string,
): number[] {
  const target = code.trim().toUpperCase();
  const rows: number[] = [];
  for (let i = 0; i < colValues.length; i++) {
    if (colValues[i]?.[0]?.trim().toUpperCase() === target) rows.push(i + 1);
  }
  return rows;
}

/**
 * Dữ liệu cho `values:batchUpdate` — mỗi cột check-in một range. Vị trí cột suy
 * ra từ `headers` (KHÔNG hardcode T/U/V) nên đổi thứ tự cột ở export-rows.ts vẫn
 * ghi đúng ô; cột bị đổi tên → ném lỗi ngay thay vì ghi nhầm ô. Giá trị lấy từ
 * `checkinCells`, dùng chung phép định dạng với file Excel.
 */
export function buildCheckinUpdate(
  tab: string,
  headers: string[],
  rowNumber: number,
  checkedInAt: string,
  source: "qr" | "admin",
): { range: string; values: string[][] }[] {
  const [da, gio, nguon] = checkinCells(true, checkedInAt, source);
  const cell = (header: string, value: string) => {
    const i = headers.indexOf(header);
    if (i < 0) throw new Error(`Sheet thiếu cột "${header}"`);
    return { range: `${tab}!${colLetter(i)}${rowNumber}`, values: [[value]] };
  };
  return [
    cell(HEADER_DA_CHECKIN, da),
    cell(HEADER_GIO_CHECKIN, gio),
    cell(HEADER_NGUON_CHECKIN, nguon),
  ];
}

/**
 * Cập nhật ba cột check-in vào MỌI dòng của mẹ trong tab register khi mẹ quét QR
 * — ngoại lệ có chủ đích với "chỉ append" (xem doc đầu file). Đọc cột "Mã
 * check-in", tìm mọi dòng trùng mã (đăng ký lại giữ nguyên mã nên có thể có nhiều
 * dòng), rồi `values:batchUpdate` ba ô cho từng dòng.
 *
 * Ném lỗi nếu KHÔNG thấy dòng nào (thường do Sheet append lỗi lúc đăng ký) —
 * route gọi hàm này BẮT lỗi và chỉ log, vì check-in đã ghi xong ở Supabase (nguồn
 * chính thức); Sheet lệch là non-fatal.
 */
export async function markCheckedInInSheet(
  code: string,
  checkedInAt: string,
  source: "qr" | "admin",
): Promise<void> {
  const headers = rowsToSheet([]).headers;
  const codeIdx = headers.indexOf(HEADER_CODE);
  if (codeIdx < 0) throw new Error(`Sheet thiếu cột "${HEADER_CODE}"`);
  const codeCol = colLetter(codeIdx);

  // Đọc cả cột mã (từ dòng 1) để định vị các dòng cần sửa.
  const res = await sheetsFetch(
    `/values/${encodeURIComponent(REGISTER_TAB)}%21${codeCol}1:${codeCol}`,
  );
  const data = (await res.json()) as { values?: string[][] };
  const rowNumbers = findCheckinRows(data.values ?? [], code);
  if (rowNumbers.length === 0) {
    throw new Error(`Không thấy mã ${code} trong tab "${REGISTER_TAB}"`);
  }

  await sheetsFetch(`/values:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      valueInputOption: VALUE_INPUT_OPTION,
      data: rowNumbers.flatMap((n) =>
        buildCheckinUpdate(REGISTER_TAB, headers, n, checkedInAt, source),
      ),
    }),
  });
}
