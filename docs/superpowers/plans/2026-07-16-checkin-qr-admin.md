# Check-in QR + Trang Admin (Supabase) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm luồng check-in QR cho Mama Ơi Day (trang tự check-in `/check-in/[code]` + trang quản trị `/admin`), lưu bản ghi đăng ký & trạng thái check-in trên Supabase, và gỡ bỏ Google Sheets.

**Architecture:** Brevo giữ vai trò CRM + gửi email (nguồn sự thật). Supabase (Postgres) là kho bản ghi đăng ký có cấu trúc + trạng thái check-in, phục vụ cả `/check-in` lẫn `/admin`, truy cập server-side bằng service role key. Hai luồng check-in (QR tự phục vụ + admin thủ công) cùng ghi vào một bảng `registrations`. Đăng nhập admin dùng env-cred + cookie phiên đã ký HMAC, guard trực tiếp trong từng route/page (không dùng proxy/middleware).

**Tech Stack:** Next.js 16.2.10 (App Router), React 19, TypeScript, Tailwind CSS v4, `@supabase/supabase-js`, `nodemailer` + `qrcode` (đã có), `vitest` (thêm mới, cho unit test logic thuần), Playwright (đã có, cho E2E thủ công).

## Global Constraints

- **Next.js 16 breaking changes** (đã kiểm chứng trong `node_modules/next/dist/docs/`): KHÔNG dùng `middleware.ts` (đã đổi tên thành `proxy.ts`) — plan này guard auth trong từng route/page thay vì proxy. `cookies()` là **async**: `const c = await cookies()`. Dynamic route `params` là **Promise**: `{ params }: { params: Promise<{ code: string }> }` → `await params`. Route handler ký hiệu `export async function GET/POST(request: Request, ctx: RouteContext<'/path'>)`, dùng `Response.json(...)`.
- **Brevo là nguồn sự thật**: trong `POST /api/dang-ky`, Brevo phải thành công trước (lỗi → 502, không giả thành công). Supabase là kho phụ **không bắt buộc**: lỗi → `console.error` + `warnings.push("supabase")`, KHÔNG làm hỏng đăng ký.
- **Không bí mật trong source hay tài liệu commit**: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` chỉ nằm ở `.env.local` (gitignored) + Vercel env. `.env.example` chỉ có key rỗng.
- **Copy tiếng Việt & design tokens** giữ đúng hệ thống hiện có: token Tailwind v4 (`bg-primary`, `text-ink`, `text-ink-faded`, `bg-cream`, `border-line`, `bg-primary-faded`, `text-success`, `text-danger`, `shadow-card`…) trong `src/app/globals.css`. Dùng lại `Button` (`@/components/ui/Button`), `Header`, `Footer`. Trang không public (`/check-in`, `/admin`) đặt `robots: { index: false, follow: false }`.
- **Mã check-in**: định dạng `MO-` + 6 ký tự thuộc bảng `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (bỏ I, O, 0, 1). Regex: `^MO-[2-9A-HJ-NP-Z]{6}$`.
- **Múi giờ**: hiển thị/nhập theo giờ VN (Asia/Ho_Chi_Minh = UTC+7 cố định, không DST). Lưu DB dạng ISO/UTC (`timestamptz`).
- Sau mỗi task: `npm run lint` không lỗi mới; commit nhỏ, thông điệp tiếng Việt.

---

### Task 1: Supabase — dependency, bảng `registrations`, tầng truy cập dữ liệu

