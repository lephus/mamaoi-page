# Mirror đăng ký sự kiện sang Google Sheets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi lượt đăng ký `/su-kien` append thêm một dòng vào Google Sheet, song song và độc lập với việc ghi vào Supabase.

**Architecture:** Một module mới `src/lib/sheets.ts` cùng khuôn với `src/lib/supabase.ts` đang có: một hàm thuần map dữ liệu (được test), một tầng mạng mỏng gọi thẳng Google Sheets REST API bằng `fetch` với JWT tự ký. Route `POST /api/dang-ky` thêm một khối `try/catch` không-bao-giờ-ném, đặt sau khối Supabase.

**Tech Stack:** Next.js 16.2.10 (App Router, route handler mặc định chạy `runtime: 'nodejs'` — không cần khai báo), TypeScript, Zod 4, Vitest 4, Web Crypto toàn cục (Node 25). **Không thêm dependency nào.**

**Spec:** `docs/superpowers/specs/2026-07-20-google-sheets-mirror-design.md` (đã duyệt 2026-07-20)

## Global Constraints

- **Không thêm dependency nào.** Không `googleapis`, không `google-auth-library`. Tự ký JWT bằng Web Crypto.
- **`valueInputOption=RAW`, tuyệt đối không dùng `USER_ENTERED`.** RAW chặn formula injection từ ô nhập tự do (họ tên `=IMPORTXML(...)`) và giữ số 0 đầu số điện thoại.
- **Không nhánh nào được làm hỏng đăng ký của mẹ.** Sheets thất bại → `console.error` + `warnings.push("sheets")`, không bao giờ đổi status code.
- **Sheets chạy độc lập với Supabase.** Sheets không chờ Supabase thành công mới ghi, và ngược lại.
- **Chỉ `nguon: "su-kien"`.** Waitlist app nằm ngoài phạm vi.
- **Thứ tự cột chỉ tồn tại một chỗ:** `HEADERS` trong `src/lib/export-rows.ts`. Không tự viết mảng cột mới ở `sheets.ts`.
- **Ba cột check-in trong Sheet luôn rỗng.** Sheet không theo dõi check-in — đây là quyết định, không phải thiếu sót.
- Mọi `fetch` tới Google dùng `AbortSignal.timeout(10_000)`.
- Bình luận trong code viết tiếng Việt hoặc tiếng Anh đều được — bám theo file lân cận (`supabase.ts` tiếng Anh, `export-rows.ts` tiếng Việt).

## File Structure

| File | Trách nhiệm |
|---|---|
| `src/lib/sheets.ts` (tạo) | Toàn bộ phần Google Sheets: `sheetsConfigured`, `registrationToSheetRow` (thuần), `appendRegistration` (mạng) |
| `src/lib/sheets.test.ts` (tạo) | Unit test cho `registrationToSheetRow` |
| `src/app/api/dang-ky/route.ts` (sửa) | Thêm khối gọi `appendRegistration` |
| `.env.example` (sửa) | Bổ sung ba biến `GOOGLE_*` |

---

### Task 1: Hàm thuần `registrationToSheetRow`

Map `Registration` + mã check-in → một dòng 15 ô, bằng cách dựng `RegistrationRow` rồi gọi lại `rowsToSheet` của `export-rows.ts`.

**Files:**
- Create: `src/lib/sheets.ts`
- Test: `src/lib/sheets.test.ts`

**Interfaces:**
- Consumes: `rowsToSheet(rows: RegistrationRow[]): { headers: string[]; rows: (string | number)[][] }` từ `src/lib/export-rows.ts`; type `RegistrationRow` từ `src/lib/supabase.ts`; type `Registration` từ `src/lib/validation.ts`
- Produces: `registrationToSheetRow(data: Registration, code: string): (string | number)[]` — Task 2 gọi hàm này

**Ghi chú cho người làm:** payload trong `insertRegistration` (`src/lib/supabase.ts:51`) trông rất giống đoạn dựng row dưới đây. **Đừng gộp chúng lại.** `insertRegistration` cố tình bỏ năm cột check-in ra khỏi payload — ngữ nghĩa upsert phụ thuộc vào đúng chỗ đó (bình luận ở `supabase.ts:45-50` giải thích: on conflict, Postgres chỉ cập nhật những cột được gửi lên, nên một lượt check-in đã có không bị xoá bởi lần submit sau). Một builder dùng chung sẽ phải bóc năm cột đó ra lại, phức tạp hơn là lặp.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/sheets.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rowsToSheet } from "@/lib/export-rows";
import { registrationToSheetRow } from "@/lib/sheets";
import type { Registration } from "@/lib/validation";

