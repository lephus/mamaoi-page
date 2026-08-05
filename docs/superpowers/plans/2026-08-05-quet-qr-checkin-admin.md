# Admin quét QR check-in hộ các mẹ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nhân viên quầy mở `/admin/quet-qr` trên điện thoại, quét mã QR của mẹ để check-in hộ; lượt check-in đó mang nhãn `(Admin CheckIn)` trong bảng `/admin`, file Excel và Google Sheet.

**Architecture:** Trang quét riêng, tách khỏi `AdminDashboard.tsx`. Camera đọc QR bằng thư viện `qr-scanner` chạy trong Web Worker; text đọc được đi qua một hàm thuần `maTuQr` để lọc rác; mã hợp lệ thì gọi `GET /api/admin/tra-ma` lấy thẻ xác nhận, rồi ghi qua `POST /api/admin/checkin` — **đúng cái route mà nút tick tay ở `/admin` đang dùng**, nên hai đường không bao giờ trôi lệch. Route đó được nối thêm mirror Google Sheet chạy nền bằng `after()`.

**Tech Stack:** Next.js 16.2.10 (App Router), React 19.2.4, TypeScript, Tailwind v4, Vitest 4, Supabase, Google Sheets API, `qr-scanner` 1.4.2.

**Spec:** `docs/superpowers/specs/2026-08-05-quet-qr-checkin-admin-design.md`

## Global Constraints

- **`AGENTS.md`:** đây KHÔNG phải Next.js quen thuộc. Đọc guide liên quan trong `node_modules/next/dist/docs/` trước khi viết code Next mới.
- **Vitest chỉ chạy `src/**/*.test.ts`** (`vitest.config.ts`), `environment: "node"`. **Không viết test `.tsx`** — nó sẽ không bao giờ chạy, và jsdom chưa cài. Mọi logic cần test phải nằm trong file `.ts` thuần.
- **Nhãn nguồn check-in đúng nguyên văn:** `"(Admin CheckIn)"` cho `admin`, `"(QR)"` cho `qr`, **chuỗi rỗng `""`** cho `null`.
- **Chuỗi hiển thị và comment bằng tiếng Việt.** Định danh dùng tiếng Việt không dấu theo phong cách repo (`maTuQr`, `ghiCheckinVaoSheet`, `nguonCheckinLabel`).
- **Supabase là nguồn chính thức của trạng thái check-in.** Google Sheet hỏng thì `console.error` rồi thôi — không bao giờ làm hỏng lượt check-in.
- **Không báo thành công giả.** Ghi hỏng phải hiện lỗi thật.
- **Không đọc `Date.now()` trong lúc render** (React Compiler cấm — xem doc `CheckinPass.tsx:68-79`).
- **Cổng giờ `daMoCheckin` KHÔNG áp cho đường admin** (`check-in/route.ts:38-39`). Không thêm nó vào bất kỳ file nào của kế hoạch này.
- Chạy `npm test`, `npm run lint`, `npm run build` phải sạch trước mỗi commit.

---

### Task 1: Nhãn `(Admin CheckIn)` / `(QR)` cho Excel và Google Sheet

**Files:**
- Modify: `src/lib/constants.ts` (thêm hàm cuối file, cạnh `trangThaiLabel`)
- Modify: `src/lib/export-rows.ts:57-67` (`checkinCells`)
- Test: `src/lib/export-rows.test.ts:105-110`, `src/lib/sheets.test.ts:225-239`

**Interfaces:**
- Consumes: `THIEU` từ `constants.ts` (chỉ để đối chiếu — **không dùng**)
- Produces: `nguonCheckinLabel(value: "qr" | "admin" | null | undefined): string`

> **CẢNH BÁO — chỗ dễ sai nhất của cả kế hoạch.** Hai hàm hàng xóm `trangThaiLabel` và `nguonBietDenLabel` trả về `THIEU` (`"--"`) khi gặp `null`. `nguonCheckinLabel` **KHÔNG** được làm vậy: nó phải trả **chuỗi rỗng**. Lý do: `"--"` nghĩa là "có hỏi mà chưa có câu trả lời"; còn mẹ chưa check-in thì không có gì để nói, và ô trống mới khớp đúng với ô của dòng vừa append vào Sheet (`sheets.ts:113-117`). Copy nhầm pattern hàng xóm là làm Task 4 sai theo.

- [ ] **Step 1: Sửa test đang chốt chuỗi kỹ thuật `"qr"` trong `export-rows.test.ts`**

Thay assertion ở dòng 108:

```ts
expect(rows[0][headers.indexOf("Nguồn check-in")]).toBe("(QR)");
```

Rồi thêm ngay dưới `it(...)` đó hai ca mới:

```ts
  it("admin check-in hộ thì cột nguồn ghi '(Admin CheckIn)'", () => {
    const { headers, rows } = rowsToSheet([
      {
        ...base,
        checked_in: true,
        checked_in_at: "2026-08-30T02:30:00.000Z",
        checked_in_source: "admin",
      },
    ]);
    expect(rows[0][headers.indexOf("Nguồn check-in")]).toBe("(Admin CheckIn)");
  });

  /* Chưa check-in thì ô nguồn phải TRỐNG, không phải "--". Khác hẳn các cột
     "chưa hỏi" ở trên: mẹ chưa tới quầy thì không có nguồn nào để nói, và ô
     trống đúng bằng ô của dòng Sheet vừa append. */
  it("chưa check-in thì cột nguồn để trống, KHÔNG phải '--'", () => {
    const { headers, rows } = rowsToSheet([base]);
    expect(rows[0][headers.indexOf("Nguồn check-in")]).toBe("");
  });
```

- [ ] **Step 2: Sửa test đang chốt `"qr"` trong `sheets.test.ts`**

Dòng 234:

```ts
    expect(byRange["register!V5"]).toBe("(QR)");
```

- [ ] **Step 3: Chạy test để thấy nó HỎNG**

Run: `npm test -- export-rows sheets`
Expected: FAIL — 3 test đỏ, báo nhận `"qr"` / `""` nhưng chờ `"(QR)"` / `"(Admin CheckIn)"`.

- [ ] **Step 4: Thêm `nguonCheckinLabel` vào `constants.ts`**

Đặt ngay sau `trangThaiLabel` (cuối file):

```ts
/**
 * Nhãn cột "Nguồn check-in" — dùng chung cho file Excel, Google Sheet, bảng
 * /admin và modal chi tiết. Bốn nơi, một chỗ khai.
 *
 * KHÁC hai hàm ngay trên: `null` ở đây trả CHUỖI RỖNG chứ không phải `THIEU`.
 * "--" nghĩa là "có hỏi mà chưa có câu trả lời"; mẹ chưa check-in thì không có
 * gì để nói. Ô trống cũng đúng bằng ô mà `hangDbToSheetRow` ghi cho một dòng
 * vừa append (sheets.ts) — nhờ vậy "bỏ tick" trả Sheet về đúng trạng thái sạch.
 */
export function nguonCheckinLabel(
  value: "qr" | "admin" | null | undefined,
): string {
  if (value === "qr") return "(QR)";
  if (value === "admin") return "(Admin CheckIn)";
  return "";
}
```

- [ ] **Step 5: Cho `checkinCells` dùng nhãn**

Trong `src/lib/export-rows.ts`, sửa dòng import đầu file:

```ts
import {
  chuDeGopLabel,
  nguonBietDenLabel,
  nguonCheckinLabel,
  trangThaiLabel,
} from "./constants";
```

Rồi sửa `checkinCells` (dòng 57-67) — đổi cả kiểu tham số `source` từ `string | null` sang union thật:

```ts
export function checkinCells(
  checkedIn: boolean,
  checkedInAt: string | null,
  source: "qr" | "admin" | null,
): [string, string, string] {
  return [
    yesNo(checkedIn),
    checkedInAt ? formatCheckinTime(checkedInAt) : "",
    nguonCheckinLabel(source),
  ];
}
```

- [ ] **Step 6: Chạy toàn bộ test**

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 7: Lint + build**

Run: `npm run lint && npm run build`
Expected: sạch.

- [ ] **Step 8: Commit**

```bash
git add src/lib/constants.ts src/lib/export-rows.ts src/lib/export-rows.test.ts src/lib/sheets.test.ts
git commit -m "feat: cột Nguồn check-in ghi (Admin CheckIn) / (QR) thay chữ kỹ thuật"
```

---

### Task 2: Hiện nhãn nguồn trong bảng `/admin` và modal chi tiết

**Files:**
- Modify: `src/components/AdminDashboard.tsx:398-411` (ô "Giờ check-in")
- Modify: `src/components/AdminDetailModal.tsx:122`