**Files:**
- Modify: `package.json` (thêm `@supabase/supabase-js`)
- Create: `src/lib/supabase.ts`
- External (1 lần): tạo bảng `registrations` trên Supabase project `MamaOiPage`
- Env: `.env.local` (điền `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)

**Interfaces:**
- Consumes: `Registration` type từ `@/lib/validation`.
- Produces:
  - `type RegistrationRow` (các cột dưới)
  - `supabaseConfigured(): boolean`
  - `insertRegistration(data: Registration, code: string): Promise<void>`
  - `findByCode(code: string): Promise<RegistrationRow | null>`
  - `type CheckinResult = { status: "ok"|"already"; name: string; time: string } | { status: "not_found" }`
  - `checkinByCode(code: string): Promise<CheckinResult>`
  - `listRegistrations(): Promise<RegistrationRow[]>`
  - `adminUpdateCheckin(id: string, checkedIn: boolean, checkedInAt: string | null): Promise<RegistrationRow>`

- [ ] **Step 1: Cài dependency**

Run:
```bash
npm install @supabase/supabase-js
```

- [ ] **Step 2: Tạo bảng trên Supabase**

Tạo bảng bằng **Supabase MCP** (tool `apply_migration`, name `create_registrations`) với đúng SQL dưới đây. Nếu MCP chưa sẵn trong phiên, dán SQL này vào **Supabase Dashboard → SQL Editor → Run**:

```sql
create table if not exists registrations (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  checkin_code      text not null,
  ho_ten            text not null,
  email             text not null unique,
  sdt               text not null,
  facebook          text,
  tinh_thanh        text not null,
  trang_thai        text not null check (trang_thai in ('mang_thai','da_sinh')),
  be_thang_tuoi     int,
  di_cung_chong     boolean not null default false,
  dong_y_nhan_tin   boolean not null default true,
  nguon             text not null default 'su-kien',
  checked_in        boolean not null default false,
  checked_in_at     timestamptz,
  checked_in_source text check (checked_in_source in ('qr','admin'))
);

create unique index if not exists registrations_checkin_code_key on registrations (checkin_code);
```

- [ ] **Step 3: Điền env vào `.env.local`**

Thêm vào `.env.local` (KHÔNG commit):
```
SUPABASE_URL=https://ynebuselhjttlvbfpklb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key từ Supabase → Project Settings → API>
```

- [ ] **Step 4: Viết `src/lib/supabase.ts`**

```ts
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
```

- [ ] **Step 5: Verify — build + bảng tồn tại**

Run:
```bash
npm run build
```
Expected: build PASS (không lỗi type ở `src/lib/supabase.ts`).

Rồi xác minh bảng bằng Supabase MCP (`execute_sql`: `select count(*) from registrations;` → `0`) hoặc SQL Editor. Expected: trả về 0 dòng, không lỗi.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/supabase.ts
git commit -m "feat: thêm Supabase làm kho đăng ký + tầng truy cập check-in"
```

---

### Task 2: Tiện ích thuần + thiết lập vitest (time, mã hợp lệ)

**Files:**
- Create: `src/lib/time.ts`
- Modify: `src/lib/validation.ts` (thêm `CHECKIN_CODE_RE`, `isValidCheckinCode`)
- Create: `vitest.config.ts`
- Create: `src/lib/time.test.ts`, `src/lib/validation.test.ts`
- Modify: `package.json` (thêm devDep `vitest` + script `test`)

**Interfaces:**
- Produces:
  - `formatCheckinTime(iso: string): string` → `"HH:MM DD/MM/YYYY"` giờ VN
  - `isoToVNLocalInput(iso: string): string` → `"YYYY-MM-DDTHH:mm"` giờ VN (cho `datetime-local`)
  - `vnLocalInputToISO(local: string): string` → ISO/UTC
  - `CHECKIN_CODE_RE: RegExp`, `isValidCheckinCode(code: string): boolean`

- [ ] **Step 1: Cài vitest**

Run:
```bash
npm install -D vitest
```

- [ ] **Step 2: Tạo `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Thêm script test vào `package.json`**

Trong khối `"scripts"`, thêm dòng:
```json
    "test": "vitest run",
```

- [ ] **Step 4: Viết test thất bại cho `src/lib/time.ts`**

Tạo `src/lib/time.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { formatCheckinTime, isoToVNLocalInput, vnLocalInputToISO } from "@/lib/time";

describe("time (giờ VN, UTC+7)", () => {
  it("formatCheckinTime: ISO → HH:MM DD/MM/YYYY", () => {
    expect(formatCheckinTime("2026-08-30T01:03:00.000Z")).toBe("08:03 30/08/2026");
  });
  it("isoToVNLocalInput: ISO → giá trị datetime-local", () => {
    expect(isoToVNLocalInput("2026-08-30T01:03:00.000Z")).toBe("2026-08-30T08:03");
  });
  it("vnLocalInputToISO: datetime-local (giờ VN) → ISO/UTC", () => {
    expect(vnLocalInputToISO("2026-08-30T08:03")).toBe("2026-08-30T01:03:00.000Z");
  });
  it("khứ hồi ISO ↔ local", () => {
    const iso = "2026-08-30T01:03:00.000Z";
    expect(vnLocalInputToISO(isoToVNLocalInput(iso))).toBe(iso);
  });
});
```

- [ ] **Step 5: Chạy để chắc chắn FAIL**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/time'` (chưa tạo file).

- [ ] **Step 6: Viết `src/lib/time.ts`**

```ts
/** Việt Nam cố định UTC+7, không DST — nên phép dịch +7h là chính xác. */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** ISO instant → "HH:MM DD/MM/YYYY" theo giờ VN. */
export function formatCheckinTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + VN_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ${p(d.getUTCDate())}/${p(
    d.getUTCMonth() + 1,
  )}/${d.getUTCFullYear()}`;
}

