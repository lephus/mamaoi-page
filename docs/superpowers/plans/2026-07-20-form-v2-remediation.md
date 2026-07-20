# Form v2 — Remediation Plan (R1–R6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đóng 3 MAJOR từ review Task 8, thêm field `chuDeKhac` (optional, tự do) chạy suốt từ form tới file export, và chốt migration SQL không có CHECK constraint trên `chu_de_quan_tam`.

**Architecture:** Vá tại chỗ trên nhánh `feat/form-dang-ky-v2`, KHÔNG sửa lại các task đã review sạch trừ chỗ có finding. Logic dựng payload được rút khỏi component vào `src/lib/` để lọt vào lưới test hiện có (`vitest.config.ts` chỉ include `src/**/*.test.ts`) — đây là cách rẻ nhất để có compile/test coverage cho tầng client mà không dựng hạ tầng test React.

**Tech Stack:** Next.js App Router, TypeScript strict, Zod 4.4.3, Vitest 4.1.10, Tailwind v4, Supabase, Brevo, Google Sheets.

## Global Constraints

- Copy hiển thị là tiếng Việt, wording đã duyệt với khách — không tự "cải thiện" chuỗi. Chuỗi mới trong plan này (`chuDeKhac`) là **đề xuất, chưa có khách duyệt** — xem "Cần khách chốt" ở cuối.
- Màu lấy từ CSS variable trong `src/app/globals.css` (nguồn Figma `BsY0hebT7YbydhUsEwNbtx`). **Không hardcode hex.**
- `VALUE_INPUT_OPTION` trong `sheets.ts` phải giữ `"RAW"`. Có test khoá.
- Không bao giờ để key Supabase lọt ra client (không `NEXT_PUBLIC_SUPABASE_*`). RLS đang TẮT theo lựa chọn của user.
- Bất biến route: Brevo lỗi → 502 thật. Mọi thứ SAU Brevo lỗi → chỉ log + `warnings`, không bao giờ làm hỏng request của mẹ.
- `registrationToRow` không được trả về cột check-in (`checked_in` / `checked_in_at` / `checked_in_source`) — annotation `Omit<...>` đang ép điều này ở compile-time. Giữ nguyên.
- Mọi task chạy đủ: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`. Vitest dùng esbuild và **KHÔNG check type** — `npm test` xanh không thay được `tsc`.

## Quyết định đã chốt (không mở lại trong khi thực thi)

1. **KHÔNG thêm CHECK constraint cho `chu_de_quan_tam`.** Danh sách 9 chủ đề chưa được khách chốt; ràng buộc DB phải sửa lockstep với code sẽ biến một danh sách còn động thành chi phí mỗi lần đổi. Zod là hàng rào ở đường ghi duy nhất hiện có.
2. **`chuDeKhac` là cột RIÊNG (`chu_de_khac text`), không trộn vào `chu_de_quan_tam text[]`.** Trộn free text vào mảng phân khúc sẽ (a) phá phân khúc, (b) vỡ chuỗi nối bằng dấu phẩy gửi Brevo, (c) vỡ ô export.
3. **`chuDeKhac` KHÔNG gửi lên Brevo.** Lý do: free text không phân khúc được, và mỗi attribute mới bắt buộc phải tạo tay trên Brevo dashboard — thiếu là `upsertContact` ném lỗi → đăng ký 502. Bớt một bước tay là bớt một ngòi nổ trước ngày 25/07. Giá trị của field này là nghiên cứu, ops đọc từ file export.
4. **Giữ ràng buộc "chọn ít nhất 1 chủ đề".** `chuDeKhac` là phần thêm, không phải đường thoát.

## Thứ tự thực thi

R1 → R2 → R3 → R4 → R5 → R6, rồi mới tới Task 9 / 10 / 11 của plan gốc
(`docs/superpowers/plans/2026-07-20-form-dang-ky-v2.md`).

Lý do thứ tự: R3 đổi export từ 21 → **22 cột**, mà Task 9 (route export) và Task 10 (admin) đều tiêu thụ nó. Làm R3 sau Task 9/10 thì phải sửa hai lần.

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `src/lib/validation.ts` | Sửa (message discriminator, `chungSchema`, `chuDeKhac`) | R1, R3 |
| `src/app/api/dang-ky/route.ts` | Sửa (gộp lỗi field chung khi union short-circuit) | R1 |
| `src/app/api/dang-ky/route.test.ts` | **Tạo** — test đường 400, không cần mock | R1 |
| `src/lib/registration-payload.ts` | **Tạo** — hàm thuần dựng payload, rút khỏi component | R2 |
| `src/lib/registration-payload.test.ts` | **Tạo** — lưới bắt đảo nhánh | R2, R4 |
| `supabase/2026-07-20-form-v2.sql` | Sửa (`chu_de_khac`, bỏ comment sai) | R3 |
| `src/lib/supabase.ts` | Sửa (`chu_de_khac` vào type + mapping) | R3 |
| `src/lib/export-rows.ts` | Sửa (21 → 22 cột) | R3 |
| `src/components/RegistrationForm.tsx` | Sửa (dùng hàm R2, ô `chuDeKhac`, a11y, ngày VN) | R2, R4, R5, R6 |
| `src/lib/time.ts` | Sửa (thêm `homNayVN`) | R6 |

`src/lib/brevo.ts` và `src/lib/sheets.ts` **không đổi** — `sheets.ts` đọc lại cột từ `export-rows.ts` nên tự theo; `brevo.ts` cố ý bỏ qua `chuDeKhac` (quyết định 3).

---

## Task R1: Lỗi tiếng Anh khi bỏ trống "Tình trạng hiện tại"

**Bối cảnh (đọc trước khi sửa):** `registrationSchema` là `z.discriminatedUnion`. Khi `trangThai` là `null`, Zod **short-circuit toàn bộ union** — không kiểm một field chung nào — và trả message mặc định tiếng Anh `"Invalid discriminator value. Expected 'mang_thai' | 'da_sinh'"`, được `route.ts:52` chuyển thẳng ra cho mẹ. Field "Tình trạng hiện tại" nằm giữa form, rất dễ lướt qua khi thao tác một tay.

Hai lỗi trong một: (a) chuỗi tiếng Anh, (b) mẹ chỉ thấy 1 lỗi rồi phải submit lại mới lộ 6 lỗi còn lại.

**KHÔNG được sửa bằng cách bỏ `discriminatedUnion`.** Kiểu union chính là thứ chặn cứng rò field giữa hai nhánh ở compile-time — Task 3 và Task 6 đều dựa vào nó (đã ghi trong `progress.md`). Phá nó là gỡ một bất biến đã được xác minh.

**Files:**
- Modify: `src/lib/validation.ts:88` (thêm `chungSchema`), `src/lib/validation.ts:95-124` (tham số thứ 3)
- Modify: `src/app/api/dang-ky/route.ts:48-58`
- Create: `src/app/api/dang-ky/route.test.ts`
- Modify: `src/lib/validation.test.ts` (thêm test message)

**Interfaces:**
- Produces: `chungSchema` — `z.ZodObject` chứa đúng các field chung, KHÔNG có `trangThai`/`thaiTuan`/`tenBe`/`beNgaySinh`/`beGioiTinh`. R3 sẽ thêm `chuDeKhac` vào `chungFields`, và `chungSchema` tự theo vì nó dựng từ `chungFields`.

- [ ] **Step 1: Viết test thất bại cho message tiếng Việt**

Thêm vào cuối `src/lib/validation.test.ts` (import `registrationSchema` đã có sẵn ở đầu file — KHÔNG thêm import giữa file, xem finding tồn đọng của Task 1):

```ts
describe("discriminator trangThai", () => {
  it("bỏ trống trangThai trả message tiếng Việt, không phải chuỗi Zod tiếng Anh", () => {
    const r = registrationSchema.safeParse({ nguon: "su-kien", trangThai: null });
    expect(r.success).toBe(false);
    const issue = r.error!.issues.find((i) => i.path[0] === "trangThai");
    expect(issue?.message).toBe("Vui lòng chọn tình trạng hiện tại");
  });

  it("không lọt chuỗi tiếng Anh nào ra ngoài", () => {
    const r = registrationSchema.safeParse({});
    expect(r.success).toBe(false);
    for (const i of r.error!.issues) {
      expect(i.message).not.toMatch(/Invalid discriminator/);
    }
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx vitest run src/lib/validation.test.ts`
Expected: FAIL — nhận được `"Invalid discriminator value. Expected 'mang_thai' | 'da_sinh'"`.

- [ ] **Step 3: Thêm tham số thứ 3 cho `discriminatedUnion`**

Trong `src/lib/validation.ts`, đổi dòng đóng của `registrationSchema` (hiện là `]);` ở dòng 124) thành:

```ts
  }),
  ],
  { error: "Vui lòng chọn tình trạng hiện tại" },
);
```

Tức chữ ký thành `z.discriminatedUnion("trangThai", [ ...hai z.object giữ nguyên... ], { error: "..." })`.

> Zod 4.4.3 dùng khoá `error`, KHÔNG phải `message`, cho tham số thứ 3 của `discriminatedUnion`. Đã verify: message rơi đúng vào `path: ["trangThai"]`.

- [ ] **Step 4: Export `chungSchema`**

Thêm ngay sau khối `chungFields` (sau dòng 88 `};`):

```ts
/**
 * Chỉ field chung, không có nhánh. Route dùng khối này để BỔ SUNG lỗi khi union
 * short-circuit: Zod bỏ qua toàn bộ field chung ngay khi `trangThai` sai, nên
 * mẹ bỏ trống "Tình trạng hiện tại" sẽ chỉ thấy đúng một lỗi rồi phải submit
 * lần hai mới biết còn thiếu email, SĐT, thành phố, chủ đề...
 */