const HEADERS = rowsToSheet([]).headers;

/** Đọc ô theo tên cột — test không phụ thuộc thứ tự cột. */
const at = (row: (string | number)[], header: string) => row[HEADERS.indexOf(header)];

const base: Registration = {
  nguon: "su-kien",
  hoTen: "Nguyễn Thị Lan",
  email: "lan@example.com",
  sdt: "0901234567",
  facebook: "",
  tinhThanh: "TP.HCM",
  trangThai: "mang_thai",
  beThangTuoi: undefined,
  diCungChong: true,
  dongYNhanTin: true,
};

describe("registrationToSheetRow", () => {
  it("số ô khớp số cột của header", () => {
    expect(registrationToSheetRow(base, "MO-23456A")).toHaveLength(HEADERS.length);
  });

  it("mẹ mang thai: 'Mang thai', cột tháng tuổi rỗng", () => {
    const row = registrationToSheetRow(base, "MO-23456A");
    expect(at(row, "Tình trạng")).toBe("Mang thai");
    expect(at(row, "Bé (tháng tuổi)")).toBe("");
  });

  it("mẹ đã sinh: 'Đã sinh' kèm số tháng", () => {
    const row = registrationToSheetRow(
      { ...base, trangThai: "da_sinh", beThangTuoi: 6 },
      "MO-23456A",
    );
    expect(at(row, "Tình trạng")).toBe("Đã sinh");
    expect(at(row, "Bé (tháng tuổi)")).toBe(6);
  });

  it("không có Facebook thành chuỗi rỗng, không phải null hay 'null'", () => {
    const row = registrationToSheetRow(base, "MO-23456A");
    expect(at(row, "Facebook")).toBe("");
    expect(row).not.toContain(null);
    expect(row).not.toContain("null");
  });

  it("không đi cùng chồng thành dấu gạch", () => {
    const row = registrationToSheetRow({ ...base, diCungChong: false }, "MO-23456A");
    expect(at(row, "Đi cùng chồng")).toBe("—");
  });

  it("mã check-in vào đúng cột", () => {
    const row = registrationToSheetRow(base, "MO-ZYXW98");
    expect(at(row, "Mã check-in")).toBe("MO-ZYXW98");
  });

  // Khẳng định quyết định của spec bằng test, không chỉ bằng lời:
  // Sheet là bản ghi thô lúc đăng ký, không bao giờ biết ai đã check-in.
  it("ba cột check-in luôn rỗng", () => {
    const row = registrationToSheetRow(base, "MO-23456A");
    expect(at(row, "Đã check-in")).toBe("—");
    expect(at(row, "Giờ check-in")).toBe("");
    expect(at(row, "Nguồn check-in")).toBe("");
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó thất bại**

Run: `npx vitest run src/lib/sheets.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/sheets"` (file chưa tồn tại)

- [ ] **Step 3: Viết implementation tối thiểu**

Tạo `src/lib/sheets.ts`:

```ts
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
```

- [ ] **Step 4: Chạy test để chắc chắn nó pass**

Run: `npx vitest run src/lib/sheets.test.ts`
Expected: PASS — 7 tests passed

- [ ] **Step 5: Chạy toàn bộ test suite, không được làm hỏng gì**

Run: `npx vitest run`
Expected: PASS — 29 tests passed (22 cũ + 7 mới)

- [ ] **Step 6: Commit**

```bash
git add src/lib/sheets.ts src/lib/sheets.test.ts
git commit -m "feat: map dữ liệu đăng ký sang dòng Google Sheet"
```

---

### Task 2: Tầng mạng — xác thực Google + append

Thêm phần gọi API vào `src/lib/sheets.ts`, và bổ sung ba biến `GOOGLE_*` vào `.env.example`.

**Files:**
- Modify: `src/lib/sheets.ts` (thêm vào file đã tạo ở Task 1)
- Modify: `.env.example`

**Interfaces:**
- Consumes: `registrationToSheetRow` (Task 1); `rowsToSheet` từ `src/lib/export-rows.ts`
- Produces: `sheetsConfigured(): boolean` và `appendRegistration(data: Registration, code: string): Promise<void>` — Task 3 gọi hai hàm này

**⚠ Đọc trước khi làm:** task này **không có unit test**. Mock cả tầng HTTP của Google chỉ chứng minh được rằng mock hoạt động. Bước xác minh ở đây là typecheck + lint; **đường mạng chỉ thực sự được chứng minh ở Task 3**, khi submit form thật và nhìn dòng hiện ra trong Sheet. Không được tuyên bố task này "đã chạy được" trước lúc đó.

- [ ] **Step 1: Thêm hằng số và `sheetsConfigured`**

Chèn vào `src/lib/sheets.ts`, **ngay dưới các `import`, trên `registrationToSheetRow`**:

```ts
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
/** Không kèm tên sheet → trỏ sheet đầu tiên, khỏi phải encode tên tiếng Việt. */
const RANGE = "A1";
/** Mẹ đang chờ response — một cuộc gọi Google treo không được giữ hàm serverless. */
const TIMEOUT_MS = 10_000;

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
```

- [ ] **Step 2: Thêm phần ký JWT và lấy access token**

Chèn vào **cuối** `src/lib/sheets.ts`:

```ts
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
```

- [ ] **Step 3: Thêm phần gọi Sheets API và `appendRegistration`**

Chèn vào **cuối** `src/lib/sheets.ts`:

```ts
async function sheetsFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${SHEETS_API}/${process.env.GOOGLE_SHEET_ID}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
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
 */
async function appendValues(values: (string | number)[][]): Promise<void> {
  await sheetsFetch(
    `/values/${RANGE}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values }) },
  );
}