/** ISO instant → "YYYY-MM-DDTHH:mm" giờ VN (dùng cho input datetime-local). */
export function isoToVNLocalInput(iso: string): string {
  return new Date(new Date(iso).getTime() + VN_OFFSET_MS).toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" (giờ VN) → ISO instant (UTC). */
export function vnLocalInputToISO(local: string): string {
  return new Date(`${local}:00+07:00`).toISOString();
}
```

- [ ] **Step 7: Viết test thất bại cho `isValidCheckinCode`**

Tạo `src/lib/validation.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { isValidCheckinCode } from "@/lib/validation";

describe("isValidCheckinCode", () => {
  it("chấp nhận mã đúng định dạng", () => {
    expect(isValidCheckinCode("MO-23456A")).toBe(true);
    expect(isValidCheckinCode("MO-ABCDEF")).toBe(true);
  });
  it("từ chối ký tự cấm (I, O, 0, 1) và sai định dạng", () => {
    expect(isValidCheckinCode("MO-ABCDEI")).toBe(false); // I
    expect(isValidCheckinCode("MO-ABCDEO")).toBe(false); // O
    expect(isValidCheckinCode("MO-012345")).toBe(false); // 0,1
    expect(isValidCheckinCode("mo-23456a")).toBe(false); // thường
    expect(isValidCheckinCode("MO-2345")).toBe(false);   // ngắn
    expect(isValidCheckinCode("23456A")).toBe(false);    // thiếu tiền tố
  });
});
```

- [ ] **Step 8: Chạy để chắc chắn FAIL**

Run: `npm test`
Expected: FAIL — `isValidCheckinCode is not a function`.

- [ ] **Step 9: Thêm vào cuối `src/lib/validation.ts`**

```ts
/** Định dạng mã check-in — khớp bảng chữ của `generateCheckinCode` (bỏ I,O,0,1). */
export const CHECKIN_CODE_RE = /^MO-[2-9A-HJ-NP-Z]{6}$/;

export function isValidCheckinCode(code: string): boolean {
  return CHECKIN_CODE_RE.test(code);
}
```

- [ ] **Step 10: Chạy test — PASS**

Run: `npm test`
Expected: PASS — tất cả test của `time` và `validation`.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/time.ts src/lib/time.test.ts src/lib/validation.ts src/lib/validation.test.ts
git commit -m "feat: tiện ích giờ VN + kiểm định mã check-in (kèm vitest)"
```

---

### Task 3: Route đăng ký — thay Google Sheets bằng Supabase

**Files:**
- Modify: `src/app/api/dang-ky/route.ts`
- Delete: `src/lib/sheets.ts`
- Modify: `package.json` (gỡ `google-auth-library`)
- Modify: `.env.example` (gỡ 3 key Google)

**Interfaces:**
- Consumes: `insertRegistration`, `supabaseConfigured` từ `@/lib/supabase` (Task 1); `isRegistration` từ `@/lib/validation`.

- [ ] **Step 1: Sửa import ở đầu `src/app/api/dang-ky/route.ts`**

Thay dòng:
```ts
import { appendSubmission, sheetsConfigured } from "@/lib/sheets";
```
bằng:
```ts
import { insertRegistration, supabaseConfigured } from "@/lib/supabase";
```

- [ ] **Step 2: Thay khối mirror Google Sheets bằng Supabase**

Thay nguyên khối:
```ts
  if (sheetsConfigured()) {
    try {
      await appendSubmission(data, checkinCode);
    } catch (err) {
      // Logged loudly: this row must be back-filled from Brevo before the
      // event, or she is missing from the ops team's check-in list.
      console.error("[dang-ky] Sheets mirror failed:", data.email, err);
      warnings.push("sheets");
    }
  }
```
bằng:
```ts
  // Structured record for /check-in + /admin. Event registrations only — the
  // app waitlist has nothing to check in to, so it stays in Brevo alone.
  // Non-fatal: she is already registered in Brevo. A failure here is logged
  // loudly so ops can back-fill this row from Brevo before the event.
  if (isRegistration(data) && supabaseConfigured()) {
    try {
      await insertRegistration(data, checkinCode!);
    } catch (err) {
      console.error("[dang-ky] Supabase insert failed:", data.email, err);
      warnings.push("supabase");
    }
  }
```

- [ ] **Step 3: Xoá file Sheets + gỡ dependency**

Run:
```bash
git rm src/lib/sheets.ts
npm uninstall google-auth-library
```

- [ ] **Step 4: Gỡ env Google khỏi `.env.example`**

Xoá khối:
```
# --- Google Sheets (bo trong = tat mirror) ---
GOOGLE_SHEET_ID=
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
```

- [ ] **Step 5: Verify — build + đăng ký thử**

Run:
```bash
npm run build
```
Expected: build PASS, không còn tham chiếu `@/lib/sheets`.

Với `.env.local` đã có Supabase + Brevo, chạy `npm run dev`, mở `/su-kien`, đăng ký một mẹ thử. Sau đó kiểm tra Supabase (MCP `select checkin_code, ho_ten, email from registrations order by created_at desc limit 1;` hoặc SQL Editor). Expected: có đúng 1 dòng mới với mã `MO-...` khớp mã hiện trên trang `/cam-on`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: đăng ký ghi Supabase thay Google Sheets, gỡ sheets"
```

---

### Task 4: Email — QR encode đường dẫn check-in + nút bấm

**Files:**
- Modify: `src/lib/brevo.ts` (hàm `sendEventEmail`)

**Interfaces:**
- Consumes: `SITE` (đã import trong `brevo.ts`). Đọc `process.env.NEXT_PUBLIC_SITE_URL` (tuỳ chọn, mặc định `SITE.url`).
- Produces: QR + email nay chứa URL `/<base>/check-in/<code>`.

- [ ] **Step 1: Đổi nội dung QR sang URL**

Trong `sendEventEmail`, thay:
```ts
  const qrDataUrl = await QRCode.toDataURL(checkinCode, {
    width: 480,
    margin: 2,
    color: { dark: "#292929", light: "#ffffff" },
  });
```
bằng:
```ts
  // QR nay dẫn thẳng tới trang check-in (quét bằng camera là mở trang), thay vì
  // chỉ mã trơn. Mã chữ + QR đính kèm vẫn giữ để gõ tay / admin tra khi máy quét lỗi.
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? SITE.url;
  const checkinUrl = `${base}/check-in/${checkinCode}`;

  const qrDataUrl = await QRCode.toDataURL(checkinUrl, {
    width: 480,
    margin: 2,
    color: { dark: "#292929", light: "#ffffff" },
  });
```

- [ ] **Step 2: Thêm nút đường dẫn check-in trong thân email**

Thay đoạn:
```ts
    <p style="margin:0 0 16px;font-size:16px;line-height:24px;">
      Mẹ vui lòng đưa mã QR đính kèm email này tại quầy check-in.
    </p>
```
bằng:
```ts
    <p style="margin:0 0 16px;font-size:16px;line-height:24px;">
      Mẹ vui lòng đưa mã QR đính kèm email này tại quầy check-in.
    </p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${checkinUrl}" style="display:inline-block;background:#f08f8c;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:9999px;">
        Mở trang check-in
      </a>
    </p>
```

- [ ] **Step 3: Verify — build + gửi thử**

Run:
```bash
npm run build
```
Expected: PASS.

Nếu SMTP đã cấu hình: đăng ký thử, mở email nhận được, xác nhận (a) nút "Mở trang check-in" trỏ tới `.../check-in/MO-...`, (b) quét QR bằng camera điện thoại ra đúng URL đó. Nếu SMTP chưa bật: đọc lại code xác nhận `checkinUrl` được truyền vào cả `QRCode.toDataURL` và thẻ `<a>`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/brevo.ts
git commit -m "feat: QR email dẫn tới trang check-in + nút bấm"
```

---

### Task 5: API tự check-in — `POST /api/check-in`

**Files:**
- Create: `src/app/api/check-in/route.ts`

**Interfaces:**
- Consumes: `checkinByCode` từ `@/lib/supabase` (Task 1); `isValidCheckinCode` từ `@/lib/validation` (Task 2).
- Produces: `POST /api/check-in` nhận `{ code }`, trả `{ ok, alreadyCheckedIn, name, time }` (time = ISO) hoặc lỗi `{ error }`.

- [ ] **Step 1: Viết `src/app/api/check-in/route.ts`**

```ts
import { checkinByCode } from "@/lib/supabase";
import { isValidCheckinCode } from "@/lib/validation";

/**
 * Self check-in write path (QR / link). Public: the random code IS the bearer
 * ticket (~1 tỷ tổ hợp nên dò mã bất khả thi). Chỉ GHI khi bấm nút — trang mở
 * (GET) chỉ đọc, nên prefetch/quét link của email client không thể vô tình check-in.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const code = (body as { code?: string })?.code?.trim().toUpperCase() ?? "";
  if (!isValidCheckinCode(code)) {
    return Response.json({ error: "Mã không hợp lệ" }, { status: 400 });
  }

  try {
    const result = await checkinByCode(code);
    if (result.status === "not_found") {
      return Response.json({ error: "Không tìm thấy mã" }, { status: 404 });
    }
    return Response.json({
      ok: true,
      alreadyCheckedIn: result.status === "already",
      name: result.name,
      time: result.time,
    });
  } catch (err) {
    console.error("[check-in] failed:", err);
    return Response.json({ error: "Hệ thống check-in tạm lỗi" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Verify — build + curl**

Run `npm run build` (Expected: PASS). Rồi `npm run dev` và, với một mã thật đang có trong Supabase (lấy từ Task 3), chạy:
```bash
curl -s -X POST http://localhost:3000/api/check-in \
  -H "Content-Type: application/json" -d '{"code":"MO-XXXXXX"}'
```
Expected lần 1: `{"ok":true,"alreadyCheckedIn":false,"name":"...","time":"2026-...Z"}`.
Chạy lại lần 2 cùng mã → Expected: `{"ok":true,"alreadyCheckedIn":true,...}` với `time` y hệt lần 1.
Mã sai định dạng `-d '{"code":"ABC"}'` → Expected: HTTP 400 `{"error":"Mã không hợp lệ"}`.
Mã đúng định dạng nhưng không tồn tại → Expected: HTTP 404 `{"error":"Không tìm thấy mã"}`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/check-in/route.ts
git commit -m "feat: API tự check-in idempotent qua Supabase"
```

---

### Task 6: Trang tự check-in `/check-in/[code]` + nút xác nhận

**Files:**
- Create: `src/app/check-in/[code]/page.tsx`
- Create: `src/components/CheckinConfirm.tsx`

**Interfaces:**
- Consumes: `findByCode` từ `@/lib/supabase`; `isValidCheckinCode` từ `@/lib/validation`; `formatCheckinTime` từ `@/lib/time`; `Header`, `Footer`, `Button`; API `POST /api/check-in` (Task 5).

- [ ] **Step 1: Viết `src/app/check-in/[code]/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { CheckinConfirm } from "@/components/CheckinConfirm";
import { findByCode } from "@/lib/supabase";
import { formatCheckinTime } from "@/lib/time";
import { isValidCheckinCode } from "@/lib/validation";

export const metadata: Metadata = {
  title: "Check-in — Mama Ơi Day",
  robots: { index: false, follow: false },
};

// Đọc DB theo từng request; không bao giờ được cache trạng thái "đã check-in".
export const dynamic = "force-dynamic";

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-line bg-white px-8 py-10 shadow-card">
      <h1 className="text-2xl font-extrabold text-ink">{title}</h1>
      <p className="mt-3 text-base leading-7 text-ink-faded">{body}</p>
    </div>
  );
}

export default async function CheckinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw).trim().toUpperCase();

  let content: React.ReactNode;

  if (!isValidCheckinCode(code)) {
    content = (
      <Message
        title="Mã không hợp lệ"
        body="Đường dẫn check-in không đúng. Mẹ vui lòng kiểm tra lại email xác nhận."
      />
    );
  } else {
    try {
      const row = await findByCode(code);
      if (!row) {
        content = (
          <Message
            title="Không tìm thấy mã"
            body="Mã này chưa có trong hệ thống. Mẹ vui lòng tới quầy để nhân viên hỗ trợ."
          />
        );
      } else if (row.checked_in) {
        content = (
          <Message
            title="Mẹ đã check-in rồi 💛"
            body={`Chào chị ${row.ho_ten}, mẹ đã check-in lúc ${formatCheckinTime(
              row.checked_in_at ?? "",
            )}.`}
          />
        );
      } else {
        content = <CheckinConfirm code={code} name={row.ho_ten} />;
      }
    } catch {
      content = (
        <Message
          title="Hệ thống tạm lỗi"
          body="Không kết nối được lúc này. Mẹ vui lòng báo nhân viên tại quầy check-in."
        />
      );
    }
  }

  return (
    <>
      <Header />
      <main className="flex flex-1 items-center px-5 py-16">
        <div className="mx-auto w-full max-w-md text-center">{content}</div>
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 2: Viết `src/components/CheckinConfirm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { formatCheckinTime } from "@/lib/time";
import { Button } from "./ui/Button";

export function CheckinConfirm({ code, name }: { code: string; name: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [time, setTime] = useState("");
  const [already, setAlready] = useState(false);
  const [msg, setMsg] = useState("");

  async function confirm() {
    setState("loading");
    setMsg("");
    try {
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Có lỗi xảy ra");
        setState("error");
        return;
      }
      setTime(data.time);
      setAlready(Boolean(data.alreadyCheckedIn));
      setState("done");
    } catch {
      setMsg("Không kết nối được. Vui lòng thử lại.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-3xl border border-success bg-white px-8 py-10 shadow-card">
        <div className="text-5xl">✅</div>
        <h1 className="mt-3 text-2xl font-extrabold text-ink">
          {already ? "Mẹ đã check-in rồi" : "Check-in thành công!"}
        </h1>
        <p className="mt-3 text-base leading-7 text-ink-faded">
          Chào chị <strong className="text-ink">{name}</strong>,{" "}
          {already ? "mẹ đã check-in" : "check-in"} lúc{" "}
          <strong className="text-ink">{formatCheckinTime(time)}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-line bg-white px-8 py-10 shadow-card">
      <h1 className="text-2xl font-extrabold text-ink">Chào chị {name} 💛</h1>
      <p className="mt-3 text-base leading-7 text-ink-faded">
        Nhấn nút bên dưới để xác nhận check-in tại Mama Ơi Day.
      </p>
      {state === "error" && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {msg}
        </p>
      )}
      <Button onClick={confirm} disabled={state === "loading"} className="mt-6 w-full">
        {state === "loading" ? "Đang xác nhận..." : "Xác nhận check-in"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Verify — build + trình duyệt**

Run `npm run build` (Expected: PASS). Rồi `npm run dev` và kiểm tra bằng trình duyệt với mã thật:
- `/check-in/MO-XXXXXX` (chưa check-in) → thấy "Chào chị [Tên]" + nút "Xác nhận check-in". Bấm → chuyển sang "Check-in thành công! ... lúc HH:MM DD/MM/YYYY".
- Tải lại trang cùng mã → thấy "Mẹ đã check-in rồi 💛 ... lúc HH:MM…" (đúng giờ gốc).
- `/check-in/SAI` → "Mã không hợp lệ". `/check-in/MO-ZZZZZZ` (định dạng đúng, không tồn tại) → "Không tìm thấy mã".

- [ ] **Step 4: Commit**

```bash
git add src/app/check-in/[code]/page.tsx src/components/CheckinConfirm.tsx
git commit -m "feat: trang tự check-in QR + nút xác nhận"
```

---

### Task 7: Đăng nhập admin — thư viện auth + route login/logout

**Files:**
- Create: `src/lib/admin-auth.ts`
- Create: `src/lib/admin-auth.test.ts`
- Create: `src/app/api/admin/login/route.ts`
- Create: `src/app/api/admin/logout/route.ts`
- Env: `.env.local` (thêm `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`)

**Interfaces:**
- Produces:
  - `ADMIN_COOKIE: string` (= `"mo_admin"`)
  - `adminAuthConfigured(): boolean`
  - `verifyCredentials(email: string, password: string): boolean`
  - `signSession(ttlMs?: number): string`
  - `verifySession(token: string | undefined): boolean`
  - `isAdmin(): Promise<boolean>` (đọc cookie phiên; dùng trong page/route admin)

- [ ] **Step 1: Điền env admin vào `.env.local`**

Thêm (KHÔNG commit — giá trị khách cung cấp):
```
ADMIN_EMAIL=admin@digitalunicorn.fr
ADMIN_PASSWORD=<mật khẩu admin khách cung cấp>
ADMIN_SESSION_SECRET=<chuỗi ngẫu nhiên dài, ví dụ tạo bằng: openssl rand -base64 32>
```

- [ ] **Step 2: Viết test thất bại `src/lib/admin-auth.test.ts`**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import {
  verifyCredentials,
  signSession,
  verifySession,
} from "@/lib/admin-auth";

beforeAll(() => {
  process.env.ADMIN_EMAIL = "admin@digitalunicorn.fr";
  process.env.ADMIN_PASSWORD = "secret-pass";
  process.env.ADMIN_SESSION_SECRET = "unit-test-secret";
});

describe("admin-auth", () => {
  it("verifyCredentials: đúng email/mật khẩu (email không phân biệt hoa thường)", () => {
    expect(verifyCredentials("admin@digitalunicorn.fr", "secret-pass")).toBe(true);
    expect(verifyCredentials("ADMIN@digitalunicorn.fr", "secret-pass")).toBe(true);
  });
  it("verifyCredentials: từ chối sai", () => {
    expect(verifyCredentials("admin@digitalunicorn.fr", "wrong")).toBe(false);
    expect(verifyCredentials("x@y.z", "secret-pass")).toBe(false);
  });
  it("signSession → verifySession hợp lệ", () => {
    expect(verifySession(signSession())).toBe(true);
  });
  it("verifySession: từ chối token rỗng / giả mạo / hết hạn", () => {
    expect(verifySession(undefined)).toBe(false);
    expect(verifySession("abc.def")).toBe(false);
    const token = signSession();
    expect(verifySession(token.slice(0, -2) + "xx")).toBe(false); // đổi chữ ký
    expect(verifySession(signSession(-1000))).toBe(false); // đã hết hạn
  });
});
```

- [ ] **Step 3: Chạy để chắc chắn FAIL**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/admin-auth'`.

- [ ] **Step 4: Viết `src/lib/admin-auth.ts`**

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Đăng nhập admin đơn giản: so khớp env-cred + cookie phiên ký HMAC. Không dùng
 * Supabase Auth (thừa cho một tài khoản admin). Các hàm thuần (sign/verify/creds)
 * chỉ phụ thuộc node:crypto nên unit-test được; `isAdmin` nạp `next/headers` động
 * để module vẫn import được trong test.
 */
export const ADMIN_COOKIE = "mo_admin";
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000; // 12h — phủ trọn ngày sự kiện

export function adminAuthConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_EMAIL &&
      process.env.ADMIN_PASSWORD &&
      process.env.ADMIN_SESSION_SECRET,
  );
}

function tsEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function verifyCredentials(email: string, password: string): boolean {
  const e = process.env.ADMIN_EMAIL ?? "";
  const p = process.env.ADMIN_PASSWORD ?? "";
  return (
    tsEqual(email.trim().toLowerCase(), e.trim().toLowerCase()) && tsEqual(password, p)
  );
}

function sign(payload: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signSession(ttlMs: number = DEFAULT_TTL_MS): string {
  const exp = Date.now() + ttlMs;
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySession(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  if (!tsEqual(sig, sign(payload))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && Date.now() < exp;
  } catch {
    return false;
  }
}

/** Guard server-side: đọc cookie phiên. Dùng trong page/route admin. */
export async function isAdmin(): Promise<boolean> {
  const { cookies } = await import("next/headers");
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return verifySession(token);
}
```

- [ ] **Step 5: Chạy test — PASS**

Run: `npm test`
Expected: PASS — toàn bộ test `admin-auth` (kèm các test cũ vẫn xanh).

- [ ] **Step 6: Viết `src/app/api/admin/login/route.ts`**

```ts
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  adminAuthConfigured,
  signSession,
  verifyCredentials,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  if (!adminAuthConfigured()) {
    return Response.json({ error: "Chưa cấu hình đăng nhập admin" }, { status: 500 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  const { email, password } = (body as { email?: string; password?: string }) ?? {};
  if (!email || !password || !verifyCredentials(email, password)) {
    return Response.json({ error: "Email hoặc mật khẩu không đúng" }, { status: 401 });
  }
  (await cookies()).set(ADMIN_COOKIE, signSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  return Response.json({ ok: true });
}
```

- [ ] **Step 7: Viết `src/app/api/admin/logout/route.ts`**

```ts
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";

export async function POST() {
  (await cookies()).set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return Response.json({ ok: true });
}
```

- [ ] **Step 8: Verify — build + curl login**

Run `npm run build` (Expected: PASS). Rồi `npm run dev`:
```bash
# Sai mật khẩu → 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" -d '{"email":"admin@digitalunicorn.fr","password":"sai"}'
# Đúng → 200 + Set-Cookie mo_admin
curl -s -i -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@digitalunicorn.fr","password":"<mật khẩu thật>"}' | grep -i "set-cookie\|HTTP/"
```
Expected: lần 1 in `401`; lần 2 in `HTTP/1.1 200` + header `set-cookie: mo_admin=...`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/admin-auth.ts src/lib/admin-auth.test.ts src/app/api/admin/login/route.ts src/app/api/admin/logout/route.ts
git commit -m "feat: đăng nhập admin (env-cred + cookie ký HMAC)"
```

---

### Task 8: Trang đăng nhập admin `/admin/login`

**Files:**
- Create: `src/app/admin/login/page.tsx`
- Create: `src/components/AdminLogin.tsx`

**Interfaces:**
- Consumes: `isAdmin` từ `@/lib/admin-auth` (Task 7); `redirect` từ `next/navigation`; API `POST /api/admin/login` (Task 7); `Button`.

- [ ] **Step 1: Viết `src/app/admin/login/page.tsx`**

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLogin } from "@/components/AdminLogin";
import { isAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Đăng nhập Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <main className="flex flex-1 items-center justify-center bg-cream px-5 py-16">
      <AdminLogin />
    </main>
  );
}
```

- [ ] **Step 2: Viết `src/components/AdminLogin.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/Button";

const input =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink " +
  "placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary";

export function AdminLogin() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Đăng nhập thất bại");
        setLoading(false);
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Không kết nối được. Vui lòng thử lại.");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm rounded-3xl border border-line bg-white px-8 py-10 shadow-card"
    >
      <h1 className="text-2xl font-extrabold text-ink">Đăng nhập Admin</h1>
      <p className="mt-2 text-sm text-ink-faded">Quản lý check-in Mama Ơi Day</p>
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-primary-faded px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-6 space-y-4">
        <input name="email" type="email" autoComplete="username" placeholder="Email" className={input} required />
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Mật khẩu"
          className={input}
          required
        />
      </div>
      <Button type="submit" disabled={loading} className="mt-6 w-full">
        {loading ? "Đang đăng nhập..." : "Đăng nhập"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Verify — build + trình duyệt**

Run `npm run build` (Expected: PASS). Rồi `npm run dev`, mở `/admin/login`:
- Nhập sai → hiện "Email hoặc mật khẩu không đúng".
- Nhập đúng → chuyển tới `/admin` (Task 10 chưa có sẽ 404/redirect-loop tạm thời; chỉ cần xác nhận đăng nhập set cookie và điều hướng — kiểm cookie `mo_admin` trong DevTools → Application → Cookies).

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/login/page.tsx src/components/AdminLogin.tsx
git commit -m "feat: trang đăng nhập admin"
```

---

### Task 9: API admin — danh sách + cập nhật check-in

**Files:**
- Create: `src/app/api/admin/registrations/route.ts`
- Create: `src/app/api/admin/checkin/route.ts`

**Interfaces:**
- Consumes: `isAdmin` từ `@/lib/admin-auth`; `listRegistrations`, `adminUpdateCheckin` từ `@/lib/supabase`.
- Produces:
  - `GET /api/admin/registrations` → `{ ok, rows: RegistrationRow[] }` (401 nếu chưa đăng nhập)
  - `POST /api/admin/checkin` nhận `{ id, checkedIn, checkedInAt }` → `{ ok, row }` (401 nếu chưa đăng nhập)

- [ ] **Step 1: Viết `src/app/api/admin/registrations/route.ts`**

```ts
import { isAdmin } from "@/lib/admin-auth";
import { listRegistrations } from "@/lib/supabase";

export async function GET() {
  if (!(await isAdmin())) {
    return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  try {
    const rows = await listRegistrations();
    return Response.json({ ok: true, rows });
  } catch (err) {
    console.error("[admin/registrations] failed:", err);
    return Response.json({ error: "Không tải được danh sách" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Viết `src/app/api/admin/checkin/route.ts`**

```ts
import { isAdmin } from "@/lib/admin-auth";
import { adminUpdateCheckin } from "@/lib/supabase";

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  const { id, checkedIn, checkedInAt } =
    (body as { id?: string; checkedIn?: boolean; checkedInAt?: string | null }) ?? {};
  if (!id || typeof checkedIn !== "boolean") {
    return Response.json({ error: "Thiếu dữ liệu" }, { status: 400 });
  }
  try {
    const row = await adminUpdateCheckin(id, checkedIn, checkedIn ? (checkedInAt ?? null) : null);
    return Response.json({ ok: true, row });
  } catch (err) {
    console.error("[admin/checkin] failed:", err);
    return Response.json({ error: "Cập nhật thất bại" }, { status: 502 });
  }
}
```

- [ ] **Step 3: Verify — build + curl (có/không cookie)**

Run `npm run build` (Expected: PASS). Rồi `npm run dev`:
```bash
# Không cookie → 401
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/admin/registrations
# Có cookie (đăng nhập trước, lưu cookie)
curl -s -c /tmp/mo.txt -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@digitalunicorn.fr","password":"<mật khẩu thật>"}' >/dev/null
curl -s -b /tmp/mo.txt http://localhost:3000/api/admin/registrations | head -c 300
```
Expected: lần 1 in `401`; lần 2 trả `{"ok":true,"rows":[...]}` chứa các đăng ký thật.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/registrations/route.ts src/app/api/admin/checkin/route.ts
git commit -m "feat: API admin danh sách + cập nhật check-in (có guard)"
```

---

### Task 10: Bảng điều khiển admin `/admin`

**Files:**
- Create: `src/app/admin/page.tsx`
- Create: `src/components/AdminDashboard.tsx`

**Interfaces:**
- Consumes: `isAdmin`, `listRegistrations`, `RegistrationRow` từ lib; `redirect` từ `next/navigation`; `isoToVNLocalInput`, `vnLocalInputToISO` từ `@/lib/time`; API `GET /api/admin/registrations`, `POST /api/admin/checkin`, `POST /api/admin/logout`.

- [ ] **Step 1: Viết `src/app/admin/page.tsx`**

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/AdminDashboard";
import { isAdmin } from "@/lib/admin-auth";
import { listRegistrations } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Admin — Check-in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const rows = await listRegistrations();
  return <AdminDashboard initialRows={rows} />;
}
```

- [ ] **Step 2: Viết `src/components/AdminDashboard.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { RegistrationRow } from "@/lib/supabase";
import { isoToVNLocalInput, vnLocalInputToISO } from "@/lib/time";

export function AdminDashboard({ initialRows }: { initialRows: RegistrationRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.ho_ten.toLowerCase().includes(s) ||
        r.sdt.includes(s) ||
        r.checkin_code.toLowerCase().includes(s),
    );
  }, [rows, q]);

  const checkedInCount = rows.filter((r) => r.checked_in).length;

  async function refresh() {
    const res = await fetch("/api/admin/registrations");
    if (res.ok) {
      const data = await res.json();
      setRows(data.rows as RegistrationRow[]);
    }
  }

  async function update(id: string, checkedIn: boolean, checkedInAt: string | null) {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, checkedIn, checkedInAt }),
      });
      if (res.ok) {
        const data = await res.json();
        setRows((prev) => prev.map((r) => (r.id === id ? (data.row as RegistrationRow) : r)));
      }
    } finally {
      setBusy(null);
    }
  }

  function toggle(r: RegistrationRow) {
    if (r.checked_in) update(r.id, false, null);
    else update(r.id, true, new Date().toISOString());
  }

  function editTime(r: RegistrationRow, localValue: string) {
    if (!localValue) return;
    update(r.id, true, vnLocalInputToISO(localValue));
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <main className="flex-1 bg-cream">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-ink">Check-in — Mama Ơi Day</h1>
            <p className="mt-1 text-sm text-ink-faded">
              Đã check-in: <strong className="text-success">{checkedInCount}</strong> / {rows.length}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={refresh}
              className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-primary-faded-hover"
            >
              Làm mới
            </button>
            <button
              onClick={logout}
              className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink-faded hover:bg-primary-faded-hover"
            >
              Đăng xuất
            </button>
          </div>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên, SĐT hoặc mã..."
          className="mt-6 w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:max-w-md"
        />

        <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line text-ink-faded">
              <tr>
                <th className="px-4 py-3 font-semibold">Họ tên</th>
                <th className="px-4 py-3 font-semibold">SĐT</th>
                <th className="px-4 py-3 font-semibold">Tỉnh/Thành</th>
                <th className="px-4 py-3 font-semibold">Tình trạng</th>
                <th className="px-4 py-3 font-semibold">Chồng</th>
                <th className="px-4 py-3 font-semibold">Check-in</th>
                <th className="px-4 py-3 font-semibold">Giờ check-in</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ink">{r.ho_ten}</div>
                    <div className="text-xs text-ink-faded">{r.checkin_code}</div>
                  </td>
                  <td className="px-4 py-3 text-ink">{r.sdt}</td>
                  <td className="px-4 py-3 text-ink">{r.tinh_thanh}</td>
                  <td className="px-4 py-3 text-ink">
                    {r.trang_thai === "mang_thai"
                      ? "Mang thai"
                      : `Đã sinh${r.be_thang_tuoi != null ? ` · ${r.be_thang_tuoi}th` : ""}`}
                  </td>
                  <td className="px-4 py-3 text-ink">{r.di_cung_chong ? "Có" : "—"}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggle(r)}
                      disabled={busy === r.id}
                      className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${
                        r.checked_in
                          ? "bg-success text-white"
                          : "border border-line bg-white text-ink-faded hover:bg-primary-faded"
                      }`}
                    >
                      {r.checked_in ? "✓ Đã check-in" : "Tick check-in"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {r.checked_in ? (
                      <input
                        type="datetime-local"
                        defaultValue={r.checked_in_at ? isoToVNLocalInput(r.checked_in_at) : ""}
                        onChange={(e) => editTime(r, e.target.value)}
                        className="rounded-lg border border-line bg-white px-2 py-1 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    ) : (
                      <span className="text-xs text-ink-placeholder">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify — build + E2E trình duyệt**

Run `npm run build` (Expected: PASS). Rồi `npm run dev`:
- Chưa đăng nhập, mở `/admin` → tự chuyển `/admin/login`.
- Đăng nhập đúng → thấy bảng danh sách đăng ký thật, dòng tổng "Đã check-in: X / Y".
- Bấm "Tick check-in" một dòng → nút thành "✓ Đã check-in" (nền xanh), ô giờ xuất hiện với giờ hiện tại (giờ VN). Sửa giờ trong ô → giữ nguyên giá trị vừa sửa sau khi lưu.
- Ở tab khác, tự check-in một mã qua `/check-in/[code]`, quay lại `/admin` bấm "Làm mới" → dòng đó hiện đã check-in (nguồn QR).
- Tìm kiếm theo tên/SĐT/mã → danh sách lọc đúng.
- Bấm "Đăng xuất" → về `/admin/login`; mở lại `/admin` → bị chặn.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx src/components/AdminDashboard.tsx
git commit -m "feat: bảng điều khiển admin check-in"
```

---

### Task 11: Hoàn tất — cập nhật `.env.example`, kiểm thử toàn bộ

**Files:**
- Modify: `.env.example` (thêm khối Supabase + Admin + Site URL)

- [ ] **Step 1: Cập nhật `.env.example`**

Thêm vào cuối `.env.example` (chỉ key rỗng, KHÔNG giá trị thật):
```
# --- Supabase (kho đăng ký + trạng thái check-in) ---
SUPABASE_URL=https://ynebuselhjttlvbfpklb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=      # service role key (chỉ dùng server-side)

# --- Admin (/admin) ---
ADMIN_EMAIL=                    # email đăng nhập admin
ADMIN_PASSWORD=                 # mật khẩu admin (chỉ đặt ở .env.local)
ADMIN_SESSION_SECRET=           # chuỗi ngẫu nhiên ký cookie (openssl rand -base64 32)

# --- Base URL cho QR/đường dẫn check-in (tuỳ chọn, mặc định https://mamaoi.vn) ---
NEXT_PUBLIC_SITE_URL=https://mamaoi.vn
```

- [ ] **Step 2: Kiểm thử toàn bộ**

Run:
```bash
npm test
npm run lint
npm run build
```
Expected: `npm test` PASS (time, validation, admin-auth); `npm run lint` không lỗi; `npm run build` thành công. Xác nhận build không còn nhắc `google-auth-library` hay `@/lib/sheets`.

- [ ] **Step 3: Rà soát bảo mật cuối**

Run:
```bash
git grep -nE "digitalunicorn@123|SUPABASE_SERVICE_ROLE_KEY *= *ey|sbp_" -- . ':!*.md' || echo "OK - khong co bi mat trong source"
```
Expected: in `OK - khong co bi mat trong source` (không có mật khẩu/khoá thật lọt vào file theo dõi bởi git).

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "docs: cập nhật .env.example cho Supabase + admin, bỏ Google"
```

---

## Ghi chú vận hành (ngoài code)

- **Trước sự kiện:** điền đủ env trên **Vercel** (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `NEXT_PUBLIC_SITE_URL`) và deploy. Bảng `registrations` đã tạo ở Task 1.
- **Back-fill:** nếu log `[dang-ky] Supabase insert failed` xuất hiện, mẹ đó có trong Brevo nhưng thiếu dòng Supabase → thêm tay vào `/admin` không được (chưa có dòng); cần chèn dòng từ dữ liệu Brevo trước, hoặc để mẹ đăng ký lại (upsert theo email sẽ tự tạo dòng).
- **Không cổng thời gian** (theo quyết định): mẹ có thể tự check-in sớm; đường quét tại quầy + `/admin` (sửa/bỏ tick) là đường kiểm soát.

## Ngoài phạm vi (không làm ở plan này)

- Đồng bộ "đã tham dự" ngược về Brevo; realtime dashboard; rate-limit `/api/check-in`; đa tài khoản admin; xuất CSV; test Playwright tự động (đã có Playwright, có thể thêm sau).
