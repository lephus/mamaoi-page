# Admin: Export Excel + Popup chi tiết & QR + Poll 5s — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm ba tính năng cho `/admin`: xuất danh sách đang lọc ra `.xlsx`, popup chi tiết kèm QR check-in khi bấm họ tên, và tự làm mới danh sách mỗi 5 giây.

**Architecture:** Toàn bộ dữ liệu vẫn đi qua các route `/api/admin/*` đã có (guard `isAdmin()`, service role key chỉ ở server). Poll 5s tái dùng `GET /api/admin/registrations`. Export gửi `ids` của các dòng đang lọc lên `POST /api/admin/export`, server đọc lại từ DB rồi dựng `.xlsx` bằng `exceljs`. QR sinh ở server qua `GET /api/admin/qr`. `AdminDashboard` giữ toàn bộ state; modal là hàm hiển thị thuần nhận `row` + callback.

**Tech Stack:** Next.js 16.2.10 (App Router), React 19, TypeScript, Tailwind CSS v4, `exceljs` (thêm mới), `qrcode` (đã có), `@supabase/supabase-js` (đã có), `vitest`.

Spec nguồn: `docs/superpowers/specs/2026-07-16-admin-export-popup-poll-design.md`

## Global Constraints

- **KHÔNG một khoá Supabase nào được lọt vào client.** Không tạo biến `NEXT_PUBLIC_SUPABASE_*`. RLS đang TẮT: một khoá ở client là toàn bộ PII của 500 bà mẹ thành công khai. Đây là lý do Supabase Realtime đã bị bác bỏ — **không được "cải tiến" thành realtime trực tiếp.**
- **Next.js 16**: `cookies()` là async; route handler dùng `Response.json(...)`; KHÔNG dùng `middleware.ts`; guard auth trong từng route.
- **Lint phải sạch sau mỗi task** (`npm run lint`). Repo này bật `react-hooks/exhaustive-deps` và `react-hooks/error-boundaries` — code trong plan đã tính tới; nếu lint vẫn báo, sửa code chứ không tắt rule.
- **Design tokens** dùng lại hệ có sẵn: `bg-primary`, `text-ink`, `text-ink-faded`, `text-ink-placeholder`, `bg-cream`, `border-line`, `bg-primary-faded`, `bg-primary-faded-hover`, `text-success`, `bg-success`, `text-danger`, `shadow-card`. Không tự chế màu.
- **Copy tiếng Việt**, có dấu, giọng ấm áp như phần còn lại của trang.
- **`vitest` chỉ chạy `src/**/*.test.ts`** (xem `vitest.config.ts`) — chỉ unit-test logic thuần `.ts`, KHÔNG viết test `.tsx` (sẽ không được chạy).
- Sau mỗi task: commit nhỏ, thông điệp tiếng Việt.
- **Quét bí mật trước mỗi commit.** KHÔNG loại trừ `*.md` — lệnh quét của plan cũ
  dùng `':!*.md'` nên in "OK" trong khi mật khẩu nằm chình ình trong hai file `.md`.
  Pattern dưới đây cố ý viết sao cho **không tự khớp chính nó** (dùng lớp ký tự
  `[0-9]`, `[A-Z]` thay vì gõ thẳng giá trị), nếu không chính tài liệu này sẽ làm
  máy quét báo động giả mãi mãi:
  ```bash
  git diff --cached | grep -nE "sbp_[a-f0-9]{20,}|eyJhbGciOi[A-Za-z0-9_-]{20,}|digitalunicorn@[0-9]" && { git reset; exit 1; }
  ```
  Chỉ dùng khi cần soát riêng biến admin (dễ báo động giả trên chính tài liệu):
  `grep -nE "ADMIN[_]PASSWORD=[A-Za-z0-9@!_.-]{3,}"` — khớp giá trị thật, bỏ qua
  dòng `ADMIN_PASSWORD=` rỗng và các lệnh grep.

---

### Task 1: `checkinUrl()` dùng chung cho email và QR admin

Hiện `brevo.ts` ghép URL check-in tay. Task 2 cần đúng URL đó. Ghép lần hai ở nơi khác → hai chỗ trôi lệch → QR trong email và QR trên admin trỏ hai nơi khác nhau, cả hai đều "trông đúng", chỉ lộ ra vào ngày sự kiện. Tách một hàm dùng chung.