// Một lần cho mỗi tiến trình server, không phải mỗi lượt đăng ký.
let headerEnsured = false;

async function ensureHeader(): Promise<void> {
  if (headerEnsured) return;
  const res = await sheetsFetch(`/values/${RANGE}`);
  const data = (await res.json()) as { values?: string[][] };
  if (!data.values || data.values.length === 0) {
    await appendValues([[NOTE], rowsToSheet([]).headers]);
  }
  // Chỉ đặt cờ khi đã chắc chắn — lỗi ở trên ném ra trước, lần sau thử lại.
  headerEnsured = true;
}

export async function appendRegistration(
  data: Registration,
  code: string,
): Promise<void> {
  await ensureHeader();
  await appendValues([registrationToSheetRow(data, code)]);
}
```

- [ ] **Step 4: Bổ sung `.env.example`**

Chèn vào `.env.example`, **ngay trên khối `# --- Supabase`**:

```
# --- Google Sheets: ban ghi tho cho ops (bo trong = bo qua hoan toan) ---
# Service account phai duoc share Sheet voi quyen Editor, neu khong moi lan
# append tra ve 403.
GOOGLE_SHEET_ID=                # ID nam trong URL cua Sheet
GOOGLE_CLIENT_EMAIL=            # vd: xxx@yyy.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=             # private key PEM, giu nguyen \n

```

- [ ] **Step 5: Typecheck và lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: cả hai lệnh không in ra lỗi nào

- [ ] **Step 6: Test cũ vẫn xanh**

Run: `npx vitest run`
Expected: PASS — 29 tests passed

- [ ] **Step 7: Commit**

```bash
git add src/lib/sheets.ts .env.example
git commit -m "feat: xac thuc Google va append dong vao Sheets"
```

---

### Task 3: Đấu nối vào `POST /api/dang-ky` + xác minh thật

**Files:**
- Modify: `src/app/api/dang-ky/route.ts:102-109` (chèn khối mới ngay sau khối Supabase)

**Interfaces:**
- Consumes: `sheetsConfigured()`, `appendRegistration(data, code)` (Task 2); `isRegistration(s)` từ `src/lib/validation.ts`
- Produces: không có — đây là task cuối

- [ ] **Step 1: Thêm import**

Trong `src/app/api/dang-ky/route.ts`, chèn dòng dưới đây **ngay sau** `import { sendEventEmail, ... } from "@/lib/brevo";` (dòng 2), để giữ thứ tự import theo alphabet như file đang có:

```ts
import { appendRegistration, sheetsConfigured } from "@/lib/sheets";
```

- [ ] **Step 2: Chèn khối gọi Sheets**

Trong cùng file, tìm khối Supabase kết thúc ở dòng 109 (`}` đóng của `if (isRegistration(data) && supabaseConfigured())`). Chèn **ngay sau** khối đó, **trên** dòng `return NextResponse.json({ ok: true, code: checkinCode, warnings });`:

```ts
  // Bản mirror thô cho ops. Cố tình KHÔNG phụ thuộc kết quả của Supabase ở
  // trên: lý do tồn tại của bản sao thứ hai là dự phòng, nối tiếp thì Supabase
  // sập sẽ kéo mất luôn dòng Sheet, đúng lúc nó có giá trị nhất.
  if (isRegistration(data) && sheetsConfigured()) {
    try {
      await appendRegistration(data, checkinCode!);
    } catch (err) {
      console.error("[dang-ky] Sheets append failed:", data.email, err);
      warnings.push("sheets");
    }
  }
```

- [ ] **Step 3: Typecheck, lint, test**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: không lỗi; 29 tests passed

- [ ] **Step 4: Xác minh thật — đây là cổng nghiệm thu của cả Task 2 lẫn Task 3**

Run: `npm run dev`

Mở `http://localhost:3000/su-kien`, cuộn tới mục "Giữ chỗ cho mẹ và bé", điền form với **số điện thoại bắt đầu bằng số 0** (ví dụ `0901234567`) và một email test, rồi submit.

Mở https://docs.google.com/spreadsheets/d/1OARjeV73t1OvUL7HvJTAG1Hbz_rvZs2q6AiWqgySuyE/edit

Kiểm tra đủ **năm** điều, không bỏ điều nào:

1. Dòng 1 là dòng ghi chú `⚠ Bản ghi thô, tự động — ...`
2. Dòng 2 là 15 tiêu đề cột, bắt đầu bằng `Họ tên`
3. Dòng 3 là dữ liệu vừa submit
4. **Cột `SĐT` hiện `0901234567`, còn nguyên số 0 đầu** (mất số 0 = `valueInputOption` sai)
5. Ba cột `Đã check-in` / `Giờ check-in` / `Nguồn check-in` rỗng hoặc `—`

Đồng thời xem terminal chạy `npm run dev`: **không được** có dòng `[dang-ky] Sheets append failed`. Nếu có kèm `403`, nghĩa là Sheet chưa được share quyền Editor cho địa chỉ trong `GOOGLE_CLIENT_EMAIL` — báo lại user, đừng tự sửa code.

- [ ] **Step 5: Xác minh không làm hỏng đường cũ**

Trong cùng phiên `npm run dev`, kiểm tra dòng vừa submit cũng đã vào Supabase: mở `http://localhost:3000/admin`, đăng nhập, thấy bản ghi test trong danh sách, và bấm "Xuất Excel" tải được file.

Điều này chứng minh nhánh Sheets mới không cướp mất luồng nào của Supabase.

- [ ] **Step 6: Dọn bản ghi test**

Xoá dòng test khỏi Google Sheet (xoá thủ công trên giao diện Sheet) và khỏi Supabase (bảng `registrations`, xoá theo email test). Sự kiện có sĩ số 500 — một bản ghi rác cũng làm lệch con số ở quầy.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/dang-ky/route.ts
git commit -m "feat: mirror dang ky su kien sang Google Sheets"
```

---

## Sau khi xong

Ba task trên khép lại phạm vi của spec. Những thứ **cố ý không làm**, đã ghi trong spec, đừng tự thêm vào:

- Không đưa waitlist app (`nguon: "app-waitlist"`) vào Sheet
- Không đưa trạng thái check-in vào Sheet
- Không dọn dòng trùng trong Sheet
- Không đụng vào Brevo, email, QR, `/check-in`, `/admin`, nút "Xuất Excel"

Deploy lên Vercel cần thêm ba biến `GOOGLE_SHEET_ID` / `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` vào Environment Variables của project. Dán `GOOGLE_PRIVATE_KEY` **giữ nguyên các ký tự `\n`** — code đã xử lý việc đổi lại thành xuống dòng thật.