**Interfaces:**
- Consumes: `nguonCheckinLabel` (Task 1)
- Produces: — (chỉ hiển thị)

> **Không có unit test cho task này** — cả hai file là `.tsx`, mà `vitest.config.ts` chỉ include `src/**/*.test.ts`. Kiểm chứng bằng `npm run build` + `npm run lint` + xem mắt. Đây là hạn chế thật của repo, không phải bước bị bỏ quên.

- [ ] **Step 1: Thêm nhãn dưới ô giờ trong `AdminDashboard.tsx`**

Sửa dòng import (dòng 6):

```ts
import { nguonCheckinLabel, trangThaiLabel } from "@/lib/constants";
```

Thay nguyên khối `<td>` "Giờ check-in" (dòng 398-411) bằng:

```tsx
                        <td className="px-4 py-3">
                          {r.checked_in ? (
                            <>
                              <input
                                type="datetime-local"
                                defaultValue={
                                  r.checked_in_at ? isoToVNLocalInput(r.checked_in_at) : ""
                                }
                                onChange={(e) => editTime(r, e.target.value)}
                                className="rounded-lg border border-line bg-white px-2 py-1 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                              {/* Chú thích AI ghi cái giờ đang nằm ngay trên —
                                  đúng câu hỏi người đọc đang có khi nhìn ô này.
                                  Đặt ở đây thay vì thành cột thứ 8 vì bảng đã
                                  min-w-[760px] và phải cuộn ngang sẵn. */}
                              <div className="mt-1 text-xs text-ink-faded">
                                {nguonCheckinLabel(r.checked_in_source)}
                              </div>
                            </>
                          ) : (
                            <span className="text-xs text-ink-placeholder">—</span>
                          )}
                        </td>
```

- [ ] **Step 2: Sửa modal chi tiết**

Trong `src/components/AdminDetailModal.tsx`, thêm `nguonCheckinLabel` vào import từ `@/lib/constants` (giữ nguyên các tên đang import), rồi sửa dòng 122:

```tsx
          <Field label="Nguồn check-in" value={nguonCheckinLabel(row.checked_in_source)} />
```

- [ ] **Step 3: Lint + build + test**

Run: `npm run lint && npm run build && npm test`
Expected: sạch, không test nào đỏ.

- [ ] **Step 4: Xem mắt**

Run: `npm run dev`, mở `http://localhost:3000/admin`, đăng nhập.
Expected: dòng nào đã check-in thì dưới ô giờ có chữ nhỏ `(QR)` hoặc `(Admin CheckIn)`; dòng chưa check-in vẫn chỉ có `—`. Bấm vào tên mẹ mở modal, dòng "Nguồn check-in" hiện nhãn tương ứng chứ không phải chữ `admin`.

- [ ] **Step 5: Commit**

```bash
git add src/components/AdminDashboard.tsx src/components/AdminDetailModal.tsx
git commit -m "feat: bảng admin và modal hiện nguồn check-in bằng nhãn dễ đọc"
```

---

### Task 3: `maTuQr` — hàm thuần lọc text QR thành mã check-in

**Files:**
- Create: `src/lib/ma-tu-qr.ts`
- Test: `src/lib/ma-tu-qr.test.ts`

**Interfaces:**
- Consumes: `isValidCheckinCode(code: string): boolean` từ `src/lib/validation.ts`
- Produces: `maTuQr(text: string): string | null` — trả mã đã viết HOA (`MO-XXXXXX`), hoặc `null`

- [ ] **Step 1: Viết test trước**