**Files:**
- Create: `src/lib/checkin-url.ts`
- Create: `src/lib/checkin-url.test.ts`
- Modify: `src/lib/brevo.ts:162-163` (và dòng 165, 185 do đổi tên biến)

**Interfaces:**
- Consumes: `SITE` từ `@/lib/constants`.
- Produces: `checkinUrl(code: string): string` — dùng bởi Task 2.

- [ ] **Step 1: Viết test thất bại `src/lib/checkin-url.test.ts`**

```ts
import { describe, it, expect, afterEach } from "vitest";
import { checkinUrl } from "@/lib/checkin-url";

const ORIGINAL = process.env.NEXT_PUBLIC_SITE_URL;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL;
});

describe("checkinUrl", () => {
  it("dùng NEXT_PUBLIC_SITE_URL khi được đặt", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://mamaoi-page.vercel.app";
    expect(checkinUrl("MO-23456A")).toBe(
      "https://mamaoi-page.vercel.app/check-in/MO-23456A",
    );
  });

  it("fallback về SITE.url khi không có env", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(checkinUrl("MO-23456A")).toBe("https://mamaoi.vn/check-in/MO-23456A");
  });

  it("không để lại dấu / thừa", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://x.vn";
    expect(checkinUrl("MO-ABCDEF")).toBe("https://x.vn/check-in/MO-ABCDEF");
  });
});
```

- [ ] **Step 2: Chạy để chắc chắn FAIL**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/checkin-url'`.

- [ ] **Step 3: Viết `src/lib/checkin-url.ts`**

```ts
import { SITE } from "./constants";

/**
 * Đích của QR check-in. Email (brevo) và QR trên trang admin BẮT BUỘC dùng chung
 * hàm này — ghép URL riêng ở hai nơi là mầm mống lỗi hai QR trỏ khác nhau, mà
 * cả hai đều trông đúng cho tới ngày sự kiện.
 */
export function checkinUrl(code: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? SITE.url;
  return `${base}/check-in/${code}`;
}
```

- [ ] **Step 4: Chạy test — PASS**

Run: `npm test`
Expected: PASS — 3 test `checkinUrl` xanh, 10 test cũ vẫn xanh (tổng 13).

- [ ] **Step 5: Sửa `src/lib/brevo.ts` — dùng helper chung**

Thêm import (giữ nguyên dòng `import { EVENT, SITE } from "./constants";` — `SITE` vẫn được dùng ở các dòng 113, 129, 209, 215, 218):

```ts
import { checkinUrl } from "./checkin-url";
```

Thay hai dòng 162-163:
```ts
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? SITE.url;
  const checkinUrl = `${base}/check-in/${checkinCode}`;
```
bằng một dòng (đổi tên biến thành `url` để KHÔNG đụng tên hàm vừa import):
```ts
  const url = checkinUrl(checkinCode);
```

Sửa dòng 165 `QRCode.toDataURL(checkinUrl, {` → `QRCode.toDataURL(url, {`

Sửa dòng 185 `<a href="${checkinUrl}"` → `<a href="${url}"`

- [ ] **Step 6: Verify — lint + build + test**

Run: `npm run lint && npm run build && npm test`
Expected: lint không lỗi; build `✓ Compiled successfully`; test 13/13 PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/checkin-url.ts src/lib/checkin-url.test.ts src/lib/brevo.ts
git commit -m "refactor: tách checkinUrl dùng chung cho email và QR admin"
```

---

### Task 2: Route QR cho admin — `GET /api/admin/qr`

**Files:**
- Create: `src/app/api/admin/qr/route.ts`

**Interfaces:**
- Consumes: `isAdmin` từ `@/lib/admin-auth`; `checkinUrl` từ `@/lib/checkin-url` (Task 1); `isValidCheckinCode` từ `@/lib/validation`.
- Produces: `GET /api/admin/qr?code=MO-XXXXXX` → PNG (`image/png`); 401 chưa đăng nhập; 400 mã sai định dạng. Dùng bởi Task 5.

- [ ] **Step 1: Viết `src/app/api/admin/qr/route.ts`**

```ts
import QRCode from "qrcode";
import { isAdmin } from "@/lib/admin-auth";
import { checkinUrl } from "@/lib/checkin-url";
import { isValidCheckinCode } from "@/lib/validation";