export const chungSchema = z.object(chungFields);
```

- [ ] **Step 5: Gộp lỗi field chung trong route**

Trong `src/app/api/dang-ky/route.ts`, thêm `chungSchema` vào khối import từ `@/lib/validation` (giữ thứ tự alphabet hiện có — chèn ngay trước `generateCheckinCode`), rồi thay khối `if (!parsed.success) {...}` (dòng 48-58) bằng:

```ts
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    const thu = (issues: { path: PropertyKey[]; message: string }[]) => {
      for (const issue of issues) {
        const key = String(issue.path[0] ?? "form");
        fieldErrors[key] ??= issue.message;
      }
    };
    thu(parsed.error.issues);

    // Union short-circuit ở discriminator: khi `trangThai` sai, Zod KHÔNG kiểm
    // một field chung nào. Chạy thêm schema field chung để mẹ thấy hết chỗ
    // thiếu trong MỘT lần, thay vì sửa một lỗi rồi submit lại mới lộ ra sáu.
    if (schema === registrationSchema) {
      const chung = chungSchema.safeParse(body);
      if (!chung.success) thu(chung.error.issues);
    }

    return NextResponse.json(
      { error: "Vui lòng kiểm tra lại thông tin", fieldErrors },
      { status: 400 },
    );
  }
```

`??=` giữ nguyên thứ tự ưu tiên: lỗi từ union thắng lỗi từ `chungSchema` khi trùng key.

- [ ] **Step 6: Viết test route**

Tạo `src/app/api/dang-ky/route.test.ts`. Đường 400 trả về TRƯỚC mọi lệnh gọi dịch vụ ngoài, nên không cần mock gì:

```ts
import { describe, expect, it } from "vitest";
import { POST } from "./route";

function post(body: unknown): Request {
  return new Request("http://localhost/api/dang-ky", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/dang-ky — gộp lỗi khi thiếu trangThai", () => {
  it("trả lỗi trangThai VÀ lỗi field chung trong cùng một lần", async () => {
    const res = await POST(post({ nguon: "su-kien" }));
    expect(res.status).toBe(400);
    const { fieldErrors } = await res.json();

    expect(fieldErrors.trangThai).toBe("Vui lòng chọn tình trạng hiện tại");
    // Đây là phần mà union short-circuit đã nuốt mất trước khi sửa:
    expect(fieldErrors.hoTen).toBe("Vui lòng nhập họ tên");
    expect(fieldErrors.email).toBeTruthy();
    expect(fieldErrors.sdt).toBe("Số điện thoại không hợp lệ");
    expect(fieldErrors.tinhThanh).toBe("Vui lòng chọn thành phố");
    expect(fieldErrors.chuDeQuanTam).toBe("Vui lòng chọn ít nhất một chủ đề");
    expect(fieldErrors.dongYNhanTin).toBe("Vui lòng đồng ý để hoàn tất đăng ký");
  });

  it("waitlist không bị dính schema sự kiện", async () => {
    const res = await POST(post({ nguon: "app-waitlist", email: "hong" }));
    expect(res.status).toBe(400);
    const { fieldErrors } = await res.json();
    expect(fieldErrors.email).toBe("Email không hợp lệ");
    expect(fieldErrors.hoTen).toBeUndefined();
    expect(fieldErrors.trangThai).toBeUndefined();
  });
});
```

- [ ] **Step 7: Chạy toàn bộ kiểm chứng**

```bash
npx vitest run
npx tsc --noEmit
npm run lint
npm run build
```
Expected: test PASS (số test tăng), `tsc` không output, lint 0 error, build exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/lib/validation.ts src/lib/validation.test.ts src/app/api/dang-ky/route.ts src/app/api/dang-ky/route.test.ts
git commit -m "fix: bỏ trống tình trạng hiện tại không còn trả lỗi tiếng Anh, hiện hết lỗi trong một lần"
```