Tạo `src/lib/ma-tu-qr.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { maTuQr } from "@/lib/ma-tu-qr";

const MA = "MO-ABC234";

describe("maTuQr", () => {
  it("rút mã từ URL check-in đầy đủ — dạng QR thật trong email", () => {
    expect(maTuQr(`https://mamaoi.vn/check-in/${MA}`)).toBe(MA);
  });

  it("chịu được query, hash và dấu / thừa ở cuối", () => {
    expect(maTuQr(`https://mamaoi.vn/check-in/${MA}/`)).toBe(MA);
    expect(maTuQr(`https://mamaoi.vn/check-in/${MA}?utm=mail`)).toBe(MA);
    expect(maTuQr(`https://mamaoi.vn/check-in/${MA}#ve`)).toBe(MA);
  });

  it("nhận cả mã trần, phòng QR do nơi khác sinh", () => {
    expect(maTuQr(MA)).toBe(MA);
  });

  it("chuẩn hoá chữ thường và khoảng trắng thừa", () => {
    expect(maTuQr("  mo-abc234  ")).toBe(MA);
    expect(maTuQr(`  https://mamaoi.vn/check-in/${MA.toLowerCase()}  `)).toBe(MA);
  });

  /**
   * CÓ CHỦ ĐÍCH: không kiểm tên miền. Mã mới là vé, tên miền chỉ là trang trí —
   * ai dựng được QR với một mã THẬT thì đã biết mã đó rồi, và có thể đọc miệng
   * cho nhân viên gõ tay. Đổi lại, kiểm tên miền sẽ làm QR sinh trên bản prod
   * quét trên bản preview (vercel.app) là hỏng — đúng lúc đang đi thử máy.
   */
  it("không kiểm tên miền — mã vẫn được rút ra", () => {
    expect(maTuQr(`https://preview-abc.vercel.app/check-in/${MA}`)).toBe(MA);
  });

  it("URL của trang khác trên chính site → null", () => {
    expect(maTuQr("https://mamaoi.vn/su-kien")).toBeNull();
    expect(maTuQr(`https://mamaoi.vn/${MA}`)).toBeNull();
  });

  /* "check-in" nằm trong query chứ không phải đoạn cuối đường dẫn — đây là ca
     mà một phép dò chuỗi "/check-in/" ngây thơ sẽ nuốt nhầm. */
  it("URL lồng mã trong query → null", () => {
    expect(maTuQr(`https://mamaoi.vn/x?next=/check-in/${MA}`)).toBeNull();
  });

  it("QR rác ở quầy (wifi, chuỗi lạ, rỗng) → null, không ném lỗi", () => {
    expect(maTuQr("WIFI:S:MamaOi;T:WPA;P:12345678;;")).toBeNull();
    expect(maTuQr("")).toBeNull();
    expect(maTuQr("   ")).toBeNull();
    expect(maTuQr("xin chào")).toBeNull();
  });

  it("mã sai bảng chữ (có I, O, 0, 1) → null", () => {
    expect(maTuQr("MO-ABC23I")).toBeNull();
    expect(maTuQr("https://mamaoi.vn/check-in/MO-ABC230")).toBeNull();
  });

  it("mã sai độ dài → null", () => {
    expect(maTuQr("MO-ABC23")).toBeNull();
    expect(maTuQr("MO-ABC2345")).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test để thấy nó hỏng**

Run: `npm test -- ma-tu-qr`
Expected: FAIL — không resolve được `@/lib/ma-tu-qr`.

- [ ] **Step 3: Viết `src/lib/ma-tu-qr.ts`**

```ts
import { isValidCheckinCode } from "./validation";

/**
 * Text đọc được từ một mã QR → mã check-in, hoặc `null`.
 *
 * QR trong email chứa CẢ URL (`checkinUrl` trong checkin-url.ts), không phải mã
 * trần — nên phải rút đoạn cuối đường dẫn ra. Vẫn nhận mã trần, phòng QR do nơi
 * khác sinh hoặc nhân viên gõ tay.
 *
 * Trả `null` cho mọi thứ còn lại, và ĐÓ MỚI LÀ VIỆC CHÍNH của hàm này: ở quầy,
 * camera quét trúng QR wifi, QR Momo, QR trên tờ rơi liên tục. Chặn ngay tại
 * đây thì màn hình quét không phải bắn request rác, và không phải nhấp nháy báo
 * lỗi mỗi khung hình.
 *
 * Tách khỏi component vì nó THUẦN — test được đầy đủ mà không cần camera, mà
 * camera thì không unit test được.
 */
export function maTuQr(text: string): string | null {
  const s = text.trim();
  if (!s) return null;

  // Thử đọc như URL trước. Mã trần "MO-ABC234" không parse thành URL nên rơi
  // xuống nhánh catch và được thử tiếp như mã trần.
  //
  // Dùng `new URL` + tách pathname chứ KHÔNG dò chuỗi "/check-in/": một QR
  // chứa "https://mamaoi.vn/x?next=/check-in/MO-ABC234" cũng khớp phép dò đó,
  // và mã phải là ĐOẠN CUỐI đường dẫn thì mới đúng là link check-in.
  let ungVien = s;
  try {
    const doan = new URL(s).pathname.split("/").filter(Boolean);
    if (doan.length < 2 || doan[doan.length - 2] !== "check-in") return null;
    ungVien = doan[doan.length - 1];
  } catch {
    // Không phải URL — để nguyên `ungVien = s` rồi thử như mã trần.
  }

  // KHÔNG kiểm tên miền, có chủ đích: mã mới là vé vào cửa, tên miền chỉ là
  // trang trí. Ai dựng được QR mang một mã THẬT thì đã biết mã đó, và đọc miệng
  // cho nhân viên gõ tay cũng ra kết quả y hệt — chặn tên miền không thêm được
  // lớp bảo vệ nào. Đổi lại, chặn nó sẽ làm QR sinh trên prod quét trên bản
  // preview (*.vercel.app) là hỏng, đúng lúc đang đi thử máy trước sự kiện.
  const ma = ungVien.toUpperCase();
  return isValidCheckinCode(ma) ? ma : null;
}
```

- [ ] **Step 4: Chạy test để thấy nó xanh**

Run: `npm test -- ma-tu-qr`
Expected: PASS toàn bộ.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: sạch.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ma-tu-qr.ts src/lib/ma-tu-qr.test.ts
git commit -m "feat: maTuQr lọc text QR thành mã check-in, chặn QR rác ở quầy"
```

---

### Task 4: `ghiCheckinVaoSheet` — tổng quát hoá để xoá được check-in

**Files:**
- Modify: `src/lib/sheets.ts:402-467` (`buildCheckinUpdate`, `markCheckedInInSheet`)
- Modify: `src/app/api/check-in/route.ts:3,56` (đổi tên hàm gọi)
- Test: `src/lib/sheets.test.ts` (thêm vào `describe("buildCheckinUpdate")`)

**Interfaces:**
- Consumes: `checkinCells(checkedIn, checkedInAt, source: "qr" | "admin" | null)` (Task 1 đã siết kiểu)
- Produces:
  - `buildCheckinUpdate(tab: string, headers: string[], rowNumber: number, checkedInAt: string | null, source: "qr" | "admin" | null): { range: string; values: string[][] }[]`
  - `ghiCheckinVaoSheet(code: string, checkedInAt: string | null, source: "qr" | "admin" | null): Promise<void>`

**Vì sao đổi tên:** sau khi tổng quát, hàm vừa đánh dấu vừa xoá. Giữ tên `markCheckedInInSheet` là để lại một cái tên nói sai việc — đúng loại lỗi mà repo này vốn rất kỹ chuyện tránh (xem doc của `checkinCells`, `checkinUrl`).

- [ ] **Step 1: Viết test cho đường xoá**

Thêm vào cuối `describe("buildCheckinUpdate", ...)` trong `src/lib/sheets.test.ts`:

```ts
  /**
   * Bỏ tick ở /admin phải trả ba ô Sheet về ĐÚNG trạng thái của một dòng vừa
   * append (`hangDbToSheetRow` ghi checked_in: false, at: null, source: null).
   * Nếu chỉ xoá giờ mà để lại chữ "Có" ở cột "Đã check-in", Sheet sẽ mãi mãi
   * nói một mẹ đã vào cửa trong khi Supabase nói chưa.
   */
  it("xoá check-in: ba ô về đúng trạng thái dòng chưa từng check-in", () => {
    const byRange = Object.fromEntries(
      buildCheckinUpdate("register", HEADERS, 5, null, null).map((d) => [
        d.range,
        d.values[0][0],
      ]),
    );
    expect(byRange["register!T5"]).toBe("—");
    expect(byRange["register!U5"]).toBe("");
    expect(byRange["register!V5"]).toBe("");
  });

  it("admin check-in hộ: cột nguồn ghi '(Admin CheckIn)'", () => {
    const byRange = Object.fromEntries(
      buildCheckinUpdate("register", HEADERS, 5, iso, "admin").map((d) => [
        d.range,
        d.values[0][0],
      ]),
    );
    expect(byRange["register!T5"]).toBe("Có");
    expect(byRange["register!U5"]).toBe("09:15 30/08/2026");
    expect(byRange["register!V5"]).toBe("(Admin CheckIn)");
  });

  it("xoá check-in vẫn chỉ đụng đúng ba cột", () => {
    expect(buildCheckinUpdate("register", HEADERS, 5, null, null)).toHaveLength(3);
  });
```

- [ ] **Step 2: Chạy test để thấy nó hỏng**

Run: `npm test -- sheets`
Expected: FAIL — TypeScript/runtime từ chối `null` ở tham số `checkedInAt`, hoặc ba ô ra sai giá trị.

- [ ] **Step 3: Nới `buildCheckinUpdate`**

Trong `src/lib/sheets.ts`, thay khối doc + chữ ký (dòng 402-415) bằng:

```ts
/**
 * Dữ liệu cho `values:batchUpdate` — mỗi cột check-in một range. Vị trí cột suy
 * ra từ `headers` (KHÔNG hardcode T/U/V) nên đổi thứ tự cột ở export-rows.ts vẫn
 * ghi đúng ô; cột bị đổi tên → ném lỗi ngay thay vì ghi nhầm ô. Giá trị lấy từ
 * `checkinCells`, dùng chung phép định dạng với file Excel.
 *
 * `checkedInAt === null` nghĩa là XOÁ check-in (ops bỏ tick ở /admin): ba ô về
 * đúng bộ mà `hangDbToSheetRow` ghi cho một dòng vừa append, nên Sheet sạch
 * hẳn chứ không để lại giờ ma.
 */
export function buildCheckinUpdate(
  tab: string,
  headers: string[],
  rowNumber: number,
  checkedInAt: string | null,
  source: "qr" | "admin" | null,
): { range: string; values: string[][] }[] {
  const [da, gio, nguon] = checkinCells(checkedInAt !== null, checkedInAt, source);
```

Giữ nguyên phần thân từ `const cell = ...` trở xuống.

- [ ] **Step 4: Đổi tên và nới `markCheckedInInSheet`**

Thay khối doc + chữ ký (dòng 428-442) bằng:

```ts
/**
 * Ghi ba cột check-in vào MỌI dòng của mẹ trong tab register — ngoại lệ có chủ
 * đích với "chỉ append" (xem doc đầu file). Đọc cột "Mã check-in", tìm mọi dòng
 * trùng mã (đăng ký lại giữ nguyên mã nên có thể có nhiều dòng), rồi
 * `values:batchUpdate` ba ô cho từng dòng.
 *
 * Dùng bởi CẢ HAI đường: mẹ tự quét QR (`/api/check-in`) và admin thao tác ở
 * /admin (`/api/admin/checkin` — quét hộ, tick tay, sửa giờ, bỏ tick).
 *
 * `checkedInAt === null` + `source === null` là lượt XOÁ. Tên hàm nói "ghi"
 * chứ không nói "mark", vì nó làm cả hai việc.
 *
 * Ném lỗi nếu KHÔNG thấy dòng nào (thường do Sheet append lỗi lúc đăng ký) —
 * mọi nơi gọi hàm này đều BẮT lỗi và chỉ log, vì check-in đã ghi xong ở Supabase
 * (nguồn chính thức); Sheet lệch là non-fatal.
 */
export async function ghiCheckinVaoSheet(
  code: string,
  checkedInAt: string | null,
  source: "qr" | "admin" | null,
): Promise<void> {
```

Giữ nguyên phần thân — nó đã truyền thẳng `checkedInAt` và `source` xuống `buildCheckinUpdate`.

- [ ] **Step 5: Đổi tên ở nơi gọi cũ**

Trong `src/app/api/check-in/route.ts`, dòng 3:

```ts
import { ghiCheckinVaoSheet, sheetsConfigured } from "@/lib/sheets";
```

và dòng 56:

```ts
        await ghiCheckinVaoSheet(code, result.time, "qr");
```

- [ ] **Step 6: Đảm bảo không còn tên cũ sót lại**

Run: `grep -rn "markCheckedInInSheet" src/`
Expected: không có kết quả nào.

- [ ] **Step 7: Chạy test + lint + build**

Run: `npm test && npm run lint && npm run build`
Expected: PASS toàn bộ, sạch.

- [ ] **Step 8: Commit**

```bash
git add src/lib/sheets.ts src/lib/sheets.test.ts src/app/api/check-in/route.ts
git commit -m "feat: ghiCheckinVaoSheet ghi được cả lượt xoá check-in, đổi tên cho đúng việc"
```

---

### Task 5: `POST /api/admin/checkin` mirror sang Google Sheet chạy nền

**Files:**
- Modify: `src/app/api/admin/checkin/route.ts` (toàn bộ)
- Test: `src/app/api/admin/checkin/route.test.ts` (tạo mới — route này chưa từng có test)

**Interfaces:**
- Consumes: `ghiCheckinVaoSheet` (Task 4), `sheetsConfigured()` từ `sheets.ts`, `after` từ `next/server`
- Produces: `POST /api/admin/checkin` — body `{ id: string, checkedIn: boolean, checkedInAt?: string | null }`, trả `{ ok: true, row: RegistrationRow }`

**Đây là điểm đắt giá nhất của cả thiết kế:** máy quét (Task 8) và nút tick tay ở `/admin` dùng chung đúng route này, nên lỗ hổng "admin tick không mirror sang Sheet" đóng lại mà không cần dòng code riêng nào, và hai đường không bao giờ trôi lệch.

- [ ] **Step 1: Đọc doc Next về `after` trước khi viết**

Run: `grep -rln "after" node_modules/next/dist/docs/01-app | head`
Đọc file liên quan tới `after` / background work. Xác nhận cách import và ràng buộc (gọi trong lúc render request, callback chạy sau khi response đã flush).

- [ ] **Step 2: Viết test trước**

Tạo `src/app/api/admin/checkin/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import * as adminAuth from "@/lib/admin-auth";
import * as sheets from "@/lib/sheets";
import * as supabase from "@/lib/supabase";

/* `after` chạy callback SAU KHI response đã trả. Test cần chờ nó xong mới
   khẳng định được Sheet có bị gọi hay không, nên mock giữ lại promise.
   `vi.hoisted` vì `vi.mock` bị kéo lên trên mọi khai báo const. */
const { nenSauTraLoi } = vi.hoisted(() => ({ nenSauTraLoi: [] as Promise<unknown>[] }));

vi.mock("next/server", () => ({
  after: (fn: () => Promise<unknown> | unknown) => {
    nenSauTraLoi.push(Promise.resolve().then(fn));
  },
}));

vi.mock("@/lib/admin-auth", () => ({ isAdmin: vi.fn(async () => true) }));
vi.mock("@/lib/supabase", () => ({ adminUpdateCheckin: vi.fn() }));
vi.mock("@/lib/sheets", () => ({
  ghiCheckinVaoSheet: vi.fn(async () => {}),
  sheetsConfigured: vi.fn(() => true),
}));

const MA = "MO-ABC234";

const ROW = {
  id: "row-1",
  checkin_code: MA,
  ho_ten: "Nguyễn Thị Lan",
  checked_in: true,
  checked_in_at: "2026-08-30T02:30:00.000Z",
  checked_in_source: "admin",
} as unknown as supabase.RegistrationRow;

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/admin/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

/** Chờ mọi việc `after` đã xếp hàng chạy xong. */
const xongViecNen = async () => {
  await Promise.all(nenSauTraLoi);
  nenSauTraLoi.length = 0;
};

beforeEach(() => {
  vi.clearAllMocks();
  nenSauTraLoi.length = 0;
  vi.mocked(adminAuth.isAdmin).mockResolvedValue(true);
  vi.mocked(supabase.adminUpdateCheckin).mockResolvedValue(ROW);
  vi.mocked(sheets.sheetsConfigured).mockReturnValue(true);
  vi.mocked(sheets.ghiCheckinVaoSheet).mockResolvedValue(undefined);
});

describe("/api/admin/checkin", () => {
  it("chặn người chưa đăng nhập, không ghi gì", async () => {
    vi.mocked(adminAuth.isAdmin).mockResolvedValue(false);
    expect((await post({ id: "row-1", checkedIn: true })).status).toBe(401);
    expect(supabase.adminUpdateCheckin).not.toHaveBeenCalled();
    expect(sheets.ghiCheckinVaoSheet).not.toHaveBeenCalled();
  });

  it("thiếu id hoặc checkedIn không phải boolean → 400", async () => {
    expect((await post({ checkedIn: true })).status).toBe(400);
    expect((await post({ id: "row-1" })).status).toBe(400);
    expect(supabase.adminUpdateCheckin).not.toHaveBeenCalled();
  });

  it("check-in hộ: mirror sang Sheet với nguồn 'admin'", async () => {
    const res = await post({
      id: "row-1",
      checkedIn: true,
      checkedInAt: "2026-08-30T02:30:00.000Z",
    });
    expect(res.status).toBe(200);
    await xongViecNen();
    expect(sheets.ghiCheckinVaoSheet).toHaveBeenCalledWith(
      MA,
      "2026-08-30T02:30:00.000Z",
      "admin",
    );
  });

  it("bỏ tick: mirror lượt XOÁ sang Sheet, không để lại giờ ma", async () => {
    vi.mocked(supabase.adminUpdateCheckin).mockResolvedValue({
      ...ROW,
      checked_in: false,
      checked_in_at: null,
      checked_in_source: null,
    } as unknown as supabase.RegistrationRow);

    await post({ id: "row-1", checkedIn: false });
    await xongViecNen();
    expect(sheets.ghiCheckinVaoSheet).toHaveBeenCalledWith(MA, null, null);
  });

  /**
   * Tính chất quan trọng nhất của route này. Supabase là nguồn chính thức; Sheet
   * chỉ là bản mirror cho ops. Sheet hỏng mà trả lỗi thì một mẹ đứng ở cửa sẽ bị
   * báo check-in thất bại trong khi hệ thống ĐÃ ghi nhận chị ấy.
   */
  it("Sheet hỏng vẫn trả ok — check-in đã ghi xong ở Supabase", async () => {
    vi.mocked(sheets.ghiCheckinVaoSheet).mockRejectedValue(new Error("Google 403"));
    const res = await post({ id: "row-1", checkedIn: true });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    await expect(xongViecNen()).resolves.not.toThrow();
  });

  it("chưa cấu hình Sheets thì không gọi Google", async () => {
    vi.mocked(sheets.sheetsConfigured).mockReturnValue(false);
    await post({ id: "row-1", checkedIn: true });
    await xongViecNen();
    expect(sheets.ghiCheckinVaoSheet).not.toHaveBeenCalled();
  });

  it("Supabase hỏng thì 502, và KHÔNG đụng Sheet", async () => {
    vi.mocked(supabase.adminUpdateCheckin).mockRejectedValue(new Error("DB chết"));
    expect((await post({ id: "row-1", checkedIn: true })).status).toBe(502);
    await xongViecNen();
    expect(sheets.ghiCheckinVaoSheet).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Chạy test để thấy nó hỏng**

Run: `npm test -- admin/checkin`
Expected: FAIL — `ghiCheckinVaoSheet` chưa từng được gọi (route hiện chỉ ghi Supabase).

- [ ] **Step 4: Viết lại `src/app/api/admin/checkin/route.ts`**

```ts
import { after } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { ghiCheckinVaoSheet, sheetsConfigured } from "@/lib/sheets";
import { adminUpdateCheckin } from "@/lib/supabase";

/**
 * Đường ghi check-in DUY NHẤT của phía admin. Dùng chung bởi:
 *  - nút tick / ô sửa giờ / bỏ tick trong bảng ở `/admin`
 *  - màn hình quét QR ở `/admin/quet-qr`
 *
 * Chung một route là có chủ đích: hai đường ghi riêng sẽ trôi lệch nhau, mà
 * Google Sheet là nơi lệch đó khó phát hiện nhất.
 *
 * Cổng giờ `daMoCheckin` KHÔNG áp ở đây — ops phải mở check-in sớm được nếu
 * khách tới trước giờ (xem doc `/api/check-in/route.ts`).
 */
// Mirror Sheet chạy trong `after` nên vẫn tính vào thời gian sống của hàm —
// nới maxDuration y như route check-in của mẹ để hai lượt gọi Google không bị
// nền tảng giết giữa chừng.
export const maxDuration = 30;

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

    // Mirror sang Google Sheet SAU KHI đã trả lời. Ở quầy ngày 30/08 có hàng
    // dài phía sau: hai lượt gọi Google (đọc cột mã + batchUpdate) tốn 1-3 giây
    // mà không ai ở quầy cần đợi. `after` chứ không phải promise thả trôi —
    // trên Vercel hàm bị đóng ngay khi response flush, promise chưa xong sẽ
    // chết giữa chừng.
    //
    // Non-fatal y như luồng mẹ tự quét: Supabase đã ghi xong và nó là nguồn
    // chính thức; Sheet lệch thì log để ops back-fill.
    after(async () => {
      if (!sheetsConfigured()) return;
      try {
        await ghiCheckinVaoSheet(
          row.checkin_code,
          row.checked_in_at,
          row.checked_in ? "admin" : null,
        );
      } catch (err) {
        console.error("[admin/checkin] Sheets update failed:", row.checkin_code, err);
      }
    });

    return Response.json({ ok: true, row });
  } catch (err) {
    console.error("[admin/checkin] failed:", err);
    return Response.json({ error: "Cập nhật thất bại" }, { status: 502 });
  }
}
```

- [ ] **Step 5: Chạy test để thấy nó xanh**

Run: `npm test -- admin/checkin`
Expected: PASS cả 7 ca.

- [ ] **Step 6: Toàn bộ test + lint + build**

Run: `npm test && npm run lint && npm run build`
Expected: sạch.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/admin/checkin/route.ts src/app/api/admin/checkin/route.test.ts
git commit -m "feat: admin check-in mirror sang Google Sheet, chạy nền sau khi trả lời"
```

---

### Task 6: `GET /api/admin/tra-ma` — tra một mẹ theo mã

**Files:**
- Create: `src/lib/thong-tin-quet.ts` (type dùng chung server ↔ client)
- Create: `src/app/api/admin/tra-ma/route.ts`
- Test: `src/app/api/admin/tra-ma/route.test.ts`

**Interfaces:**
- Consumes: `isAdmin`, `findByCode`, `isValidCheckinCode`
- Produces:
  - `type ThongTinQuet` (từ `src/lib/thong-tin-quet.ts`)
  - `GET /api/admin/tra-ma?code=MO-XXXXXX` → `{ ok: true, row: ThongTinQuet }` | `{ error }` với 401 / 400 / 404 / 502

**Vì sao type nằm ở `src/lib/thong-tin-quet.ts`:** component client cần đúng hình dạng này. Repo đã có tiền lệ y hệt — `src/lib/mau-email.ts` được tách khỏi `brevo.ts` chỉ để client import được mà không kéo theo nodemailer/qrcode. Đặt type ở file lib riêng giữ đúng nếp đó, và tránh việc component phải import từ một file route.

- [ ] **Step 1: Viết test trước**

Tạo `src/app/api/admin/tra-ma/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import * as adminAuth from "@/lib/admin-auth";
import * as supabase from "@/lib/supabase";

vi.mock("@/lib/admin-auth", () => ({ isAdmin: vi.fn(async () => true) }));
vi.mock("@/lib/supabase", () => ({ findByCode: vi.fn() }));

const MA = "MO-ABC234";

/** Dòng đầy đủ trong DB — có cả những cột KHÔNG được lọt ra client. */
const ROW = {
  id: "row-1",
  checkin_code: MA,
  ho_ten: "Nguyễn Thị Lan",
  email: "lan@example.com",
  sdt: "0900000000",
  facebook: "fb.com/lan",
  tinh_thanh: "TP.HCM",
  trang_thai: "mang_thai",
  thai_tuan: 20,
  be_thang_tuoi: null,
  di_cung_chong: true,
  checked_in: false,
  checked_in_at: null,
  checked_in_source: null,
} as unknown as supabase.RegistrationRow;

const get = (qs: string) => GET(new Request(`http://localhost/api/admin/tra-ma?${qs}`));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminAuth.isAdmin).mockResolvedValue(true);
  vi.mocked(supabase.findByCode).mockResolvedValue(ROW);
});

describe("/api/admin/tra-ma", () => {
  it("chặn người chưa đăng nhập, không đụng DB", async () => {
    vi.mocked(adminAuth.isAdmin).mockResolvedValue(false);
    expect((await get(`code=${MA}`)).status).toBe(401);
    expect(supabase.findByCode).not.toHaveBeenCalled();
  });

  it("mã sai định dạng → 400, không đụng DB", async () => {
    expect((await get("code=LUNG-TUNG")).status).toBe(400);
    expect((await get("")).status).toBe(400);
    expect(supabase.findByCode).not.toHaveBeenCalled();
  });

  it("mã không có trong DB → 404", async () => {
    vi.mocked(supabase.findByCode).mockResolvedValue(null);
    expect((await get(`code=${MA}`)).status).toBe(404);
  });

  it("chuẩn hoá mã viết thường thành hoa", async () => {
    await get("code=mo-abc234");
    expect(supabase.findByCode).toHaveBeenCalledWith(MA);
  });

  it("trả đủ các trường màn hình quét cần", async () => {
    const { row } = await (await get(`code=${MA}`)).json();
    expect(row).toMatchObject({
      id: "row-1",
      ho_ten: "Nguyễn Thị Lan",
      checkin_code: MA,
      tinh_thanh: "TP.HCM",
      trang_thai: "mang_thai",
      thai_tuan: 20,
      di_cung_chong: true,
      checked_in: false,
      checked_in_at: null,
      checked_in_source: null,
    });
  });

  /**
   * Đây là điện thoại CÁ NHÂN của nhân viên thời vụ đứng quầy, không phải máy
   * ops. Thẻ xác nhận không cần email/SĐT/Facebook, nên chúng không được rời
   * server. Khác /api/admin/registrations (trả full row) một cách CÓ CHỦ Ý.
   */
  it("KHÔNG để email / SĐT / Facebook lọt ra client", async () => {
    const res = await get(`code=${MA}`);
    const text = await res.text();
    expect(text).not.toContain("lan@example.com");
    expect(text).not.toContain("0900000000");
    expect(text).not.toContain("fb.com/lan");
    expect(JSON.parse(text).row).not.toHaveProperty("email");
    expect(JSON.parse(text).row).not.toHaveProperty("sdt");
    expect(JSON.parse(text).row).not.toHaveProperty("facebook");
  });

  it("DB hỏng → 502, không giả vờ không tìm thấy", async () => {
    vi.mocked(supabase.findByCode).mockRejectedValue(new Error("DB chết"));
    expect((await get(`code=${MA}`)).status).toBe(502);
  });
});
```

- [ ] **Step 2: Chạy test để thấy nó hỏng**

Run: `npm test -- tra-ma`
Expected: FAIL — không resolve được `./route`.

- [ ] **Step 3: Tạo `src/lib/thong-tin-quet.ts`**

```ts
import type { RegistrationRow } from "./supabase";

/**
 * Những gì màn hình quét QR ở `/admin/quet-qr` được biết về một mẹ.
 *
 * Tách khỏi `supabase.ts` để component "use client" import được mà không kéo
 * theo `@supabase/supabase-js` — cùng lý do `mau-email.ts` được tách khỏi
 * `brevo.ts`.
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
```

- [ ] **Step 4: Tạo `src/app/api/admin/tra-ma/route.ts`**

```ts
import { isAdmin } from "@/lib/admin-auth";
import { findByCode } from "@/lib/supabase";
import { rutGonChoQuet } from "@/lib/thong-tin-quet";
import { isValidCheckinCode } from "@/lib/validation";

/**
 * Tra một dòng đăng ký theo mã check-in, cho màn hình quét QR `/admin/quet-qr`.
 *
 * CHỈ ĐỌC — không ghi gì. Việc ghi nằm ở `/api/admin/checkin`, sau khi nhân
 * viên bấm nút xác nhận. Tách đôi như vậy để camera quét trúng một mã hợp lệ
 * KHÔNG tự động check-in ai cả.
 *
 * Trả bản rút gọn (`rutGonChoQuet`), cố tình bỏ email/SĐT/Facebook — xem doc ở
 * `src/lib/thong-tin-quet.ts`.
 *
 * Gọi MỖI LƯỢT QUÉT, không cache trước cả danh sách: quầy bên cạnh vừa check-in
 * mẹ này 30 giây trước thì bản cache sẽ nói "chưa check-in", nhân viên thấy nút
 * CHÍNH thay vì nút phụ "Check-in lại", và ghi đè mất giờ đúng.
 */
export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const code = (new URL(request.url).searchParams.get("code") ?? "").trim().toUpperCase();
  if (!isValidCheckinCode(code)) {
    return Response.json({ error: "Mã không hợp lệ" }, { status: 400 });
  }

  try {
    const row = await findByCode(code);
    if (!row) {
      return Response.json({ error: "Không tìm thấy mã" }, { status: 404 });
    }
    return Response.json({ ok: true, row: rutGonChoQuet(row) });
  } catch (err) {
    console.error("[admin/tra-ma] lookup failed:", code, err);
    return Response.json({ error: "Không đọc được dữ liệu đăng ký" }, { status: 502 });
  }
}
```

- [ ] **Step 5: Chạy test để thấy nó xanh**

Run: `npm test -- tra-ma`
Expected: PASS cả 7 ca.

- [ ] **Step 6: Toàn bộ test + lint + build**

Run: `npm test && npm run lint && npm run build`
Expected: sạch.

- [ ] **Step 7: Commit**

```bash
git add src/lib/thong-tin-quet.ts src/app/api/admin/tra-ma/
git commit -m "feat: GET /api/admin/tra-ma tra mẹ theo mã, trả bản rút gọn không kèm PII"
```

---

### Task 7: Trang `/admin/quet-qr` — camera đọc được mã

**Files:**
- Modify: `package.json` (thêm `qr-scanner`)
- Create: `src/app/admin/quet-qr/page.tsx`
- Create: `src/components/QuetQrTool.tsx`

**Interfaces:**
- Consumes: `maTuQr` (Task 3), `isAdmin`
- Produces: component `QuetQrTool` — task sau bồi thêm thẻ xác nhận vào đúng file này

**Mốc bàn giao của task này:** bật được camera trên điện thoại thật, quét QR của mẹ và **hiện ra mã đọc được trên màn hình**. Chưa gọi API, chưa check-in ai. Người review gật được ở đây độc lập với việc luồng ghi có đúng hay không.

- [ ] **Step 1: Cài thư viện**

```bash
npm install qr-scanner@1.4.2
```

- [ ] **Step 2: Tạo `src/app/admin/quet-qr/page.tsx`**

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { QuetQrTool } from "@/components/QuetQrTool";
import { isAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Admin — Quét QR check-in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * KHÔNG nạp sẵn danh sách 500 mẹ như `/admin/gui-mail`: màn hình này tra theo
 * từng lượt quét qua `/api/admin/tra-ma`, vì trạng thái check-in phải tươi tại
 * đúng thời điểm bấm nút (xem doc route đó).
 */
export default async function QuetQrPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return <QuetQrTool />;
}
```

- [ ] **Step 3: Tạo `src/components/QuetQrTool.tsx` — bản đọc mã**

```tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { maTuQr } from "@/lib/ma-tu-qr";

/** Kiểu tối thiểu của instance qr-scanner mà file này dùng tới. */
type Scanner = {
  start: () => Promise<void>;
  pause: () => void;
  destroy: () => void;
};

type Man =
  | { loai: "cho" }
  | { loai: "quet" }
  | { loai: "docDuoc"; ma: string }
  | { loai: "loi"; text: string };

export function QuetQrTool() {
  const [man, setMan] = useState<Man>({ loai: "cho" });
  const [dangBat, setDangBat] = useState(false);
  const [maGoTay, setMaGoTay] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<Scanner | null>(null);
  // `man` đọc qua ref trong callback giải mã: callback được tạo MỘT lần lúc
  // dựng scanner, nên nó sẽ mãi thấy giá trị `man` của lần render đầu nếu đọc
  // thẳng. Đồng bộ trong useEffect, KHÔNG gán khi render — React cấm ghi ref
  // trong lúc render (cùng lý do `busyRef` ở AdminDashboard.tsx).
  const manRef = useRef<Man>(man);
  useEffect(() => {
    manRef.current = man;
  }, [man]);

  const nhanMa = useCallback((ma: string) => {
    scannerRef.current?.pause();
    setMan({ loai: "docDuoc", ma });
  }, []);

  /**
   * Bật camera. Nạp thư viện bằng `import()` động chứ không import ở đầu file vì
   * hai lý do: (1) `qr-scanner` đụng `document`/`Worker` nên không sống được ở
   * bước SSR mà Next vẫn chạy cho component client; (2) 15KB đó chỉ cần khi
   * người dùng thật sự quét.
   *
   * Có nút bấm chứ không tự mở lúc tải trang: Safari trên iOS chỉ tin
   * `getUserMedia` khi nó nằm trong một cử chỉ người dùng; tự xin quyền lúc tải
   * dễ bị chặn im lặng, và nhân viên chỉ thấy màn hình đen mà không hiểu vì sao.
   */
  const batCamera = useCallback(async () => {
    if (!videoRef.current || dangBat) return;
    setDangBat(true);
    try {
      const { default: QrScanner } = await import("qr-scanner");

      if (!(await QrScanner.hasCamera())) {
        setMan({
          loai: "loi",
          text: "Máy này không có camera dùng được. Nhập mã bằng tay ở dưới.",
        });
        return;
      }

      const scanner = new QrScanner(
        videoRef.current,
        (kq: { data: string }) => {
          // Chỉ nhận khi đang ở màn quét — tránh một khung hình đến muộn ghi đè
          // lên thẻ xác nhận vừa hiện.
          if (manRef.current.loai !== "quet") return;
          const ma = maTuQr(kq.data);
          // QR lạ (wifi, Momo, tờ rơi) → BỎ QUA IM LẶNG, quét tiếp. Báo lỗi ở
          // đây sẽ nhấp nháy mỗi khung hình.
          if (!ma) return;
          nhanMa(ma);
        },
        {
          returnDetailedScanResult: true,
          preferredCamera: "environment",
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 5,
        },
      );
      scannerRef.current = scanner as unknown as Scanner;
      await scanner.start();
      setMan({ loai: "quet" });
    } catch {
      setMan({
        loai: "loi",
        text: "Không mở được camera. Kiểm tra quyền camera trong Cài đặt trình duyệt, hoặc nhập mã bằng tay ở dưới.",
      });
    } finally {
      setDangBat(false);
    }
  }, [dangBat, nhanMa]);

  // Tắt camera khi rời trang — không để đèn camera sáng suốt buổi.
  useEffect(() => {
    return () => {
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, []);

  function guiMaGoTay(e: React.FormEvent) {
    e.preventDefault();
    const ma = maTuQr(maGoTay);
    if (!ma) {
      setMan({ loai: "loi", text: `Mã "${maGoTay.trim()}" không đúng định dạng MO-XXXXXX.` });
      return;
    }
    setMaGoTay("");
    nhanMa(ma);
  }

  return (
    <main className="flex-1 bg-cream">
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold text-ink">Quét QR check-in</h1>
          <Link
            href="/admin"
            className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-faded hover:bg-primary-faded-hover"
          >
            ← Danh sách
          </Link>
        </div>

        {/* Khung camera. Giữ trong DOM ở MỌI trạng thái: qr-scanner gắn vào
            đúng thẻ <video> này, tháo nó ra khi hiện thẻ xác nhận là mất luôn
            instance. Chỉ ẩn bằng CSS. */}
        <div className={`mt-5 ${man.loai === "quet" ? "" : "hidden"}`}>
          <video
            ref={videoRef}
            className="aspect-square w-full rounded-2xl border border-line bg-black object-cover"
            playsInline
            muted
          />
          <p className="mt-3 text-center text-sm text-ink-faded">
            Đưa mã QR trên điện thoại của mẹ vào khung.
          </p>
        </div>

        {man.loai === "cho" && (
          <div className="mt-5 rounded-2xl border border-line bg-white p-6 text-center">
            <p className="text-sm leading-6 text-ink-faded">
              Bấm để mở camera. Trình duyệt sẽ hỏi quyền — chọn &ldquo;Cho
              phép&rdquo;.
            </p>
            <button
              onClick={batCamera}
              disabled={dangBat}
              className="mt-4 w-full rounded-full bg-primary px-6 py-3 text-base font-bold text-white disabled:opacity-60"
            >
              {dangBat ? "Đang mở camera..." : "Bật camera"}
            </button>
          </div>
        )}

        {man.loai === "docDuoc" && (
          <div className="mt-5 rounded-2xl border border-line bg-white p-6 text-center">
            <p className="text-sm text-ink-faded">Đọc được mã</p>
            <p className="mt-2 font-mono text-xl font-bold tracking-wider text-ink">
              {man.ma}
            </p>
            <button
              onClick={() => {
                setMan({ loai: "quet" });
                void scannerRef.current?.start();
              }}
              className="mt-4 w-full rounded-full border border-line px-6 py-3 text-base font-bold text-ink"
            >
              Quét tiếp
            </button>
          </div>
        )}

        {man.loai === "loi" && (
          <div className="mt-5 rounded-2xl border border-danger bg-white p-6">
            <p role="alert" className="text-sm leading-6 text-danger">
              {man.text}
            </p>
            <button
              onClick={() => setMan({ loai: "cho" })}
              className="mt-4 w-full rounded-full border border-line px-6 py-3 text-base font-bold text-ink"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Ô nhập mã tay là đường thoát BẮT BUỘC, không phải phụ kiện: vé của mẹ
            đã tính sẵn ca "Không tạo được mã QR — mẹ đọc mã cho nhân viên"
            (CheckinPass.tsx). Cộng thêm màn hình vỡ, độ sáng thấp, ảnh chụp màn
            hình bị nén, và ca nhân viên lỡ từ chối quyền camera. */}
        <form onSubmit={guiMaGoTay} className="mt-6">
          <label htmlFor="ma-tay" className="text-sm font-semibold text-ink">
            Hoặc nhập mã bằng tay
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="ma-tay"
              value={maGoTay}
              onChange={(e) => setMaGoTay(e.target.value)}
              placeholder="MO-ABC234"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-3 font-mono text-base uppercase text-ink placeholder:font-sans placeholder:text-ink-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={!maGoTay.trim()}
              className="shrink-0 rounded-xl bg-primary px-5 py-3 text-base font-bold text-white disabled:opacity-50"
            >
              Tra
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Lint + build**

Run: `npm run lint && npm run build`
Expected: sạch.

**Chú ý riêng — worker của `qr-scanner`.** Thư viện nạp worker giải mã qua `new URL("qr-scanner-worker.min.js", import.meta.url)`. Turbopack/webpack thường tự lo được. Nếu build báo lỗi không resolve được worker, cách xử đã biết là copy worker vào `public/` rồi trỏ đường dẫn tuyệt đối, ngay trước khi dựng scanner:

```ts
const { default: QrScanner } = await import("qr-scanner");
// Chỉ thêm dòng này NẾU build không tự resolve được worker.
QrScanner.WORKER_PATH = "/qr-scanner-worker.min.js";
```

kèm bước copy một lần:

```bash
cp node_modules/qr-scanner/qr-scanner-worker.min.js public/
```

Nếu phải dùng đường này, ghi luôn lý do vào comment ngay chỗ đó và thêm `public/qr-scanner-worker.min.js` vào commit — người sau nhìn một file lạ trong `public/` sẽ không biết vì sao nó ở đấy.

- [ ] **Step 5: Thử trên điện thoại thật**

Run: `npm run dev -- -H 0.0.0.0`, mở `http://<IP-máy>:3000/admin/quet-qr` trên điện thoại.

> **Lưu ý:** camera chỉ chạy trong secure context. `localhost` được tính là secure, **IP trong mạng LAN thì KHÔNG**. Nếu điện thoại không mở được camera qua IP, deploy lên một bản preview Vercel (có HTTPS) rồi thử ở đó — đừng mất thời gian sửa code cho một lỗi không phải của code.

Expected: bấm "Bật camera" → trình duyệt hỏi quyền → camera sau bật → chĩa vào QR trong email của một mẹ → hiện đúng mã `MO-XXXXXX`. Chĩa vào QR wifi → không có gì xảy ra, camera vẫn quét.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/app/admin/quet-qr/ src/components/QuetQrTool.tsx
git commit -m "feat: trang /admin/quet-qr đọc được mã từ QR bằng camera điện thoại"
```

---

### Task 8: Thẻ xác nhận, check-in, tự quét tiếp, và lối vào từ `/admin`

**Files:**
- Modify: `src/components/QuetQrTool.tsx` (thay trạng thái `docDuoc` bằng luồng đầy đủ)
- Modify: `src/components/AdminDashboard.tsx:256-275` (thêm nút "Quét QR")

**Interfaces:**
- Consumes: `ThongTinQuet` (Task 6), `GET /api/admin/tra-ma` (Task 6), `POST /api/admin/checkin` (Task 5), `nguonCheckinLabel` (Task 1), `formatCheckinTime` / `trangThaiLabel` có sẵn
- Produces: — (task cuối)

- [ ] **Step 1: Mở rộng kiểu `Man` và import**

Trong `src/components/QuetQrTool.tsx`, thay khối import và type `Man`:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { nguonCheckinLabel, trangThaiLabel } from "@/lib/constants";
import { maTuQr } from "@/lib/ma-tu-qr";
import type { ThongTinQuet } from "@/lib/thong-tin-quet";
import { formatCheckinTime } from "@/lib/time";

/** Kiểu tối thiểu của instance qr-scanner mà file này dùng tới. */
type Scanner = {
  start: () => Promise<void>;
  pause: () => void;
  destroy: () => void;
};

/** Bao lâu thì màn báo thành công tự nhường chỗ cho camera. */
const NGHI_SAU_KHI_XONG_MS = 2000;

type Man =
  | { loai: "cho" }
  | { loai: "quet" }
  | { loai: "dangTra"; ma: string }
  | { loai: "xacNhan"; row: ThongTinQuet }
  | { loai: "dangGhi"; row: ThongTinQuet }
  | { loai: "xong"; hoTen: string }
  // `ma` có mặt thì nút chính là "Thử lại" cho ĐÚNG mã đó — nhân viên không
  // phải bảo mẹ giơ điện thoại lên quét lại chỉ vì wifi rớt một nhịp.
  | { loai: "loi"; text: string; ma?: string };
```

- [ ] **Step 2: Thay `nhanMa` bằng luồng tra mã, và thêm hàm ghi check-in**

Thay hàm `nhanMa` cũ bằng khối dưới (đặt ngay sau phần `manRef`):

```tsx
  const router = useRouter();
  // Hẹn giờ tự quay lại camera. Giữ qua ref để huỷ được khi nhân viên bấm
  // "Quét tiếp ngay" hoặc rời trang — nếu không, một setTimeout còn treo sẽ
  // kéo màn hình về "quet" giữa lúc mẹ sau đang xem thẻ xác nhận.
  const hensRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const huyHen = useCallback(() => {
    if (hensRef.current) clearTimeout(hensRef.current);
    hensRef.current = null;
  }, []);

  const quetTiep = useCallback(() => {
    huyHen();
    setMan({ loai: "quet" });
    void scannerRef.current?.start();
  }, [huyHen]);

  /** Tra mã ở server. Gọi mỗi lượt quét — xem doc `/api/admin/tra-ma`. */
  const traMa = useCallback(
    async (ma: string) => {
      scannerRef.current?.pause();
      setMan({ loai: "dangTra", ma });
      try {
        const res = await fetch(`/api/admin/tra-ma?code=${encodeURIComponent(ma)}`);
        if (res.status === 401) {
          router.replace("/admin/login");
          return;
        }
        if (res.status === 404) {
          setMan({ loai: "loi", text: `Không tìm thấy mã ${ma} trong danh sách.` });
          return;
        }
        if (!res.ok) {
          setMan({ loai: "loi", text: "Không đọc được dữ liệu đăng ký.", ma });
          return;
        }
        const data = (await res.json()) as { row: ThongTinQuet };
        setMan({ loai: "xacNhan", row: data.row });
      } catch {
        // Giữ `ma` để nút "Thử lại" tra đúng mã đó — mẹ không phải giơ điện
        // thoại lên lần nữa chỉ vì wifi hội trường rớt một nhịp.
        setMan({ loai: "loi", text: "Không kết nối được. Kiểm tra mạng rồi thử lại.", ma });
      }
    },
    [router],
  );

  const nhanMa = useCallback(
    (ma: string) => {
      void traMa(ma);
    },
    [traMa],
  );

  /**
   * Ghi check-in. Dùng CHUNG route với nút tick tay ở /admin, nên Google Sheet
   * cũng được mirror (route lo, chạy nền).
   *
   * `new Date()` gọi trong HÀM XỬ LÝ SỰ KIỆN, không phải lúc render — đọc đồng
   * hồ trong lúc render là hàm không thuần, React Compiler cấm.
   */
  const ghiCheckin = useCallback(
    async (row: ThongTinQuet) => {
      setMan({ loai: "dangGhi", row });
      try {
        const res = await fetch("/api/admin/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: row.id,
            checkedIn: true,
            checkedInAt: new Date().toISOString(),
          }),
        });
        if (res.status === 401) {
          router.replace("/admin/login");
          return;
        }
        if (!res.ok) {
          // KHÔNG bao giờ hiện màn xanh khi chưa ghi được. Báo thành công giả
          // là cách chắc chắn nhất để một mẹ bị coi như đã vào cửa mà chưa vào.
          setMan({
            loai: "loi",
            text: "Ghi check-in thất bại. Bấm Thử lại.",
            ma: row.checkin_code,
          });
          return;
        }
        setMan({ loai: "xong", hoTen: row.ho_ten });
        hensRef.current = setTimeout(quetTiep, NGHI_SAU_KHI_XONG_MS);
      } catch {
        setMan({
          loai: "loi",
          text: "Không kết nối được. Chưa ghi được check-in — bấm Thử lại.",
          ma: row.checkin_code,
        });
      }
    },
    [quetTiep, router],
  );
```

- [ ] **Step 3: Huỷ hẹn giờ khi rời trang**

Sửa effect dọn dẹp:

```tsx
  useEffect(() => {
    return () => {
      huyHen();
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [huyHen]);
```

- [ ] **Step 4: Thay khối hiển thị `docDuoc` bằng bốn màn mới**

Xoá nguyên khối `{man.loai === "docDuoc" && (...)}` và thay bằng:

```tsx
        {man.loai === "dangTra" && (
          <div className="mt-5 rounded-2xl border border-line bg-white p-6 text-center">
            <p className="font-mono text-lg font-bold tracking-wider text-ink">{man.ma}</p>
            <p className="mt-2 text-sm text-ink-faded">Đang tra danh sách...</p>
          </div>
        )}

        {(man.loai === "xacNhan" || man.loai === "dangGhi") && (
          <TheXacNhan
            row={man.row}
            dangGhi={man.loai === "dangGhi"}
            onXacNhan={() => void ghiCheckin(man.row)}
            onBoQua={quetTiep}
          />
        )}

        {man.loai === "xong" && (
          <div className="mt-5 rounded-2xl border-2 border-success bg-white p-8 text-center">
            <p className="text-4xl" aria-hidden="true">
              ✓
            </p>
            <p className="mt-3 text-lg font-extrabold text-ink">
              Chị {man.hoTen} đã check-in
            </p>
            <button
              onClick={quetTiep}
              className="mt-5 w-full rounded-full bg-primary px-6 py-3 text-base font-bold text-white"
            >
              Quét tiếp ngay
            </button>
          </div>
        )}
```

Và sửa khối `loi` để nút biết tra lại đúng mã:

```tsx
        {man.loai === "loi" && (
          <div className="mt-5 rounded-2xl border border-danger bg-white p-6">
            <p role="alert" className="text-sm leading-6 text-danger">
              {man.text}
            </p>
            <button
              onClick={() => {
                const ma = man.ma;
                if (ma) void traMa(ma);
                else quetTiep();
              }}
              className="mt-4 w-full rounded-full bg-primary px-6 py-3 text-base font-bold text-white"
            >
              {man.ma ? "Thử lại" : "Quét tiếp"}
            </button>
          </div>
        )}
```

- [ ] **Step 5: Thêm component `TheXacNhan` vào cuối file**

```tsx
/** Một dòng "nhãn — giá trị" trong thẻ xác nhận. */
function Dong({ nhan, gia }: { nhan: string; gia: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="shrink-0 text-sm text-ink-faded">{nhan}</span>
      <span className="text-right text-sm font-semibold text-ink">{gia}</span>
    </div>
  );
}

/**
 * Thẻ xác nhận — màn hình nhân viên nhìn trước khi bấm.
 *
 * KHÁC vé của mẹ (`CheckinPass.tsx`): ô "--" ở đây được HIỆN, không ẩn. Với mẹ
 * thì "Tình trạng: --" chỉ làm chị ấy tưởng vé mình hỏng; với ops thì "chưa
 * hỏi" chính là thông tin cần biết (dòng do ops tạo tay ở /admin/them-dang-ky).
 *
 * "Đi cùng chồng" đứng ở đây có chủ đích: người phát Welcome Kit cần biết ngay
 * một suất hay hai, không phải mở màn hình khác để tra.
 */
function TheXacNhan({
  row,
  dangGhi,
  onXacNhan,
  onBoQua,
}: {
  row: ThongTinQuet;
  dangGhi: boolean;
  onXacNhan: () => void;
  onBoQua: () => void;
}) {
  const tinhTrang =
    row.trang_thai === "mang_thai" && row.thai_tuan != null
      ? `${trangThaiLabel(row.trang_thai)} · ${row.thai_tuan} tuần`
      : row.trang_thai === "da_sinh" && row.be_thang_tuoi != null
        ? `${trangThaiLabel(row.trang_thai)} · ${row.be_thang_tuoi} tháng`
        : trangThaiLabel(row.trang_thai);

  return (
    <div className="mt-5 rounded-2xl border border-line bg-white p-6">
      <p className="text-center text-xl font-extrabold text-ink">{row.ho_ten}</p>
      <p className="mt-1 text-center font-mono text-sm tracking-wider text-ink-faded">
        {row.checkin_code}
      </p>

      <div className="mt-4 divide-y divide-line rounded-xl bg-cream px-4">
        <Dong nhan="Tình trạng" gia={tinhTrang} />
        <Dong nhan="Tỉnh/thành" gia={row.tinh_thanh} />
        <Dong nhan="Đi cùng chồng" gia={row.di_cung_chong ? "Có — 2 suất" : "Không"} />
      </div>

      {row.checked_in ? (
        <>
          <div className="mt-4 rounded-xl border border-warning bg-white px-4 py-3 text-center">
            <p className="text-sm font-semibold text-ink">
              Đã check-in
              {row.checked_in_at ? ` lúc ${formatCheckinTime(row.checked_in_at)}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-ink-faded">
              {nguonCheckinLabel(row.checked_in_source)}
            </p>
          </div>
          {/* "Check-in lại" là nút PHỤ, có chủ đích. Quét trùng vô ý không được
              phép ghi đè mất giờ đúng — ghi đè phải là hành động cố ý. */}
          <button
            onClick={onBoQua}
            className="mt-4 w-full rounded-full bg-primary px-6 py-3 text-base font-bold text-white"
          >
            Quét mẹ tiếp theo
          </button>
          <button
            onClick={onXacNhan}
            disabled={dangGhi}
            className="mt-2 w-full rounded-full border border-line px-6 py-3 text-sm font-bold text-ink-faded disabled:opacity-60"
          >
            {dangGhi ? "Đang ghi..." : "Check-in lại (ghi đè giờ cũ)"}
          </button>
        </>
      ) : (
        <>
          <button
            onClick={onXacNhan}
            disabled={dangGhi}
            className="mt-5 w-full rounded-full bg-primary px-6 py-3.5 text-base font-bold text-white disabled:opacity-60"
          >
            {dangGhi ? "Đang ghi..." : "✓ Xác nhận check-in"}
          </button>
          <button
            onClick={onBoQua}
            disabled={dangGhi}
            className="mt-2 w-full rounded-full border border-line px-6 py-3 text-sm font-bold text-ink-faded disabled:opacity-60"
          >
            Bỏ qua, quét mẹ khác
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Thêm nút "Quét QR" vào `/admin`**

Trong `src/components/AdminDashboard.tsx`, thêm ngay trước `<Link href="/admin/them-dang-ky">` (dòng 257):

```tsx
            <Link
              href="/admin/quet-qr"
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
            >
              Quét QR
            </Link>
```

Nút này để màu chính (khác ba nút viền trắng còn lại) vì ngày 30/08 nó là việc chính của cả trang.

- [ ] **Step 7: Test + lint + build**

Run: `npm test && npm run lint && npm run build`
Expected: sạch. Không test nào mới (đều là `.tsx`).

- [ ] **Step 8: Thử tay đầy đủ — danh sách bắt buộc trước 30/08**

Deploy lên bản preview Vercel (cần HTTPS cho camera), rồi chạy hết:

1. iPhone + Safari: bật camera, quét QR hiển thị trên màn hình một điện thoại khác → hiện thẻ xác nhận đúng tên mẹ.
2. Android + Chrome: như trên.
3. Quét QR **in ra giấy** từ email.
4. Bấm "✓ Xác nhận check-in" → màn xanh → **tự quay lại camera sau ~2 giây**.
5. Quét lại đúng mẹ đó → thẻ hiện "Đã check-in lúc HH:mm · (Admin CheckIn)", nút chính là "Quét mẹ tiếp theo", nút "Check-in lại" là nút phụ ở dưới.
6. Từ chối quyền camera → hiện lỗi rõ ràng, ô nhập mã tay vẫn tra được.
7. Nhập mã tay sai định dạng → báo lỗi, không bắn request.
8. Chĩa camera vào QR wifi → không có gì xảy ra, camera vẫn quét.
9. Bật chế độ máy bay giữa lúc bấm xác nhận → hiện lỗi thật, **không có màn xanh**, bấm "Thử lại" ra đúng mẹ đó.
10. Mở `/admin` → dòng mẹ vừa quét có chữ `(Admin CheckIn)` dưới ô giờ.
11. Mở Google Sheet tab `register` → ba cột check-in đã điền, cột cuối ghi `(Admin CheckIn)`.
12. Vào `/admin` bỏ tick mẹ đó → Google Sheet về lại `—` / trống / trống.
13. Xuất Excel từ `/admin` → cột "Nguồn check-in" ghi `(Admin CheckIn)`.

- [ ] **Step 9: Commit**

```bash
git add src/components/QuetQrTool.tsx src/components/AdminDashboard.tsx
git commit -m "feat: quét QR xong hiện thẻ xác nhận, check-in hộ và tự quét mẹ tiếp theo"
```

---

## Ghi chú vận hành (nhắc lại từ spec)

**Nhân viên phải đăng nhập `/admin` vào sáng ngày 30/08.** Cookie phiên sống 12 giờ (`src/app/api/admin/login/route.ts:28`); ai đăng nhập từ tối hôm trước sẽ bị đá về trang login giữa lúc hàng đang dài, và mất luôn camera đang mở.

## Ngoài phạm vi kế hoạch này

- Bảng lịch sử check-in / audit log
- Chế độ offline hoặc hàng đợi ghi khi mất mạng
- Phân quyền nhiều tài khoản admin
- Gửi email hàng loạt — **spec riêng, brainstorm sau**