/**
 * QR sinh ở server (không ở trình duyệt): tái dùng đúng thư viện `qrcode` mà
 * email đang dùng, không phình bundle admin, và không rủi ro bundle `qrcode`
 * cho browser. Ảnh chỉ chứa URL check-in — nhưng URL đó chính là thứ dùng để
 * check-in, nên route vẫn phải chặn 401 như mọi route admin khác.
 */
export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  const code = new URL(request.url).searchParams.get("code") ?? "";
  if (!isValidCheckinCode(code)) {
    return Response.json({ error: "Mã không hợp lệ" }, { status: 400 });
  }
  try {
    const png = await QRCode.toBuffer(checkinUrl(code), {
      width: 480,
      margin: 2,
      color: { dark: "#292929", light: "#ffffff" },
    });
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[admin/qr] failed:", err);
    return Response.json({ error: "Không tạo được QR" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Verify — build + curl (một lệnh shell duy nhất)**

Chạy đúng MỘT lệnh dưới đây. Server được khởi động một lần và kill ngay trong cùng lệnh — KHÔNG background `npm run dev` rồi để đó (bài học đã ghi trong `.superpowers/sdd/progress.md`).

```bash
npm run build 2>&1 | grep -E "Compiled successfully|Failed" && \
npm run dev > /tmp/mo-dev.log 2>&1 &
DEV_PID=$!
trap 'kill $DEV_PID 2>/dev/null; pkill -P $DEV_PID 2>/dev/null' EXIT
for i in $(seq 1 60); do grep -q "Ready in" /tmp/mo-dev.log 2>/dev/null && break; sleep 0.5; done
echo "khong cookie -> $(curl -s -o /dev/null -w '%{http_code}' 'http://localhost:3000/api/admin/qr?code=MO-23456A')"
```
Expected: in `khong cookie -> 401`.

Sau khi lệnh kết thúc, kiểm tra không còn process rác: `pgrep -x node` phải rỗng.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/qr/route.ts
git commit -m "feat: route QR check-in cho trang admin"
```

---

### Task 3: `rowsToSheet()` — map dữ liệu sang bảng tính

Tách riêng phần dễ sai nhất của export (map 15 cột, dịch enum, đổi giờ) thành hàm thuần test được. `exceljs` chỉ nhận kết quả và lo định dạng.

**Files:**
- Create: `src/lib/export-rows.ts`
- Create: `src/lib/export-rows.test.ts`

**Interfaces:**
- Consumes: `RegistrationRow` từ `@/lib/supabase`; `formatCheckinTime` từ `@/lib/time`.
- Produces: `rowsToSheet(rows: RegistrationRow[]): { headers: string[]; rows: (string | number)[][] }` — dùng bởi Task 4.

- [ ] **Step 1: Viết test thất bại `src/lib/export-rows.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { rowsToSheet } from "@/lib/export-rows";
import type { RegistrationRow } from "@/lib/supabase";

const base: RegistrationRow = {
  id: "uuid-1",
  created_at: "2026-07-20T03:00:00.000Z", // 10:00 20/07/2026 giờ VN
  checkin_code: "MO-23456A",
  ho_ten: "Nguyễn Thị Lan",
  email: "lan@example.com",
  sdt: "0901234567",
  facebook: null,
  tinh_thanh: "TP.HCM",
  trang_thai: "mang_thai",
  be_thang_tuoi: null,
  di_cung_chong: true,
  dong_y_nhan_tin: true,
  nguon: "su-kien",
  checked_in: false,
  checked_in_at: null,
  checked_in_source: null,
};

describe("rowsToSheet", () => {
  it("có đúng 15 cột và không lộ id", () => {
    const { headers } = rowsToSheet([base]);
    expect(headers).toHaveLength(15);
    expect(headers).not.toContain("id");
    expect(headers[0]).toBe("Họ tên");
  });

  it("mỗi dòng dữ liệu khớp số cột của header", () => {
    const { headers, rows } = rowsToSheet([base]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(headers.length);
  });

  it("dịch trang_thai sang tiếng Việt", () => {
    expect(rowsToSheet([base]).rows[0]).toContain("Mang thai");
    expect(
      rowsToSheet([{ ...base, trang_thai: "da_sinh", be_thang_tuoi: 6 }]).rows[0],
    ).toContain("Đã sinh");
  });

  it("boolean thành Có / dấu gạch", () => {
    const r = rowsToSheet([{ ...base, di_cung_chong: false }]).rows[0];
    expect(r).toContain("—");
  });

  it("trường rỗng thành chuỗi rỗng, không phải null hay 'null'", () => {
    const r = rowsToSheet([base]).rows[0];
    expect(r).not.toContain(null);
    expect(r).not.toContain("null");
  });

  it("đổi giờ đăng ký sang giờ VN", () => {
    expect(rowsToSheet([base]).rows[0]).toContain("10:00 20/07/2026");
  });

  it("dòng chưa check-in để trống cột giờ check-in", () => {
    const { headers, rows } = rowsToSheet([base]);
    expect(rows[0][headers.indexOf("Giờ check-in")]).toBe("");
  });

  it("dòng đã check-in hiện giờ VN và nguồn", () => {
    const { headers, rows } = rowsToSheet([
      { ...base, checked_in: true, checked_in_at: "2026-08-30T02:30:00.000Z", checked_in_source: "qr" },
    ]);
    expect(rows[0][headers.indexOf("Giờ check-in")]).toBe("09:30 30/08/2026");
    expect(rows[0][headers.indexOf("Nguồn check-in")]).toBe("qr");
  });

  it("danh sách rỗng vẫn trả header", () => {
    const { headers, rows } = rowsToSheet([]);
    expect(headers).toHaveLength(15);
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Chạy để chắc chắn FAIL**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/export-rows'`.

- [ ] **Step 3: Viết `src/lib/export-rows.ts`**

```ts
import type { RegistrationRow } from "./supabase";
import { formatCheckinTime } from "./time";

/**
 * 15 cột = toàn bộ RegistrationRow trừ `id` (khoá nội bộ, vô nghĩa với ops).
 * Thứ tự cột này là thứ tự cột trong file Excel — đổi ở đây là đổi file.
 */
const HEADERS = [
  "Họ tên",
  "Email",
  "SĐT",
  "Facebook",
  "Tỉnh/Thành",
  "Tình trạng",
  "Bé (tháng tuổi)",
  "Đi cùng chồng",
  "Đồng ý nhận tin",
  "Mã check-in",
  "Nguồn đăng ký",
  "Thời điểm đăng ký",
  "Đã check-in",
  "Giờ check-in",
  "Nguồn check-in",
] as const;

const yesNo = (v: boolean) => (v ? "Có" : "—");

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
      r.trang_thai === "mang_thai" ? "Mang thai" : "Đã sinh",
      r.be_thang_tuoi ?? "",
      yesNo(r.di_cung_chong),
      yesNo(r.dong_y_nhan_tin),
      r.checkin_code,
      r.nguon,
      formatCheckinTime(r.created_at),
      yesNo(r.checked_in),
      r.checked_in_at ? formatCheckinTime(r.checked_in_at) : "",
      r.checked_in_source ?? "",
    ]),
  };
}
```

- [ ] **Step 4: Chạy test — PASS**

Run: `npm test`
Expected: PASS — 9 test `rowsToSheet` xanh, tổng 22/22.

- [ ] **Step 5: Verify lint**

Run: `npm run lint`
Expected: không lỗi.

- [ ] **Step 6: Commit**

```bash
git add src/lib/export-rows.ts src/lib/export-rows.test.ts
git commit -m "feat: hàm map dữ liệu đăng ký sang bảng tính"
```

---

### Task 4: Export `.xlsx` — dependency, route, nút bấm

**Files:**
- Modify: `package.json` (thêm `exceljs`)
- Create: `src/app/api/admin/export/route.ts`
- Modify: `src/components/AdminDashboard.tsx`

**Interfaces:**
- Consumes: `isAdmin` từ `@/lib/admin-auth`; `listRegistrations` từ `@/lib/supabase`; `rowsToSheet` từ `@/lib/export-rows` (Task 3); `isoToVNLocalInput` từ `@/lib/time`.
- Produces: `POST /api/admin/export` nhận `{ ids: string[] }` → file `.xlsx`; 401 chưa đăng nhập; 400 body sai.

- [ ] **Step 1: Cài dependency**

Run:
```bash
npm install exceljs
```

Lý do dùng `exceljs` chứ không phải `xlsx`: bản `xlsx` trên npm đã lỗi thời và dính CVE (SheetJS đã chuyển sang tự phát hành).

- [ ] **Step 2: Viết `src/app/api/admin/export/route.ts`**

```ts
import ExcelJS from "exceljs";
import { isAdmin } from "@/lib/admin-auth";
import { rowsToSheet } from "@/lib/export-rows";
import { listRegistrations } from "@/lib/supabase";
import { isoToVNLocalInput } from "@/lib/time";

/**
 * Nhận `ids` của các dòng đang hiển thị sau khi lọc, KHÔNG nhận chuỗi tìm kiếm
 * và KHÔNG nhận dữ liệu dòng:
 *  - server tự lọc lại theo `q` → logic lọc tồn tại hai nơi, sẽ trôi lệch;
 *  - nhận thẳng dữ liệu client → server tin dữ liệu client khai.
 * Gửi `ids` giữ một nguồn lọc duy nhất (client) và một nguồn dữ liệu duy nhất (DB).
 */
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
  const { ids } = (body as { ids?: unknown }) ?? {};
  if (!Array.isArray(ids) || ids.some((i) => typeof i !== "string")) {
    return Response.json({ error: "Thiếu danh sách id" }, { status: 400 });
  }

  try {
    const wanted = new Set(ids as string[]);
    const rows = (await listRegistrations()).filter((r) => wanted.has(r.id));
    const { headers, rows: data } = rowsToSheet(rows);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Check-in");
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    for (const r of data) ws.addRow(r);
    // `headers[i]` có thể undefined nếu exceljs trả nhiều cột hơn header — đừng
    // để một file export làm sập route bằng một TypeError.
    ws.columns.forEach((c, i) => {
      c.width = Math.max((headers[i]?.length ?? 14) + 2, 16);
    });

    const buf = await wb.xlsx.writeBuffer();
    const stamp = isoToVNLocalInput(new Date().toISOString()).slice(0, 10);
    return new Response(new Uint8Array(buf as ArrayBuffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="mamaoi-day-checkin-${stamp}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("[admin/export] failed:", err);
    return Response.json({ error: "Xuất file thất bại" }, { status: 502 });
  }
}
```

- [ ] **Step 3: Thêm nút Export vào `src/components/AdminDashboard.tsx`**

Thêm state ngay dưới `const [busy, setBusy] = useState<string | null>(null);`:
```tsx
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
```

Thêm hàm ngay trên `async function logout() {`:
```tsx
  /** Xuất đúng các dòng đang hiển thị (WYSIWYG) — server đọc lại từ DB theo id. */
  async function exportXlsx() {
    setExporting(true);
    setExportError("");
    try {
      const res = await fetch("/api/admin/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: filtered.map((r) => r.id) }),
      });
      if (!res.ok) {
        setExportError("Xuất file thất bại");
        return;
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ?? "mamaoi-day-checkin.xlsx";
      a.click();
      URL.revokeObjectURL(href);
    } catch {
      setExportError("Không kết nối được. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  }
```

Thêm nút vào khối `<div className="flex gap-2">`, NGAY TRƯỚC nút "Làm mới":
```tsx
            <button
              onClick={exportXlsx}
              disabled={exporting || filtered.length === 0}
              className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-primary-faded-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? "Đang xuất..." : `Xuất Excel (${filtered.length})`}
            </button>
```

Thêm dòng báo lỗi ngay SAU ô input tìm kiếm (`<input value={q} ... />`):
```tsx
        {exportError && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {exportError}
          </p>
        )}
```

- [ ] **Step 4: Verify — lint + build + test**

Run: `npm run lint && npm run build && npm test`
Expected: lint sạch; build `✓ Compiled successfully` và route table có `ƒ /api/admin/export`; test 22/22 PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/app/api/admin/export/route.ts src/components/AdminDashboard.tsx
git commit -m "feat: xuất danh sách đang lọc ra file Excel"
```

---

### Task 5: Popup chi tiết + QR

**Files:**
- Create: `src/components/AdminDetailModal.tsx`
- Modify: `src/components/AdminDashboard.tsx`

**Interfaces:**
- Consumes: `RegistrationRow` từ `@/lib/supabase`; `formatCheckinTime`, `isoToVNLocalInput` từ `@/lib/time`; route `GET /api/admin/qr` (Task 2).
- Produces: `AdminDetailModal({ row, busy, onClose, onToggle, onEditTime })`.

- [ ] **Step 1: Viết `src/components/AdminDetailModal.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import type { RegistrationRow } from "@/lib/supabase";
import { formatCheckinTime, isoToVNLocalInput } from "@/lib/time";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/60 py-2 last:border-0">
      <span className="text-sm text-ink-faded">{label}</span>
      <span className="text-right text-sm font-semibold text-ink">{value || "—"}</span>
    </div>
  );
}

/**
 * Hàm hiển thị thuần của `row`: không tự fetch, không giữ bản sao dòng. Tick và
 * sửa giờ đi qua đúng callback mà bảng dùng, nên hai nơi không thể lệch nhau.
 */
export function AdminDetailModal({
  row,
  busy,
  onClose,
  onToggle,
  onEditTime,
}: {
  row: RegistrationRow;
  busy: boolean;
  onClose: () => void;
  onToggle: (r: RegistrationRow) => void;
  onEditTime: (r: RegistrationRow, localValue: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Chi tiết ${row.ho_ten}`}
        className="w-full max-w-lg rounded-3xl border border-line bg-white p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-ink">{row.ho_ten}</h2>
            <p className="mt-1 text-sm text-ink-faded">{row.tinh_thanh}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-full border border-line px-3 py-1 text-sm text-ink-faded hover:bg-primary-faded-hover"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-cream p-4 text-center">
          <img
            src={`/api/admin/qr?code=${encodeURIComponent(row.checkin_code)}`}
            alt={`QR check-in của ${row.ho_ten}`}
            width={240}
            height={240}
            className="mx-auto h-60 w-60 rounded-xl bg-white"
          />
          <p className="mt-3 text-2xl font-extrabold tracking-widest text-primary">
            {row.checkin_code}
          </p>
          <p className="mt-1 text-xs text-ink-faded">Mẹ mất email? Đưa mã này cho mẹ quét.</p>
        </div>

        <div className="mt-4">
          <Field label="Email" value={row.email} />
          <Field label="SĐT" value={row.sdt} />
          <Field label="Facebook" value={row.facebook ?? ""} />
          <Field
            label="Tình trạng"
            value={
              row.trang_thai === "mang_thai"
                ? "Mang thai"
                : `Đã sinh${row.be_thang_tuoi != null ? ` · bé ${row.be_thang_tuoi} tháng` : ""}`
            }
          />
          <Field label="Đi cùng chồng" value={row.di_cung_chong ? "Có" : "—"} />
          <Field label="Đồng ý nhận tin" value={row.dong_y_nhan_tin ? "Có" : "—"} />
          <Field label="Nguồn đăng ký" value={row.nguon} />
          <Field label="Thời điểm đăng ký" value={formatCheckinTime(row.created_at)} />
          <Field label="Nguồn check-in" value={row.checked_in_source ?? ""} />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={() => onToggle(row)}
            disabled={busy}
            className={`rounded-full px-5 py-2 text-sm font-bold transition-colors disabled:opacity-50 ${
              row.checked_in
                ? "bg-success text-white"
                : "border border-line bg-white text-ink-faded hover:bg-primary-faded"
            }`}
          >
            {row.checked_in ? "✓ Đã check-in" : "Tick check-in"}
          </button>
          {row.checked_in && (
            <input
              type="datetime-local"
              defaultValue={row.checked_in_at ? isoToVNLocalInput(row.checked_in_at) : ""}
              onChange={(e) => onEditTime(row, e.target.value)}
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

Ghi chú: dùng `<img>` chứ không phải `next/image` — ảnh sinh động từ route API, `next/image` không tối ưu được gì mà còn thêm ràng buộc cấu hình. Nếu lint báo `@next/next/no-img-element`, thêm `{/* eslint-disable-next-line @next/next/no-img-element */}` ngay trên thẻ và giữ nguyên `<img>`.

- [ ] **Step 2: Nối modal vào `src/components/AdminDashboard.tsx`**

Thêm import:
```tsx
import { AdminDetailModal } from "./AdminDetailModal";
```

Thêm state dưới `const [exportError, setExportError] = useState("");`:
```tsx
  const [openId, setOpenId] = useState<string | null>(null);
```

Thêm ngay trên `return (` — lấy dòng từ `rows` chứ không lưu bản sao, để poll cập nhật là modal cập nhật theo, và dòng biến mất thì modal tự đóng:
```tsx
  const openRow = openId ? (rows.find((r) => r.id === openId) ?? null) : null;
```

Đổi ô họ tên trong `<tbody>` từ:
```tsx
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ink">{r.ho_ten}</div>
                    <div className="text-xs text-ink-faded">{r.checkin_code}</div>
                  </td>
```
thành (dùng `<button>` để bàn phím bấm được):
```tsx
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setOpenId(r.id)}
                      className="text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                    >
                      <div className="font-semibold text-ink">{r.ho_ten}</div>
                      <div className="text-xs text-ink-faded">{r.checkin_code}</div>
                    </button>
                  </td>
```

Thêm ngay TRƯỚC thẻ đóng `</main>` cuối cùng:
```tsx
      {openRow && (
        <AdminDetailModal
          row={openRow}
          busy={busy === openRow.id}
          onClose={() => setOpenId(null)}
          onToggle={toggle}
          onEditTime={editTime}
        />
      )}
```

- [ ] **Step 3: Verify — lint + build**

Run: `npm run lint && npm run build`
Expected: lint sạch; build `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add src/components/AdminDetailModal.tsx src/components/AdminDashboard.tsx
git commit -m "feat: popup chi tiết người đăng ký kèm QR check-in"
```

---

### Task 6: Tự làm mới mỗi 5 giây

**Files:**
- Modify: `src/components/AdminDashboard.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/registrations` (đã có).

- [ ] **Step 1: Sửa import React trong `src/components/AdminDashboard.tsx`**

Đổi:
```tsx
import { useMemo, useState } from "react";
```
thành:
```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
```

- [ ] **Step 2: Thêm state dừng + ref cho `busy`**

Thêm dưới `const [openId, setOpenId] = useState<string | null>(null);`:
```tsx
  // Phiên hết hạn thì phải dừng hẳn, nếu không poll đẻ ra vòng lặp 401 mỗi 5s.
  const [stopped, setStopped] = useState(false);
  // `busy` đọc qua ref: interval chỉ tạo một lần, không phụ thuộc `busy`.
  // Đồng bộ trong useEffect, KHÔNG gán thẳng khi render (React cấm ghi ref
  // trong lúc render — dễ sai khi StrictMode render hai lần).
  const busyRef = useRef<string | null>(null);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);
```

- [ ] **Step 3: Thay hàm `refresh` cũ bằng bản có xử lý 401**

Thay nguyên khối:
```tsx
  async function refresh() {
    const res = await fetch("/api/admin/registrations");
    if (res.ok) {
      const data = await res.json();
      setRows(data.rows as RegistrationRow[]);
    }
  }
```
bằng:
```tsx
  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/registrations");
    if (res.status === 401) {
      setStopped(true);
      router.replace("/admin/login");
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setRows(data.rows as RegistrationRow[]);
    }
  }, [router]);
```

- [ ] **Step 4: Thêm poll 5s**

Thêm ngay dưới hàm `refresh`:
```tsx
  // Poll thay cho Supabase Realtime: realtime cần một khoá Supabase ở client,
  // mà RLS đang TẮT — khoá ở client là lộ toàn bộ PII của 500 mẹ. Xem spec
  // 2026-07-16-admin-export-popup-poll-design.md.
  useEffect(() => {
    if (stopped) return;
    const id = setInterval(() => {
      // Đang ghi thì bỏ nhịp: phản hồi poll có thể ghi đè kết quả vừa tick.
      // Tab ẩn thì bỏ nhịp: máy ở quầy không gọi API khi nằm trong túi.
      if (busyRef.current || document.hidden) return;
      // Lỗi mạng: bỏ qua nhịp này, giữ dữ liệu cũ — poll là nền, không làm phiền.
      void refresh().catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [refresh, stopped]);
```

- [ ] **Step 5: Verify — lint + build + test**

Run: `npm run lint && npm run build && npm test`
Expected: lint sạch (đặc biệt KHÔNG có cảnh báo `react-hooks/exhaustive-deps`); build `✓ Compiled successfully`; test 22/22 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/AdminDashboard.tsx
git commit -m "feat: tự làm mới danh sách admin mỗi 5 giây"
```

---

### Task 7: Kiểm thử end-to-end trên trình duyệt

Đây là task **bắt buộc**, không được bỏ. Mọi task trước chỉ chứng minh code biên dịch được — task này chứng minh nó chạy đúng. Cần `ADMIN_PASSWORD` trong `.env.local` (hiện đang TRỐNG — nếu vẫn trống, DỪNG và hỏi user).

**Files:** không sửa file nào (chỉ kiểm thử; nếu phát hiện lỗi thì sửa rồi commit riêng).

- [ ] **Step 1: Kiểm tra tiền đề**

```bash
grep -m1 '^ADMIN_PASSWORD=' .env.local | cut -d= -f2- | wc -c
```
Expected: > 1. Nếu bằng 1 (rỗng) → DỪNG, báo user điền `ADMIN_PASSWORD`.

- [ ] **Step 2: Chạy server và kiểm thử tay**

Khởi động server MỘT lần (`npm run dev`), mở `/admin/login`, đăng nhập, rồi kiểm đủ 9 mục dưới. Kill server ngay khi xong; xác nhận `pgrep -x node` rỗng.

- [ ] Poll cập nhật: mở `/admin` ở 2 tab. Tab A tick một dòng → **tab B tự đổi trong ≤5s mà không bấm gì**.
- [ ] Poll không phá thao tác: mở ô sửa giờ, gõ dở, đợi >5s → **chữ đang gõ còn nguyên**.
- [ ] Poll dừng khi hết phiên: xoá cookie `mo_admin` trong DevTools → trong ≤5s bị đá về `/admin/login`, và tab Network **không có chuỗi 401 lặp vô tận**.
- [ ] Poll dừng khi tab ẩn: chuyển sang tab khác >10s, xem Network → **không có request nào trong lúc ẩn**.
- [ ] Export: gõ tìm kiếm để lọc còn vài dòng → bấm "Xuất Excel (N)" → file tải về, **mở bằng Excel thấy dấu tiếng Việt đúng** ("Nguyễn Thị Lan" chứ không phải "Nguyá»…n"), và **chỉ chứa đúng N dòng đã lọc**.
- [ ] Export khi rỗng: gõ chuỗi không khớp gì → nút **bị vô hiệu hoá**.
- [ ] Popup: bấm họ tên → hiện đủ thông tin; **QR quét được bằng camera điện thoại và ra đúng `<base>/check-in/<mã>`**.
- [ ] Popup tick: tick trong popup → **bảng phía sau cập nhật theo**; Escape và bấm nền đều đóng được.
- [ ] QR không rò rỉ: mở `/api/admin/qr?code=MO-23456A` ở cửa sổ ẩn danh (chưa đăng nhập) → **401**.

- [ ] **Step 3: Cập nhật `.superpowers/sdd/progress.md`**

Ghi kết quả thật của từng mục trên: mục nào PASS, mục nào FAIL, mục nào chưa kiểm được và vì sao. **Không ghi "đã xong" cho mục chưa thực sự chạy.**

- [ ] **Step 4: Commit**

```bash
git add .superpowers/sdd/progress.md
git commit -m "docs: kết quả kiểm thử e2e cho export/popup/poll"
```