---

## Task R2: Đảo nhánh payload không có gì bắt được

**Bối cảnh:** Reviewer mutation-test đảo `...(daSinh` thành `...(!daSinh` ở `RegistrationForm.tsx:91` — mẹ đã sinh gửi `thaiTuan`, mẹ mang thai gửi thông tin bé, đảo ngược toàn bộ phân khúc. `tsc` exit 0, 76/76 test xanh. Nguyên nhân cấu trúc: object `payload` nằm trong component nên không file test nào chạm tới (`vitest.config.ts:10` include `src/**/*.test.ts`, mọi test đều ở `src/lib`).

Cách sửa: rút khối dựng payload ra hàm thuần trong `src/lib/` — nó lập tức lọt vào lưới test sẵn có, không cần dựng hạ tầng test React.

**Files:**
- Create: `src/lib/registration-payload.ts`
- Create: `src/lib/registration-payload.test.ts`
- Modify: `src/components/RegistrationForm.tsx:5-7` (import), `:74-98` (thay khối payload)

**Interfaces:**
- Produces: `buildRegistrationPayload(fd: FormData, chuDe: string[]): Record<string, unknown>` — R4 sẽ thêm `chuDeKhac` vào hàm này.
- Consumes: không có gì từ R1.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/registration-payload.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildRegistrationPayload } from "./registration-payload";
import { registrationSchema } from "./validation";

/** Dựng FormData đúng như DOM trả về sau khi mẹ điền form. */
function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

const CHUNG = {
  hoTen: "Nguyễn Thị An",
  email: "an@example.com",
  sdt: "0912345678",
  facebook: "",
  tinhThanh: "TP. Hồ Chí Minh",
  nguonBietDen: "facebook",
  dongYNhanTin: "on",
};

describe("buildRegistrationPayload", () => {
  it("nhánh mang thai gửi thaiTuan và KHÔNG gửi field bé", () => {
    const p = buildRegistrationPayload(
      fd({ ...CHUNG, trangThai: "mang_thai", thaiTuan: "20" }),
      ["thai_ky"],
    );
    expect(p.thaiTuan).toBe("20");
    expect("tenBe" in p).toBe(false);
    expect("beNgaySinh" in p).toBe(false);
    expect("beGioiTinh" in p).toBe(false);
  });

  it("nhánh đã sinh gửi field bé và KHÔNG gửi thaiTuan", () => {
    const p = buildRegistrationPayload(
      fd({
        ...CHUNG,
        trangThai: "da_sinh",
        tenBe: "Bé Bơ",
        beNgaySinh: "2026-01-25",
        beGioiTinh: "nu",
      }),
      ["an_dam", "ngu"],
    );
    expect(p.tenBe).toBe("Bé Bơ");
    expect(p.beNgaySinh).toBe("2026-01-25");
    expect(p.beGioiTinh).toBe("nu");
    expect("thaiTuan" in p).toBe(false);
  });

  // Mẹ chọn "đã sinh", điền tên bé, rồi đổi ý sang "mang thai". Nếu input cũ
  // còn sót trong DOM thì FormData vẫn mang giá trị đó — payload không được
  // chuyển tiếp nó sang nhánh mới.
  it("giá trị thừa của nhánh kia bị loại, không rò sang", () => {
    const p = buildRegistrationPayload(
      fd({
        ...CHUNG,
        trangThai: "mang_thai",
        thaiTuan: "20",
        tenBe: "Bé Bơ",
        beGioiTinh: "nu",
      }),
      ["thai_ky"],
    );
    expect("tenBe" in p).toBe(false);
    expect("beGioiTinh" in p).toBe(false);
  });

  it("cả hai nhánh parse sạch qua registrationSchema", () => {
    const mangThai = buildRegistrationPayload(
      fd({ ...CHUNG, trangThai: "mang_thai", thaiTuan: "20" }),
      ["thai_ky"],
    );
    const daSinh = buildRegistrationPayload(
      fd({
        ...CHUNG,
        trangThai: "da_sinh",
        tenBe: "Bé Bơ",
        beNgaySinh: "2026-01-25",
        beGioiTinh: "nu",
      }),
      ["an_dam"],
    );
    expect(registrationSchema.safeParse(mangThai).success).toBe(true);
    expect(registrationSchema.safeParse(daSinh).success).toBe(true);
  });

  it("checkbox không tick thành false, có tick thành true", () => {
    const khong = buildRegistrationPayload(
      fd({ ...CHUNG, trangThai: "mang_thai", thaiTuan: "20" }),
      ["thai_ky"],
    );
    expect(khong.diCungChong).toBe(false);
    expect(khong.dongYNhanTin).toBe(true);

    const co = buildRegistrationPayload(
      fd({ ...CHUNG, trangThai: "mang_thai", thaiTuan: "20", diCungChong: "on" }),
      ["thai_ky"],
    );
    expect(co.diCungChong).toBe(true);
  });

  it("chuDe đi thẳng từ state, không qua FormData", () => {
    const p = buildRegistrationPayload(
      fd({ ...CHUNG, trangThai: "mang_thai", thaiTuan: "20" }),
      ["thai_ky", "ivf"],
    );
    expect(p.chuDeQuanTam).toEqual(["thai_ky", "ivf"]);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx vitest run src/lib/registration-payload.test.ts`
Expected: FAIL — `Failed to resolve import "./registration-payload"`.

- [ ] **Step 3: Tạo `src/lib/registration-payload.ts`**

```ts
/**
 * Dựng payload gửi lên `POST /api/dang-ky` từ FormData của form đăng ký.
 *
 * Tách khỏi component vì đây là chỗ DUY NHẤT quyết định mẹ mang thai gửi field
 * gì và mẹ đã sinh gửi field gì. Đảo nhầm hai nhánh là đảo ngược đúng phép phân
 * khúc mà cả tính năng này sinh ra để làm — mà khi khối này còn nằm trong
 * component thì `tsc` lẫn toàn bộ test đều không chạm tới được (vitest chỉ
 * include `src/**` `/*.test.ts`, và payload là object literal rời không gắn kiểu).
 * Nằm ở đây thì test bắt được.
 *
 * `chuDe` truyền vào từ React state chứ không đọc FormData: checkbox chủ đề cố
 * ý không có thuộc tính `name` để state là nguồn sự thật duy nhất.
 */
export function buildRegistrationPayload(
  fd: FormData,
  chuDe: string[],
): Record<string, unknown> {
  const daSinh = fd.get("trangThai") === "da_sinh";
  return {
    nguon: "su-kien" as const,
    hoTen: String(fd.get("hoTen") ?? ""),
    email: String(fd.get("email") ?? ""),
    sdt: String(fd.get("sdt") ?? ""),
    facebook: String(fd.get("facebook") ?? ""),
    tinhThanh: String(fd.get("tinhThanh") ?? ""),
    trangThai: fd.get("trangThai"),
    chuDeQuanTam: chuDe,
    nguonBietDen: fd.get("nguonBietDen"),
    diCungChong: fd.get("diCungChong") === "on",
    dongYNhanTin: fd.get("dongYNhanTin") === "on",
    website: String(fd.get("website") ?? ""),
    // Chỉ gửi field của nhánh ĐANG chọn. Nhánh kia để vắng mặt hẳn — schema
    // sẽ cắt bỏ, nhưng gửi đúng ngay từ đây thì thông báo lỗi cũng đúng chỗ.
    ...(daSinh
      ? {
          tenBe: String(fd.get("tenBe") ?? ""),
          beNgaySinh: String(fd.get("beNgaySinh") ?? ""),
          beGioiTinh: fd.get("beGioiTinh"),
        }
      : { thaiTuan: fd.get("thaiTuan") }),
  };
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npx vitest run src/lib/registration-payload.test.ts`
Expected: PASS (6 test).

- [ ] **Step 5: Cho component dùng hàm mới**

Trong `src/components/RegistrationForm.tsx`, thêm import (đặt sau import `constants`, giữ nhóm `@/lib` liền nhau):

```ts
import { buildRegistrationPayload } from "@/lib/registration-payload";
```

Thay dòng 74-98 (từ `const fd = new FormData(...)` tới hết object `payload`) bằng:

```ts
    const fd = new FormData(e.currentTarget);
    const payload = buildRegistrationPayload(fd, chuDe);
```

Xoá biến `daSinh` cũ ở dòng 75 — nó chỉ phục vụ khối vừa bị rút đi. `tsc` sẽ báo nếu còn chỗ dùng.

- [ ] **Step 6: Mutation test — chứng minh lưới đã đóng**

Sửa TẠM `src/lib/registration-payload.ts`: đổi `...(daSinh` thành `...(!daSinh`. Chạy:

```bash
npx vitest run src/lib/registration-payload.test.ts
```
Expected: **FAIL** (ít nhất 3 test đỏ). Đây là chính xác đột biến mà trước R2 đi lọt hoàn toàn.

Hoàn nguyên: `git checkout src/lib/registration-payload.ts` — KHÔNG commit bản đột biến. Chạy lại test, xác nhận xanh.

- [ ] **Step 7: Chạy toàn bộ kiểm chứng**

```bash
npx vitest run && npx tsc --noEmit && npm run lint && npm run build
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/registration-payload.ts src/lib/registration-payload.test.ts src/components/RegistrationForm.tsx
git commit -m "refactor: rút dựng payload ra lib để test bắt được đảo nhánh mang thai/đã sinh"
```

---

## Task R3: Thêm `chuDeKhac` — tầng dữ liệu

**Files:**
- Modify: `supabase/2026-07-20-form-v2.sql:3` (comment sai), `:6-12` (thêm cột)
- Modify: `src/lib/validation.ts` (`chungFields`, sau `chuDeQuanTam`)
- Modify: `src/lib/supabase.ts:27` (type), `:99` (mapping)
- Modify: `src/lib/export-rows.ts:22` (header), `:60` (ô dữ liệu)
- Modify: `src/lib/export-rows.test.ts`, `src/lib/supabase-rows.test.ts`, `src/lib/validation.test.ts`

**Interfaces:**
- Consumes: `chungSchema` từ R1 — tự nhận `chuDeKhac` vì dựng từ `chungFields`.
- Produces: `RegistrationRow.chu_de_khac: string | null`; export **22 cột**, `"Chủ đề khác"` nằm ngay sau `"Chủ đề quan tâm"`.

- [ ] **Step 1: Viết test thất bại**

Thêm vào `src/lib/validation.test.ts`:

```ts
describe("chuDeKhac", () => {
  const base = {
    nguon: "su-kien",
    hoTen: "Nguyễn Thị An",
    email: "an@example.com",
    sdt: "0912345678",
    tinhThanh: "TP. Hồ Chí Minh",
    chuDeQuanTam: ["thai_ky"],
    nguonBietDen: "facebook",
    dongYNhanTin: true,
    trangThai: "mang_thai",
    thaiTuan: 20,
  };

  it("vắng mặt vẫn hợp lệ — field optional", () => {
    expect(registrationSchema.safeParse(base).success).toBe(true);
  });

  it("chuỗi rỗng vẫn hợp lệ", () => {
    expect(registrationSchema.safeParse({ ...base, chuDeKhac: "" }).success).toBe(true);
  });

  it("nhận nội dung tự do", () => {
    const r = registrationSchema.safeParse({ ...base, chuDeKhac: "Trầm cảm sau sinh" });
    expect(r.success).toBe(true);
    expect(r.data!.chuDeKhac).toBe("Trầm cảm sau sinh");
  });

  it("quá 200 ký tự bị chặn kèm message tiếng Việt", () => {
    const r = registrationSchema.safeParse({ ...base, chuDeKhac: "a".repeat(201) });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].message).toBe("Chủ đề khác không được vượt quá 200 ký tự");
  });

  it("KHÔNG thay thế được ràng buộc chọn ít nhất một chủ đề", () => {
    const r = registrationSchema.safeParse({
      ...base,
      chuDeQuanTam: [],
      chuDeKhac: "Trầm cảm sau sinh",
    });
    expect(r.success).toBe(false);
  });
});
```

Thêm vào `src/lib/supabase-rows.test.ts` (fixture sẵn có: `chung`, `mangThai`, `daSinh`, `MOC` — khai ở dòng 5-21):

```ts
it("chuDeKhac rỗng thành null, có nội dung thì giữ nguyên", () => {
  const rong = registrationToRow(
    { ...mangThai, chuDeKhac: "" } as Registration,
    "MO-ABC234",
    MOC,
  );
  expect(rong.chu_de_khac).toBeNull();

  const co = registrationToRow(
    { ...mangThai, chuDeKhac: "Trầm cảm sau sinh" } as Registration,
    "MO-ABC234",
    MOC,
  );
  expect(co.chu_de_khac).toBe("Trầm cảm sau sinh");
});

it("chuDeKhac vắng mặt cũng thành null", () => {
  const r = registrationToRow(mangThai, "MO-ABC234", MOC);
  expect(r.chu_de_khac).toBeNull();
});
```

Thêm vào `src/lib/export-rows.test.ts` (fixture sẵn có: `base: RegistrationRow` khai ở dòng 5):

```ts
it("có 22 cột, 'Chủ đề khác' ngay sau 'Chủ đề quan tâm'", () => {
  const { headers } = rowsToSheet([]);
  expect(headers).toHaveLength(22);
  expect(headers.indexOf("Chủ đề khác")).toBe(headers.indexOf("Chủ đề quan tâm") + 1);
});

// Đọc giá trị THEO VỊ TRÍ CỦA NHÃN, không phải toContain. Đây là kiểu assert
// duy nhất bắt được lỗi lệch cột — mà file 22 cột này ops đọc trực tiếp.
it("giá trị chủ đề khác nằm đúng cột của nó", () => {
  const { headers, rows } = rowsToSheet([
    { ...base, chu_de_quan_tam: ["thai_ky"], chu_de_khac: "Trầm cảm sau sinh" },
  ]);
  expect(rows[0][headers.indexOf("Chủ đề khác")]).toBe("Trầm cảm sau sinh");
  expect(rows[0][headers.indexOf("Chủ đề quan tâm")]).toBe("Thai kỳ");
});

it("chu_de_khac null thành chuỗi rỗng, không phải chữ 'null'", () => {
  const { headers, rows } = rowsToSheet([{ ...base, chu_de_khac: null }]);
  expect(rows[0][headers.indexOf("Chủ đề khác")]).toBe("");
});
```

> `base` là `RegistrationRow` đầy đủ. Sau Step 5, `tsc` sẽ báo `base` thiếu property `chu_de_khac` — thêm `chu_de_khac: null,` vào fixture đó (ngay sau `chu_de_quan_tam`). Đó là compiler ép, không phải tuỳ chọn.

- [ ] **Step 2: Chạy test, xác nhận FAIL**

```bash
npx vitest run src/lib/validation.test.ts src/lib/supabase-rows.test.ts src/lib/export-rows.test.ts
```
Expected: FAIL — 21 cột, chưa có `chu_de_khac`.

- [ ] **Step 3: Thêm field vào `chungFields`**

Trong `src/lib/validation.ts`, chèn ngay SAU khối `chuDeQuanTam` (dòng 68-70) và TRƯỚC `nguonBietDen`:

```ts
  /**
   * Ô tự do đi KÈM `chuDeQuanTam`, không thay thế nó. Danh sách 9 chủ đề chưa
   * được khách chốt — 500 mẹ đầu tiên chính là cách phát hiện danh sách thật.
   * Cố ý KHÔNG gộp vào mảng `chuDeQuanTam`: trộn text tự do vào mảng phân khúc
   * sẽ phá phân khúc và vỡ chuỗi nối bằng dấu phẩy khi xuất ra Sheet.
   */
  chuDeKhac: z
    .string()
    .trim()
    .max(200, "Chủ đề khác không được vượt quá 200 ký tự")
    .optional(),
```

> Cố ý KHÔNG kèm `.or(z.literal(""))` như `facebook` ngay phía trên. Đã verify trên Zod 4.4.3: với `.optional()` không thôi, cả bốn ca (`""`, vắng mặt, `"  x  "` → trim thành `"x"`, 201 ký tự → `too_big` đúng message, `path: ["chuDeKhac"]`) cho kết quả **giống hệt** bản có `.or`. Mệnh đề đó là no-op — thêm vào chỉ để trông giống hàng xóm là thêm thứ reviewer phải đi chứng minh lại.

- [ ] **Step 4: Thêm cột vào `supabase.ts`**

Trong `src/lib/supabase.ts`, thêm ngay sau `chu_de_quan_tam: string[];` (dòng 27):

```ts
  /** Ô tự do kèm `chu_de_quan_tam`. Null khi mẹ để trống. */
  chu_de_khac: string | null;
```

Trong `registrationToRow`, thêm ngay sau `chu_de_quan_tam: data.chuDeQuanTam,` (dòng 99):

```ts
    chu_de_khac: data.chuDeKhac || null,
```

> `|| null` chứ không `?? null`: chuỗi rỗng phải thành null, không phải `""`.

- [ ] **Step 5: Thêm cột vào `export-rows.ts`**

Trong `HEADERS`, chèn ngay sau `"Chủ đề quan tâm",` (dòng 22):

```ts
  "Chủ đề khác",
```

Trong `rowsToSheet`, chèn ngay sau `r.chu_de_quan_tam.map(chuDeLabel).join(", "),` (dòng 60):

```ts
      r.chu_de_khac ?? "",
```

Cập nhật comment đầu file (dòng 6): `21 cột` → `22 cột`.

- [ ] **Step 6: Cập nhật migration SQL**

Trong `supabase/2026-07-20-form-v2.sql`:

Sửa dòng 3 — comment hiện nói "An toàn để drop cột" nhưng file không có `drop column` nào. Thay bằng:

```sql
-- Chỉ thêm cột và constraint, KHÔNG drop gì. Chạy lại nhiều lần vẫn an toàn.
```

Thêm `chu_de_khac` vào khối `alter table` đầu (sau `chu_de_quan_tam`, dòng 11):

```sql
  add column if not exists chu_de_khac     text,
```

**KHÔNG thêm CHECK constraint cho `chu_de_quan_tam`** (quyết định 1). Thêm comment ghi lại lý do, ngay trên khối constraint `nguon_biet_den`:

```sql
-- Cố ý KHÔNG ràng buộc giá trị của chu_de_quan_tam: danh sách 9 chủ đề chưa
-- được khách chốt, và constraint ở đây sẽ phải sửa lockstep với constants.ts
-- mỗi lần danh sách đổi — quên một bên là đăng ký chết. Zod chặn ở đường ghi.
```

- [ ] **Step 7: Chạy test, xác nhận PASS**

```bash
npx vitest run && npx tsc --noEmit && npm run lint && npm run build
```
Expected: toàn bộ PASS. `sheets.test.ts` phải tự xanh — `sheets.ts` đọc lại cột từ `export-rows.ts` chứ không tự khai mảng.

- [ ] **Step 8: Commit**

```bash
git add supabase/2026-07-20-form-v2.sql src/lib/validation.ts src/lib/supabase.ts src/lib/export-rows.ts src/lib/validation.test.ts src/lib/supabase-rows.test.ts src/lib/export-rows.test.ts
git commit -m "feat: thêm chuDeKhac (ô tự do) vào schema, DB và file export 22 cột"
```

---

## Task R4: Thêm `chuDeKhac` — giao diện

**Files:**
- Modify: `src/lib/registration-payload.ts`, `src/lib/registration-payload.test.ts`
- Modify: `src/components/RegistrationForm.tsx` (chèn sau `Field` "Chủ đề mẹ quan tâm", dòng ~368)

- [ ] **Step 1: Viết test thất bại**

Thêm vào `src/lib/registration-payload.test.ts`:

```ts
it("gửi chuDeKhac khi mẹ có điền", () => {
  const p = buildRegistrationPayload(
    fd({ ...CHUNG, trangThai: "mang_thai", thaiTuan: "20", chuDeKhac: "Trầm cảm sau sinh" }),
    ["thai_ky"],
  );
  expect(p.chuDeKhac).toBe("Trầm cảm sau sinh");
});

it("chuDeKhac bỏ trống thành chuỗi rỗng, vẫn parse sạch", () => {
  const p = buildRegistrationPayload(
    fd({ ...CHUNG, trangThai: "mang_thai", thaiTuan: "20" }),
    ["thai_ky"],
  );
  expect(p.chuDeKhac).toBe("");
  expect(registrationSchema.safeParse(p).success).toBe(true);
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx vitest run src/lib/registration-payload.test.ts`
Expected: FAIL — `expected undefined to be "Trầm cảm sau sinh"`.

- [ ] **Step 3: Thêm vào `buildRegistrationPayload`**

Trong `src/lib/registration-payload.ts`, chèn ngay sau `chuDeQuanTam: chuDe,`:

```ts
    chuDeKhac: String(fd.get("chuDeKhac") ?? ""),
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npx vitest run src/lib/registration-payload.test.ts`

- [ ] **Step 5: Thêm ô nhập vào form**

Trong `src/components/RegistrationForm.tsx`, chèn NGAY SAU khối `</Field>` đóng của "Chủ đề mẹ quan tâm" (dòng 368) và TRƯỚC `<Field label="Mẹ biết đến chương trình từ đâu?"`:

```tsx
      <Field label="Chủ đề khác (nếu có)" htmlFor="chuDeKhac" error={errors.chuDeKhac}>
        <input
          id="chuDeKhac"
          name="chuDeKhac"
          type="text"
          maxLength={200}
          placeholder="Mẹ còn quan tâm điều gì khác không?"
          className={`${inputBase} ${ring("chuDeKhac")}`}
          {...err("chuDeKhac")}
        />
      </Field>
```

Không có `required` — field optional (quyết định 4).

- [ ] **Step 6: Chạy toàn bộ kiểm chứng**

```bash
npx vitest run && npx tsc --noEmit && npm run lint && npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/registration-payload.ts src/lib/registration-payload.test.ts src/components/RegistrationForm.tsx
git commit -m "feat: ô 'Chủ đề khác' tự do trên form đăng ký"
```

---

## Task R5: Nhóm lựa chọn — ngữ nghĩa a11y và hết trùng lặp

**Bối cảnh:** `Nhom` (`<fieldset>`/`<legend>`) đang được áp cho 2 nhóm *thị giác* mà con đã có label riêng, trong khi 4 nhóm control THẬT lại dùng `Field` với `<label htmlFor>` trỏ vào **một** option. Screen reader chỉ đọc tên nhóm ở option đầu tiên; 8 checkbox chủ đề và 4 radio nguồn còn lại không có ngữ cảnh nhóm. 3/4 chỗ là mới trong commit e6074df.

Kèm theo, cùng một khối: 6 chỗ hardcode `accent-[#f08f8c]` (vi phạm "không chế màu" của CLAUDE.md), hai cơ chế hiển thị trạng thái chọn khác nhau (ternary JS vs `has-checked:`), ba cỡ checkbox (`h-4`, `h-5`, `h-[18px]`), và `htmlFor` hardcode `chuDe-thai_ky` / `nguonBietDen-facebook` sẽ trỏ vào id không tồn tại nếu ai đó đổi thứ tự trong `constants.ts`.

**Files:**
- Modify: `src/components/RegistrationForm.tsx`

- [ ] **Step 1: Xác nhận `accent-primary` sinh ra CSS đúng**

```bash
npm run build && grep -rn "accent-color" .next/static/css/*.css | head
```
Expected: thấy `accent-color:var(--color-primary)`. Nếu KHÔNG thấy, dừng lại và báo — không được đoán.

- [ ] **Step 2: Thêm hai primitive nhóm lựa chọn**

Chèn ngay sau component `Nhom` (sau dòng 54):

```tsx
type LuaChon = { readonly value: string; readonly label: string };

/**
 * Nhóm lựa chọn dùng `<fieldset>`/`<legend>` chứ không `<label htmlFor>`: một
 * label chỉ trỏ được vào MỘT input, nên với nhóm 9 checkbox thì 8 cái còn lại
 * mất hẳn ngữ cảnh khi mẹ dùng trình đọc màn hình.
 *
 * `role="alert"` giữ nguyên trên thông báo lỗi — hàm cuộn-tới-lỗi-đầu-tiên
 * trong `onSubmit` bắt theo selector đó.
 */
function NhomChon({
  legend,
  error,
  required,
  luoi,
  children,
}: {
  legend: string;
  error?: string;
  required?: boolean;
  luoi: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset aria-invalid={error ? true : undefined}>
      <legend className="mb-1.5 block text-sm font-semibold text-ink">
        {legend}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </legend>
      <div className={`grid ${luoi}`}>{children}</div>
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** Một hàng lựa chọn. Cả hàng là vùng chạm — mẹ bấm một tay, không nhắm ô nhỏ. */
function HangChon({
  id,
  type,
  name,
  value,
  checked,
  onChange,
  label,
  nhanManh,
}: {
  id: string;
  type: "radio" | "checkbox";
  name?: string;
  value: string;
  checked?: boolean;
  onChange?: () => void;
  label: string;
  nhanManh?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 transition-colors hover:bg-primary-faded-hover has-checked:border-primary has-checked:bg-primary-faded"
    >
      <input
        id={id}
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className={`h-5 w-5 shrink-0 cursor-pointer accent-primary ${
          type === "checkbox" ? "rounded" : ""
        }`}
      />
      <span className={`text-base text-ink ${nhanManh ? "font-medium" : ""}`}>
        {label}
      </span>
    </label>
  );
}
```

Một cơ chế trạng thái duy nhất (`has-checked:`), một cỡ ô duy nhất (`h-5 w-5`), màu qua token.

**Ba thay đổi thị giác có chủ ý** (nhóm chủ đề + nguồn biết đến, trước đây nhỏ hơn hai nhóm kia):
`py-2.5` → `py-3`, `gap-2.5` → `gap-3`, ô `h-[18px]`/`h-4` → `h-5`. Vùng chạm to hơn có lợi cho thao tác một tay. `nhanManh` giữ nguyên đúng độ đậm chữ cũ của từng nhóm — không đổi.

- [ ] **Step 3: Chuyển 4 nhóm sang primitive mới**

Bốn khối, thay lần lượt. Chuỗi `legend` là **nguyên văn** chuỗi `label` của `Field` cũ — đã copy sẵn dưới đây, không gõ lại.

**(a)** Thay khối `<Field label="Tình trạng hiện tại" ...>` (dòng 216-250), GIỮ NGUYÊN comment `{/* The segmentation question... */}` ngay phía trên nó:

```tsx
      <NhomChon
        legend="Tình trạng hiện tại"
        error={errors.trangThai}
        required
        luoi="gap-3 sm:grid-cols-2"
      >
        {(
          [
            { value: "mang_thai", label: "Đang mang thai" },
            { value: "da_sinh", label: "Bé đã chào đời" },
          ] as const
        ).map((opt) => (
          <HangChon
            key={opt.value}
            id={`trangThai-${opt.value}`}
            type="radio"
            name="trangThai"
            value={opt.value}
            checked={trangThai === opt.value}
            onChange={() => setTrangThai(opt.value)}
            label={opt.label}
            nhanManh
          />
        ))}
      </NhomChon>
```

**(b)** Thay khối `<Field label="Giới tính" ...>` (dòng 306-334, nằm trong `<Nhom title="Thông tin bé">`):

```tsx
            <NhomChon
              legend="Giới tính"
              error={errors.beGioiTinh}
              required
              luoi="grid-cols-2 gap-3"
            >
              {(
                [
                  { value: "nam", label: "Bé trai" },
                  { value: "nu", label: "Bé gái" },
                ] as const
              ).map((opt) => (
                <HangChon
                  key={opt.value}
                  id={`beGioiTinh-${opt.value}`}
                  type="radio"
                  name="beGioiTinh"
                  value={opt.value}
                  label={opt.label}
                  nhanManh
                />
              ))}
            </NhomChon>
```

**(c)** Thay khối `<Field label="Chủ đề mẹ quan tâm" ...>` (dòng 340-368):

```tsx
      <NhomChon
        legend="Chủ đề mẹ quan tâm"
        error={errors.chuDeQuanTam}
        required
        luoi="gap-3 sm:grid-cols-2"
      >
        {CHU_DE_QUAN_TAM.map((c: LuaChon) => (
          <HangChon
            key={c.value}
            id={`chuDe-${c.value}`}
            type="checkbox"
            value={c.value}
            checked={chuDe.includes(c.value)}
            onChange={() => toggleChuDe(c.value)}
            label={c.label}
          />
        ))}
      </NhomChon>
```

**(d)** Thay khối `<Field label="Mẹ biết đến chương trình từ đâu?" ...>` (dòng 370-394):

```tsx
      <NhomChon
        legend="Mẹ biết đến chương trình từ đâu?"
        error={errors.nguonBietDen}
        required
        luoi="gap-3 sm:grid-cols-3"
      >
        {NGUON_BIET_DEN.map((n: LuaChon) => (
          <HangChon
            key={n.value}
            id={`nguonBietDen-${n.value}`}
            type="radio"
            name="nguonBietDen"
            value={n.value}
            label={n.label}
          />
        ))}
      </NhomChon>
```

> Số dòng ở trên là của bản HEAD hiện tại. R4 đã chèn ô "Chủ đề khác" giữa (c) và (d) nên các dòng sau đó dịch xuống ~11 — bám theo **chuỗi `label`** để định vị, đừng bám số dòng.

- [ ] **Step 4: Đổi 2 chỗ hardcode hex còn lại**

Hai checkbox độc lập (`diCungChong` dòng ~400, `dongYNhanTin` dòng ~408) không thuộc nhóm nào. Đổi `accent-[#f08f8c]` → `accent-primary` ở cả hai. Sau bước này `grep -n "f08f8c" src/components/RegistrationForm.tsx` phải không còn kết quả.

- [ ] **Step 5: Kiểm chứng**

```bash
grep -n "f08f8c" src/components/RegistrationForm.tsx    # expected: không có dòng nào
npx vitest run && npx tsc --noEmit && npm run lint && npm run build
```

- [ ] **Step 6: Kiểm bằng mắt trên trình duyệt**

```bash
npm run dev
```
Mở `http://localhost:3000/su-kien`, thu cửa sổ về bề ngang điện thoại. Xác nhận: 4 nhóm lựa chọn hiển thị y như trước khi refactor (viền hồng + nền hồng nhạt khi chọn), chọn/bỏ chọn chủ đề vẫn chạy, đổi "Tình trạng hiện tại" vẫn hiện/ẩn đúng khối.

- [ ] **Step 7: Commit**

```bash
git add src/components/RegistrationForm.tsx
git commit -m "refactor: nhóm lựa chọn dùng fieldset/legend, gộp trùng lặp, bỏ hex hardcode"
```

---

## Task R6: Ngày tối đa theo giờ VN + lỗi cũ đọng lại khi đổi nhánh

**Bối cảnh:** `max={new Date().toISOString().slice(0,10)}` là giờ UTC. Tại VN (UTC+7), từ 00:00 tới 07:00 giờ địa phương nó trả về **hôm qua** — chặn mẹ chọn bé sinh hôm nay. Riêng biệt: `errors` chỉ được xoá lúc submit, nên đổi "đã sinh" → "mang thai" → "đã sinh" sẽ remount field bé rỗng mà vẫn kèm thông báo đỏ của lần submit trước.

**Files:**
- Modify: `src/lib/time.ts`, `src/lib/time.test.ts`
- Modify: `src/components/RegistrationForm.tsx`

- [ ] **Step 1: Viết test thất bại**

Thêm vào `src/lib/time.test.ts`:

```ts
import { afterEach, vi } from "vitest";
import { homNayVN } from "./time";

describe("homNayVN", () => {
  afterEach(() => vi.useRealTimers());

  it("trả hôm nay theo giờ VN, không phải UTC", () => {
    vi.useFakeTimers();
    // 2026-07-20T23:30Z = 06:30 sáng 21/07 giờ VN. UTC nói 20, VN nói 21.
    vi.setSystemTime(new Date("2026-07-20T23:30:00Z"));
    expect(homNayVN()).toBe("2026-07-21");
  });

  it("không nhảy ngày ở giữa trưa VN", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T05:00:00Z")); // 12:00 trưa VN
    expect(homNayVN()).toBe("2026-07-20");
  });
});
```

> Gộp `vi`/`afterEach` vào khối import sẵn có ở ĐẦU file, không thêm import giữa file.

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx vitest run src/lib/time.test.ts`
Expected: FAIL — `homNayVN` chưa tồn tại.

- [ ] **Step 3: Thêm `homNayVN` vào `time.ts`**

Thêm vào cuối file, dùng lại hằng `VN_OFFSET_MS` sẵn có ở dòng 2:

```ts
/**
 * Hôm nay theo giờ VN, dạng "YYYY-MM-DD" — cho thuộc tính `max` của input date.
 * `new Date().toISOString()` là UTC: từ 00:00 tới 07:00 giờ VN nó trả về hôm
 * qua, chặn mất mẹ có bé sinh đúng hôm nay.
 */
export function homNayVN(): string {
  return new Date(Date.now() + VN_OFFSET_MS).toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npx vitest run src/lib/time.test.ts`

- [ ] **Step 5: Dùng trong form + xoá lỗi đọng**

Trong `src/components/RegistrationForm.tsx`, thêm `homNayVN` vào import từ `@/lib/time` (tạo import mới nếu chưa có), rồi đổi thuộc tính `max` của input `beNgaySinh`:

```tsx
          max={homNayVN()}
```

Và xoá lỗi đọng khi đổi nhánh. R5 (a) đã chuyển nhóm "Tình trạng hiện tại" sang `HangChon`; đổi prop `onChange` của nó từ `onChange={() => setTrangThai(opt.value)}` thành:

```tsx
            onChange={() => {
              setTrangThai(opt.value);
              // Đổi nhánh là unmount field của nhánh cũ. Không xoá lỗi ở đây
              // thì field vừa remount rỗng vẫn đeo thông báo đỏ của lần
              // submit trước — mẹ thấy lỗi cho ô mình chưa hề chạm tới.
              setErrors({});
            }}
```

Chỉ đổi đúng nhóm `trangThai`. Nhóm `beGioiTinh` không có `onChange` (uncontrolled) — để nguyên.

- [ ] **Step 6: Chạy toàn bộ kiểm chứng**

```bash
npx vitest run && npx tsc --noEmit && npm run lint && npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/time.ts src/lib/time.test.ts src/components/RegistrationForm.tsx
git commit -m "fix: ngày tối đa của ngày sinh bé theo giờ VN, xoá lỗi đọng khi đổi nhánh"
```

---

## Vá vào plan gốc

Sau R1–R6, ba chỗ trong `docs/superpowers/plans/2026-07-20-form-dang-ky-v2.md` đã lệch thực tế. Sửa trước khi chạy Task 9:

- [ ] Task 9 (route export): mọi chỗ nói "21 cột" → **22 cột**.
- [ ] Task 10 Step 4 (`AdminDetailModal`): thêm `chu_de_khac` vào danh sách field hiển thị, nhãn `"Chủ đề khác"`, ẩn hàng khi null.
- [ ] Task 11 (kiểm thử tay): thêm bước xác nhận ô "Chủ đề khác" ghi được xuống Supabase và xuất ra đúng cột trong file Excel.

## Việc tay của user — cập nhật

Thay thế mục cùng tên trong `.superpowers/sdd/progress.md`:

1. Chạy `supabase/2026-07-20-form-v2.sql` trong Supabase SQL editor (**bản đã có `chu_de_khac`** — chạy bản cũ thì thiếu cột, mọi lượt ghi sẽ vào `warnings: ["supabase"]`).
2. Tạo **6** attribute Brevo: `THAI_TUAN`, `TEN_BE`, `BE_NGAY_SINH`, `BE_GIOI_TINH`, `CHU_DE_QUAN_TAM`, `NGUON_BIET_DEN`. **Không cần `CHU_DE_KHAC`** — quyết định 3. Thiếu attribute → `upsertContact` ném lỗi → đăng ký 502.
3. Xoá header cũ trong Google Sheet (bản mới ghi **22 cột**).

## Cần khách chốt (không chặn code)

Chuỗi tiếng Việt của `chuDeKhac` do plan này tự đặt, chưa qua khách — khác với mọi copy khác trên form:

- Nhãn: **"Chủ đề khác (nếu có)"**
- Placeholder: **"Mẹ còn quan tâm điều gì khác không?"**
- Nhãn cột export: **"Chủ đề khác"**
- Lỗi quá dài: **"Chủ đề khác không được vượt quá 200 ký tự"**

Đổi chuỗi là sửa một dòng ở mỗi chỗ, an toàn tới sát ngày deploy.

## Không nằm trong plan này (đã cân nhắc, cố ý bỏ)

- **`recaptchaToken` không bao giờ được form gửi**, trong khi `route.ts:22` có `if (!token) return false`. Hiện vô hại vì `RECAPTCHA_SECRET_KEY` chưa set. Set biến đó lên production là **mọi đăng ký 400**. Lỗi có từ v1, không phải v2 — cần quyết định riêng: hoặc nối reCAPTCHA thật, hoặc gỡ hẳn nhánh kiểm tra. Đừng để nguyên trạng qua ngày 25/07.
- **Comment `src/lib/validation.ts:8`** vẫn nhắc `beThangTuoi` (field đã xoá từ Task 2). Sửa kèm khi nào chạm file — R1 và R3 đều chạm; implementer cứ sửa luôn, không cần task riêng.
- **Kiểu tĩnh của `chuDeQuanTam`/`nguonBietDen` là `string[]`/`string`** chứ không phải union literal (do `CHU_DE_VALUES` khai `readonly string[]`). Runtime validation vẫn đúng và có test phủ. Nợ kỹ thuật chấp nhận được — không sửa trước 25/07.
