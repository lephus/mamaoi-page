# Form đăng ký v2 + Waitlist vào Admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Form `/su-kien` nhận thêm thông tin bé, số tuần thai, chủ đề quan tâm và nguồn biết đến; waitlist app hiện trong `/admin` dưới tab riêng.

**Architecture:** `registrationSchema` thành discriminated union trên `trangThai` — schema tự ép quy tắc "mang thai thì không có thông tin bé", không phụ thuộc UI. Thứ tự cột tồn tại đúng MỘT chỗ (`HEADERS` trong `export-rows.ts`); Sheets đọc lại từ đó. Waitlist đi vào bảng Supabase riêng, không nới ràng buộc của `registrations`.

**Tech Stack:** Next.js 16 (App Router) · TypeScript · Zod 4 · Supabase JS · vitest · Tailwind

## Global Constraints

- **Copy tiếng Việt là wording khách duyệt** — không tự sửa nhãn field, tên sự kiện, thông báo lỗi ngoài những chuỗi plan này ghi rõ.
- **Không bao giờ làm hỏng lượt đăng ký vì lỗi hạ tầng phụ.** Brevo lỗi → 502 thật. Supabase/Sheets lỗi → chỉ `console.error` + đẩy vào `warnings`, vẫn trả `ok: true`. Giữ nguyên nguyên tắc ở `route.ts:88-89`.
- **Thứ tự cột chỉ được định nghĩa một nơi:** `HEADERS` trong `src/lib/export-rows.ts`. `sheets.ts` phải đi qua `rowsToSheet`, cấm tự viết mảng cột.
- **`VALUE_INPUT_OPTION` phải giữ nguyên `"RAW"`** — chặn formula injection từ ô nhập tự do và giữ số 0 đầu SĐT. Có test khoá giá trị này; đừng đổi.
- **Brevo `updateEnabled: true`** — chỉ gửi attribute khi nó có nghĩa. Gửi chuỗi rỗng sẽ xoá trắng dữ liệu cũ của mẹ đã đăng ký lần trước.
- Font/màu/token: không đụng. Dùng lại `inputBase`, `Field`, `Button` sẵn có.
- Chạy `npm test` sau mỗi task. Commit sau mỗi task.

---

### Task 1: Hằng số chủ đề/nguồn + hàm tính tháng tuổi

**Files:**
- Modify: `src/lib/constants.ts` (thêm vào cuối, sau `LEGAL_UPDATED`)
- Modify: `src/lib/validation.ts` (thêm hàm, chưa đụng schema)
- Test: `src/lib/validation.test.ts`

**Interfaces:**
- Consumes: không có (task đầu)
- Produces:
  - `CHU_DE_QUAN_TAM: readonly {value: string, label: string}[]` (9 phần tử)
  - `NGUON_BIET_DEN: readonly {value: string, label: string}[]` (5 phần tử)
  - `CHU_DE_VALUES: readonly string[]`, `NGUON_VALUES: readonly string[]`
  - `chuDeLabel(value: string): string`, `nguonBietDenLabel(value: string): string`
  - `thangTuoiTuNgaySinh(ngaySinh: Date, moc: Date): number`

- [ ] **Step 1: Viết test thất bại**

Thêm vào cuối `src/lib/validation.test.ts`:

```ts
import { thangTuoiTuNgaySinh } from "./validation";

describe("thangTuoiTuNgaySinh", () => {
  it("tròn tháng", () => {
    expect(
      thangTuoiTuNgaySinh(new Date("2026-01-20"), new Date("2026-07-20")),
    ).toBe(6);
  });

  it("chưa tới ngày trong tháng thì chưa tính tháng đó", () => {
    expect(
      thangTuoiTuNgaySinh(new Date("2026-01-25"), new Date("2026-07-20")),
    ).toBe(5);
  });

  it("cùng tháng trả 0", () => {
    expect(
      thangTuoiTuNgaySinh(new Date("2026-07-01"), new Date("2026-07-20")),
    ).toBe(0);
  });

  it("qua năm", () => {
    expect(
      thangTuoiTuNgaySinh(new Date("2024-07-20"), new Date("2026-07-20")),
    ).toBe(24);
  });

  it("ngày sinh ở tương lai trả số âm (caller tự chặn)", () => {
    expect(
      thangTuoiTuNgaySinh(new Date("2026-08-20"), new Date("2026-07-20")),
    ).toBe(-1);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx vitest run src/lib/validation.test.ts`
Expected: FAIL — `thangTuoiTuNgaySinh is not a function` / lỗi import.

- [ ] **Step 3: Thêm hằng số vào `src/lib/constants.ts`**

Thêm vào cuối file:

```ts
/**
 * Chủ đề quan tâm — chọn nhiều. `value` là thứ lưu xuống DB và gửi Brevo;
 * `label` là chữ hiện trên form (wording khách duyệt, đừng sửa).
 */
export const CHU_DE_QUAN_TAM = [
  { value: "thai_ky", label: "Thai kỳ" },
  { value: "ivf", label: "IVF" },
  { value: "an_dam", label: "Ăn dặm" },
  { value: "ngu", label: "Ngủ" },
  { value: "tiem_chung", label: "Tiêm chủng" },
  { value: "phat_trien_nao", label: "Phát triển não" },
  { value: "van_dong", label: "Vận động" },
  { value: "sua_me", label: "Nuôi con bằng sữa mẹ" },
  { value: "sau_sinh", label: "Sau sinh" },
] as const;

/** Nguồn biết đến chương trình — chọn một. */
export const NGUON_BIET_DEN = [
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "ban_be", label: "Bạn bè" },
  { value: "khac", label: "Khác" },
] as const;

export const CHU_DE_VALUES = CHU_DE_QUAN_TAM.map((c) => c.value) as readonly string[];
export const NGUON_VALUES = NGUON_BIET_DEN.map((n) => n.value) as readonly string[];

const CHU_DE_MAP = new Map(CHU_DE_QUAN_TAM.map((c) => [c.value, c.label]));
const NGUON_MAP = new Map(NGUON_BIET_DEN.map((n) => [n.value, n.label]));

/** Giá trị lạ trả về chính nó — export không bao giờ được nuốt mất dữ liệu. */
export function chuDeLabel(value: string): string {
  return CHU_DE_MAP.get(value) ?? value;
}

export function nguonBietDenLabel(value: string): string {
  return NGUON_MAP.get(value) ?? value;
}
```

- [ ] **Step 4: Thêm hàm vào `src/lib/validation.ts`**

Thêm sau `const VN_PHONE = ...`:

```ts
/**
 * Số tháng tròn từ ngày sinh tới mốc. Chỉ đếm tháng ĐÃ QUA đủ ngày: bé sinh
 * 25/01 tới 20/07 là 5 tháng, không phải 6 — mốc "mấy tháng tuổi" của mẹ luôn
 * là ngày kỷ niệm hàng tháng, không phải số tháng lịch chênh nhau.
 *
 * Trả số âm nếu ngày sinh ở tương lai; caller chịu trách nhiệm chặn.
 */
export function thangTuoiTuNgaySinh(ngaySinh: Date, moc: Date): number {
  let thang =
    (moc.getFullYear() - ngaySinh.getFullYear()) * 12 +
    (moc.getMonth() - ngaySinh.getMonth());
  if (moc.getDate() < ngaySinh.getDate()) thang -= 1;
  return thang;
}
```

- [ ] **Step 5: Chạy test, xác nhận PASS**

Run: `npx vitest run src/lib/validation.test.ts`
Expected: PASS — toàn bộ, kể cả 2 test `isValidCheckinCode` cũ.

- [ ] **Step 6: Commit**

```bash
git add src/lib/constants.ts src/lib/validation.ts src/lib/validation.test.ts
git commit -m "feat: hằng số chủ đề/nguồn biết đến + hàm tính tháng tuổi từ ngày sinh"
```

---

### Task 2: Schema đăng ký v2 — discriminated union

**Files:**
- Modify: `src/lib/validation.ts:28-89`
- Test: `src/lib/validation.test.ts`

**Interfaces:**
- Consumes: `CHU_DE_VALUES`, `NGUON_VALUES` (Task 1), `thangTuoiTuNgaySinh` (Task 1)
- Produces:
  - `registrationSchema` — discriminated union trên `trangThai`
  - `type Registration` — union của hai nhánh
  - `isRegistration(s: Submission): s is Registration` — giữ nguyên chữ ký
  - Nhánh `mang_thai` có `thaiTuan: number`; nhánh `da_sinh` có `tenBe: string`, `beNgaySinh: Date`, `beGioiTinh: "nam" | "nu"`
  - Field chung: `hoTen`, `email`, `sdt`, `facebook?`, `tinhThanh`, `chuDeQuanTam: string[]`, `nguonBietDen: string`, `diCungChong: boolean`, `dongYNhanTin: true`

**Lưu ý quan trọng về Zod:** zod **cắt bỏ** key lạ chứ không báo lỗi. Nên gửi `tenBe` kèm `trangThai: "mang_thai"` sẽ **parse thành công** và `tenBe` biến mất khỏi kết quả. Đó là hành vi mong muốn (dữ liệu không bao giờ tới DB) — test phải khẳng định *không có thuộc tính đó*, đừng kỳ vọng lỗi.

- [ ] **Step 1: Viết test thất bại**

Thêm vào `src/lib/validation.test.ts`:

```ts
import { registrationSchema } from "./validation";
import { CHU_DE_VALUES } from "./constants";

const chung = {
  nguon: "su-kien" as const,
  hoTen: "Nguyễn Thị Lan",
  email: "lan@example.com",
  sdt: "0901234567",
  tinhThanh: "TP. Hồ Chí Minh",
  chuDeQuanTam: ["an_dam", "ngu"],
  nguonBietDen: "facebook",
  diCungChong: false,
  dongYNhanTin: true,
};

const mangThai = { ...chung, trangThai: "mang_thai" as const, thaiTuan: 20 };
const daSinh = {
  ...chung,
  trangThai: "da_sinh" as const,
  tenBe: "Gạo",
  beNgaySinh: "2026-01-20",
  beGioiTinh: "nu" as const,
};

describe("registrationSchema — nhánh mang_thai", () => {
  it("hợp lệ khi đủ thaiTuan", () => {
    expect(registrationSchema.safeParse(mangThai).success).toBe(true);
  });

  it("thiếu thaiTuan thì lỗi", () => {
    const { thaiTuan, ...thieu } = mangThai;
    expect(registrationSchema.safeParse(thieu).success).toBe(false);
  });

  it("thaiTuan 0 hoặc 43 đều lỗi", () => {
    expect(registrationSchema.safeParse({ ...mangThai, thaiTuan: 0 }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...mangThai, thaiTuan: 43 }).success).toBe(false);
  });

  it("gửi kèm thông tin bé thì bị CẮT BỎ, không lưu", () => {
    const r = registrationSchema.safeParse({ ...mangThai, tenBe: "Gạo" });
    expect(r.success).toBe(true);
    expect(r.data).not.toHaveProperty("tenBe");
  });
});

describe("registrationSchema — nhánh da_sinh", () => {
  it("hợp lệ khi đủ thông tin bé", () => {
    expect(registrationSchema.safeParse(daSinh).success).toBe(true);
  });

  it("thiếu beNgaySinh thì lỗi", () => {
    const { beNgaySinh, ...thieu } = daSinh;
    expect(registrationSchema.safeParse(thieu).success).toBe(false);
  });

  it("thiếu tenBe thì lỗi", () => {
    const { tenBe, ...thieu } = daSinh;
    expect(registrationSchema.safeParse(thieu).success).toBe(false);
  });

  it("giới tính lạ thì lỗi", () => {
    expect(
      registrationSchema.safeParse({ ...daSinh, beGioiTinh: "khac" }).success,
    ).toBe(false);
  });

  it("ngày sinh ở tương lai thì lỗi", () => {
    const mai = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect(registrationSchema.safeParse({ ...daSinh, beNgaySinh: mai }).success).toBe(false);
  });

  it("bé trên 36 tháng thì lỗi", () => {
    const qua = new Date();
    qua.setFullYear(qua.getFullYear() - 4);
    expect(
      registrationSchema.safeParse({ ...daSinh, beNgaySinh: qua.toISOString().slice(0, 10) })
        .success,
    ).toBe(false);
  });

  it("beNgaySinh parse ra Date", () => {
    const r = registrationSchema.safeParse(daSinh);
    expect(r.success && r.data.trangThai === "da_sinh" && r.data.beNgaySinh instanceof Date).toBe(true);
  });
});

describe("registrationSchema — field chung", () => {
  it("chuDeQuanTam rỗng thì lỗi", () => {
    expect(
      registrationSchema.safeParse({ ...mangThai, chuDeQuanTam: [] }).success,
    ).toBe(false);
  });

  it("chuDeQuanTam có giá trị lạ thì lỗi", () => {
    expect(
      registrationSchema.safeParse({ ...mangThai, chuDeQuanTam: ["bay_bong"] }).success,
    ).toBe(false);
  });

  it("nhận được cả 9 chủ đề", () => {
    expect(
      registrationSchema.safeParse({ ...mangThai, chuDeQuanTam: [...CHU_DE_VALUES] }).success,
    ).toBe(true);
  });

  it("nguonBietDen lạ thì lỗi", () => {
    expect(
      registrationSchema.safeParse({ ...mangThai, nguonBietDen: "bao_giay" }).success,
    ).toBe(false);
  });

  it("không đồng ý nhận tin thì lỗi", () => {
    expect(
      registrationSchema.safeParse({ ...mangThai, dongYNhanTin: false }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx vitest run src/lib/validation.test.ts`
Expected: FAIL — schema cũ không nhận `thaiTuan`/`chuDeQuanTam`, các test nhánh đều đỏ.

- [ ] **Step 3: Thay `registrationSchema` trong `src/lib/validation.ts`**

Thay toàn bộ khối `export const registrationSchema = ...` (dòng 28-75) bằng:

```ts
const GIOI_HAN_THANG_TUOI = 36;

/** Field có ở CẢ hai nhánh. Nhánh nào cũng spread khối này vào. */
const chungFields = {
  nguon: z.literal("su-kien"),

  hoTen: z
    .string()
    .trim()
    .min(2, "Vui lòng nhập họ tên")
    .max(80, "Họ tên không được vượt quá 80 ký tự"),

  email: z.email("Email không hợp lệ").trim().toLowerCase(),

  sdt: z.string().trim().regex(VN_PHONE, "Số điện thoại không hợp lệ"),

  facebook: z.string().trim().max(200).optional().or(z.literal("")),

  tinhThanh: z.string().trim().min(1, "Vui lòng chọn thành phố"),

  chuDeQuanTam: z
    .array(z.enum(CHU_DE_VALUES as [string, ...string[]]))
    .min(1, "Vui lòng chọn ít nhất một chủ đề"),

  nguonBietDen: z.enum(NGUON_VALUES as [string, ...string[]], {
    message: "Vui lòng cho biết mẹ biết đến chương trình từ đâu",
  }),

  diCungChong: z.boolean().default(false),

  dongYNhanTin: z.literal(true, {
    message: "Vui lòng đồng ý để hoàn tất đăng ký",
  }),

  recaptchaToken: z.string().optional(),
  website: honeypot,
};

/**
 * Union phân biệt theo `trangThai`. Đây là chỗ ép quy tắc "mang thai thì không
 * khai thông tin bé" — không phụ thuộc UI ẩn/hiện. Zod CẮT BỎ key lạ, nên field
 * của nhánh kia lọt lên cũng không bao giờ tới được DB.
 */
export const registrationSchema = z.discriminatedUnion("trangThai", [
  z.object({
    ...chungFields,
    trangThai: z.literal("mang_thai"),
    thaiTuan: z.coerce
      .number()
      .int("Số tuần phải là số nguyên")
      .min(1, "Số tuần thai không hợp lệ")
      .max(42, "Số tuần thai không hợp lệ"),
  }),
  z.object({
    ...chungFields,
    trangThai: z.literal("da_sinh"),
    tenBe: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập tên bé")
      .max(80, "Tên bé không được vượt quá 80 ký tự"),
    beNgaySinh: z.coerce
      .date({ message: "Vui lòng chọn ngày sinh của bé" })
      .refine((d) => d <= new Date(), "Ngày sinh không thể ở tương lai")
      .refine(
        (d) => thangTuoiTuNgaySinh(d, new Date()) <= GIOI_HAN_THANG_TUOI,
        `Bé trên ${GIOI_HAN_THANG_TUOI} tháng nằm ngoài phạm vi sự kiện`,
      ),
    beGioiTinh: z.enum(["nam", "nu"], {
      message: "Vui lòng chọn giới tính của bé",
    }),
  }),
]);
```

Thêm import ở đầu file:

```ts
import { CHU_DE_VALUES, NGUON_VALUES } from "./constants";
```

Khối chú thích đầu file (dòng 3-15) vẫn đúng nguyên văn — ba đoạn về "Two entry points, two shapes", "Membership First", và lý do waitlist không tái dùng schema sự kiện đều không đổi. **Giữ cả ba, chỉ chèn thêm một đoạn thứ tư ngay trước dấu `*/` đóng:**

```ts
 *
 * `registrationSchema` là discriminated union: mẹ đang mang thai và mẹ đã sinh
 * mang hai bộ field khác nhau, và schema — chứ không phải UI — là nơi quyết
 * định điều đó. Ẩn field ở form chỉ là phép lịch sự; đây mới là hàng rào.
 */
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npx vitest run src/lib/validation.test.ts`
Expected: PASS toàn bộ.

- [ ] **Step 5: Kiểm tra typecheck toàn dự án (sẽ đỏ ở nơi khác — đó là dự kiến)**

Run: `npx tsc --noEmit`
Expected: lỗi ở `brevo.ts`, `sheets.ts`, `supabase.ts`, `RegistrationForm.tsx` vì còn dùng `beThangTuoi`. **Đây là dự kiến** — Task 3-8 sẽ dọn. Ghi lại danh sách lỗi để đối chiếu.

- [ ] **Step 6: Commit**

```bash
git add src/lib/validation.ts src/lib/validation.test.ts
git commit -m "feat: schema đăng ký v2 — discriminated union theo trạng thái mang thai"
```

---

### Task 3: Supabase — kiểu dữ liệu, migration, waitlist

**Files:**
- Create: `supabase/2026-07-20-form-v2.sql`
- Modify: `src/lib/supabase.ts`
- Test: `src/lib/supabase-rows.test.ts` (mới)

**Interfaces:**
- Consumes: `Registration` (Task 2), `thangTuoiTuNgaySinh` (Task 1)
- Produces:
  - `RegistrationRow` — thêm `thai_tuan: number | null`, `ten_be: string | null`, `be_ngay_sinh: string | null`, `be_gioi_tinh: "nam" | "nu" | null`, `chu_de_quan_tam: string[]`, `nguon_biet_den: string`
  - `WaitlistRow = { id: string; created_at: string; email: string; dong_y_nhan_tin: boolean }`
  - `registrationToRow(data: Registration, code: string, now: Date): Omit<RegistrationRow, "id" | "created_at" | "checked_in" | "checked_in_at" | "checked_in_source">` — hàm thuần, tách ra để test được mà không cần DB
  - `insertWaitlist(email: string, dongY: boolean): Promise<void>`
  - `listWaitlist(): Promise<WaitlistRow[]>`

- [ ] **Step 1: Viết file migration**

Tạo `supabase/2026-07-20-form-v2.sql`:

```sql
-- Form đăng ký v2 + bảng waitlist.
-- CHẠY TAY trong Supabase SQL editor TRƯỚC KHI deploy code mới.
-- An toàn để drop cột: đã xác nhận 2026-07-20 chưa có đăng ký thật.
-- Kiểm tra lại trước khi chạy:  select count(*) from registrations;

alter table registrations
  add column if not exists thai_tuan       int,
  add column if not exists ten_be          text,
  add column if not exists be_ngay_sinh    date,
  add column if not exists be_gioi_tinh    text,
  add column if not exists chu_de_quan_tam text[] not null default '{}',
  add column if not exists nguon_biet_den  text;

alter table registrations
  drop constraint if exists registrations_thai_tuan_check,
  add  constraint registrations_thai_tuan_check
       check (thai_tuan is null or thai_tuan between 1 and 42);

alter table registrations
  drop constraint if exists registrations_be_gioi_tinh_check,
  add  constraint registrations_be_gioi_tinh_check
       check (be_gioi_tinh is null or be_gioi_tinh in ('nam','nu'));

alter table registrations
  drop constraint if exists registrations_nguon_biet_den_check,
  add  constraint registrations_nguon_biet_den_check
       check (nguon_biet_den is null or nguon_biet_den in
              ('facebook','tiktok','instagram','ban_be','khac'));

-- Waitlist app: bảng riêng. KHÔNG gộp vào registrations — gộp thì phải nới
-- NOT NULL của ho_ten/sdt/tinh_thanh/checkin_code, tức gỡ lưới an toàn của
-- đăng ký sự kiện thật.
create table if not exists waitlist (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  email           text not null unique,
  dong_y_nhan_tin boolean not null default true
);
```

- [ ] **Step 2: Viết test thất bại**

Tạo `src/lib/supabase-rows.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { registrationToRow } from "@/lib/supabase";
import type { Registration } from "@/lib/validation";

const MOC = new Date("2026-07-20T03:00:00.000Z");

const chung = {
  nguon: "su-kien" as const,
  hoTen: "Nguyễn Thị Lan",
  email: "lan@example.com",
  sdt: "0901234567",
  facebook: "",
  tinhThanh: "TP. Hồ Chí Minh",
  chuDeQuanTam: ["an_dam", "ngu"],
  nguonBietDen: "facebook",
  diCungChong: false,
  dongYNhanTin: true as const,
};

const mangThai = { ...chung, trangThai: "mang_thai", thaiTuan: 20 } as Registration;
const daSinh = {
  ...chung,
  trangThai: "da_sinh",
  tenBe: "Gạo",
  beNgaySinh: new Date("2026-01-20"),
  beGioiTinh: "nu",
} as Registration;

describe("registrationToRow", () => {
  it("mẹ mang thai: có thai_tuan, cột bé đều null", () => {
    const row = registrationToRow(mangThai, "MO-23456A", MOC);
    expect(row.thai_tuan).toBe(20);
    expect(row.ten_be).toBeNull();
    expect(row.be_ngay_sinh).toBeNull();
    expect(row.be_gioi_tinh).toBeNull();
    expect(row.be_thang_tuoi).toBeNull();
  });

  it("mẹ đã sinh: có thông tin bé, thai_tuan null", () => {
    const row = registrationToRow(daSinh, "MO-23456A", MOC);
    expect(row.thai_tuan).toBeNull();
    expect(row.ten_be).toBe("Gạo");
    expect(row.be_gioi_tinh).toBe("nu");
  });

  it("be_ngay_sinh lưu dạng YYYY-MM-DD, không phải ISO đầy đủ", () => {
    expect(registrationToRow(daSinh, "MO-23456A", MOC).be_ngay_sinh).toBe("2026-01-20");
  });

  it("be_thang_tuoi được SUY RA từ ngày sinh, không nhập tay", () => {
    expect(registrationToRow(daSinh, "MO-23456A", MOC).be_thang_tuoi).toBe(6);
  });

  it("facebook rỗng thành null, không phải chuỗi rỗng", () => {
    expect(registrationToRow(mangThai, "MO-23456A", MOC).facebook).toBeNull();
  });

  it("chu_de_quan_tam giữ nguyên mảng", () => {
    expect(registrationToRow(mangThai, "MO-23456A", MOC).chu_de_quan_tam).toEqual([
      "an_dam",
      "ngu",
    ]);
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận FAIL**

Run: `npx vitest run src/lib/supabase-rows.test.ts`
Expected: FAIL — `registrationToRow` chưa tồn tại.

- [ ] **Step 4: Sửa `src/lib/supabase.ts`**

Cập nhật type `RegistrationRow` (dòng 10-27) — thêm 6 field:

```ts
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
```

Thêm import:

```ts
import { thangTuoiTuNgaySinh, type Registration } from "./validation";
```

Thêm hàm thuần `registrationToRow` (đặt ngay trước `insertRegistration`):

```ts
/**
 * Registration → hàng DB. Tách khỏi `insertRegistration` để test được toàn bộ
 * phép ánh xạ mà không cần Supabase thật.
 *
 * `moc` truyền vào chứ không gọi `new Date()` bên trong — test cần mốc cố định,
 * và `be_thang_tuoi` phải là ảnh chụp tại thời điểm đăng ký.
 */
export function registrationToRow(data: Registration, code: string, moc: Date) {
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
```

Thay thân `insertRegistration` (dòng 51-74) để dùng hàm mới:

```ts
export async function insertRegistration(data: Registration, code: string): Promise<void> {
  const { error } = await db()
    .from("registrations")
    .upsert(registrationToRow(data, code, new Date()), { onConflict: "email" });
  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
}
```

Thêm hai hàm waitlist ở cuối file:

```ts
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
```

- [ ] **Step 5: Chạy test, xác nhận PASS**

Run: `npx vitest run src/lib/supabase-rows.test.ts`
Expected: PASS 6/6.

- [ ] **Step 6: Commit**

```bash
git add supabase/2026-07-20-form-v2.sql src/lib/supabase.ts src/lib/supabase-rows.test.ts
git commit -m "feat: schema Supabase v2 + bảng waitlist, tách registrationToRow để test"
```

---

### Task 4: Export Excel — 21 cột

**Files:**
- Modify: `src/lib/time.ts` (thêm `ngayVN`)
- Modify: `src/lib/export-rows.ts`
- Test: `src/lib/export-rows.test.ts`

**Interfaces:**
- Consumes: `RegistrationRow` (Task 3), `chuDeLabel` / `nguonBietDenLabel` (Task 1)
- Produces:
  - `ngayVN(iso: string | null): string` trong `src/lib/time.ts` — dùng chung với `AdminDetailModal` ở Task 10, **không** định nghĩa lại
  - `rowsToSheet(rows: RegistrationRow[]): { headers: string[]; rows: (string|number)[][] }` — 21 cột
  - `waitlistToSheet(rows: WaitlistRow[]): { headers: string[]; rows: (string|number)[][] }` — 3 cột

- [ ] **Step 1: Cập nhật test**

Trong `src/lib/export-rows.test.ts`, sửa `base` để có field mới và đổi kỳ vọng 15 → 21:

```ts
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
  thai_tuan: 20,
  ten_be: null,
  be_ngay_sinh: null,
  be_gioi_tinh: null,
  be_thang_tuoi: null,
  chu_de_quan_tam: ["an_dam", "ngu"],
  nguon_biet_den: "facebook",
  di_cung_chong: true,
  dong_y_nhan_tin: true,
  nguon: "su-kien",
  checked_in: false,
  checked_in_at: null,
  checked_in_source: null,
};
```

Đổi hai chỗ `toHaveLength(15)` thành `toHaveLength(21)`. Sửa test `dịch trang_thai` (dòng 38-43) vì `base` mới đã có `thai_tuan`:

```ts
  it("dịch trang_thai sang tiếng Việt", () => {
    expect(rowsToSheet([base]).rows[0]).toContain("Mang thai");
    expect(
      rowsToSheet([
        {
          ...base,
          trang_thai: "da_sinh",
          thai_tuan: null,
          ten_be: "Gạo",
          be_ngay_sinh: "2026-01-20",
          be_gioi_tinh: "nu",
          be_thang_tuoi: 6,
        },
      ]).rows[0],
    ).toContain("Đã sinh");
  });
```

Thêm test mới:

```ts
  it("chủ đề quan tâm xuất ra nhãn tiếng Việt nối bằng dấu phẩy", () => {
    const { headers, rows } = rowsToSheet([base]);
    expect(rows[0][headers.indexOf("Chủ đề quan tâm")]).toBe("Ăn dặm, Ngủ");
  });

  it("nguồn biết đến xuất ra nhãn tiếng Việt", () => {
    const { headers, rows } = rowsToSheet([{ ...base, nguon_biet_den: "ban_be" }]);
    expect(rows[0][headers.indexOf("Nguồn biết đến")]).toBe("Bạn bè");
  });

  it("mẹ mang thai để trống toàn bộ cột thông tin bé", () => {
    const { headers, rows } = rowsToSheet([base]);
    for (const cot of ["Tên bé", "Ngày sinh bé", "Giới tính bé", "Bé (tháng tuổi)"]) {
      expect(rows[0][headers.indexOf(cot)]).toBe("");
    }
    expect(rows[0][headers.indexOf("Thai (tuần)")]).toBe(20);
  });

  it("mẹ đã sinh để trống cột tuần thai", () => {
    const { headers, rows } = rowsToSheet([
      {
        ...base,
        trang_thai: "da_sinh",
        thai_tuan: null,
        ten_be: "Gạo",
        be_ngay_sinh: "2026-01-20",
        be_gioi_tinh: "nu",
        be_thang_tuoi: 6,
      },
    ]);
    expect(rows[0][headers.indexOf("Thai (tuần)")]).toBe("");
    expect(rows[0][headers.indexOf("Giới tính bé")]).toBe("Nữ");
    expect(rows[0][headers.indexOf("Ngày sinh bé")]).toBe("20/01/2026");
  });

  it("chủ đề rỗng thành chuỗi rỗng", () => {
    const { headers, rows } = rowsToSheet([{ ...base, chu_de_quan_tam: [] }]);
    expect(rows[0][headers.indexOf("Chủ đề quan tâm")]).toBe("");
  });
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx vitest run src/lib/export-rows.test.ts`
Expected: FAIL — còn 15 cột, chưa có cột mới.

- [ ] **Step 3: Thêm `ngayVN` vào `src/lib/time.ts` kèm test riêng**

Thêm vào `src/lib/time.test.ts`:

```ts
import { ngayVN } from "./time";

describe("ngayVN", () => {
  it("đổi ISO date sang dd/mm/yyyy", () => {
    expect(ngayVN("2026-01-20")).toBe("20/01/2026");
  });

  it("giữ số 0 đầu của ngày và tháng", () => {
    expect(ngayVN("2026-03-05")).toBe("05/03/2026");
  });

  it("null thành chuỗi rỗng", () => {
    expect(ngayVN(null)).toBe("");
  });

  it("chuỗi rỗng thành chuỗi rỗng", () => {
    expect(ngayVN("")).toBe("");
  });

  // Bẫy múi giờ: `new Date("2026-01-20")` parse thành UTC midnight, format ở
  // múi giờ âm sẽ ra 19/01. Test này khoá việc KHÔNG đi qua Date.
  it("không lùi ngày do múi giờ", () => {
    expect(ngayVN("2026-01-01")).toBe("01/01/2026");
  });
});
```

Rồi thêm vào cuối `src/lib/time.ts`:

```ts
/**
 * "2026-01-20" → "20/01/2026". Nhận thẳng chuỗi của cột `date` Postgres, KHÔNG
 * đi qua `new Date()`: parse "2026-01-20" ra Date rồi format theo múi giờ sẽ
 * lùi một ngày ở mọi múi giờ âm. Cắt chuỗi là phép biến đổi duy nhất đúng ở đây.
 */
export function ngayVN(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
```

- [ ] **Step 4: Viết lại `src/lib/export-rows.ts`**

```ts
import { chuDeLabel, nguonBietDenLabel } from "./constants";
import type { RegistrationRow, WaitlistRow } from "./supabase";
import { formatCheckinTime, ngayVN } from "./time";

/**
 * 21 cột = toàn bộ RegistrationRow trừ `id` (khoá nội bộ, vô nghĩa với ops).
 * Thứ tự cột này là thứ tự cột trong file Excel VÀ trong Google Sheet — đổi ở
 * đây là đổi cả hai. `sheets.ts` cố tình đọc lại từ đây thay vì tự khai mảng.
 */
const HEADERS = [
  "Họ tên",
  "Email",
  "SĐT",
  "Facebook",
  "Thành phố",
  "Tình trạng",
  "Thai (tuần)",
  "Tên bé",
  "Ngày sinh bé",
  "Giới tính bé",
  "Bé (tháng tuổi)",
  "Chủ đề quan tâm",
  "Nguồn biết đến",
  "Đi cùng chồng",
  "Đồng ý nhận tin",
  "Mã check-in",
  "Nguồn đăng ký",
  "Thời điểm đăng ký",
  "Đã check-in",
  "Giờ check-in",
  "Nguồn check-in",
] as const;

const WAITLIST_HEADERS = ["Email", "Đồng ý nhận tin", "Thời điểm đăng ký"] as const;

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
      r.thai_tuan ?? "",
      r.ten_be ?? "",
      ngayVN(r.be_ngay_sinh),
      r.be_gioi_tinh === "nam" ? "Nam" : r.be_gioi_tinh === "nu" ? "Nữ" : "",
      r.be_thang_tuoi ?? "",
      r.chu_de_quan_tam.map(chuDeLabel).join(", "),
      r.nguon_biet_den ? nguonBietDenLabel(r.nguon_biet_den) : "",
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

/** Waitlist chỉ có ba cột — không có gì để check-in, không có thông tin bé. */
export function waitlistToSheet(rows: WaitlistRow[]): {
  headers: string[];
  rows: (string | number)[][];
} {
  return {
    headers: [...WAITLIST_HEADERS],
    rows: rows.map((r) => [
      r.email,
      yesNo(r.dong_y_nhan_tin),
      formatCheckinTime(r.created_at),
    ]),
  };
}
```

- [ ] **Step 5: Chạy test, xác nhận PASS**

Run: `npx vitest run src/lib/export-rows.test.ts src/lib/time.test.ts`
Expected: PASS toàn bộ, gồm cả test cũ của `time.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/time.ts src/lib/export-rows.ts src/lib/export-rows.test.ts
git commit -m "feat: export 21 cột cho form v2 + bộ cột riêng cho waitlist"
```

---

### Task 5: Google Sheets — dòng mirror theo cột mới

**Files:**
- Modify: `src/lib/sheets.ts:45-72`
- Test: `src/lib/sheets.test.ts`

**Interfaces:**
- Consumes: `rowsToSheet` (Task 4), `registrationToRow` (Task 3), `Registration` (Task 2)
- Produces: `registrationToSheetRow(data: Registration, code: string): (string|number)[]` — chữ ký không đổi

- [ ] **Step 1: Cập nhật test**

Trong `src/lib/sheets.test.ts`, thay `base` và thêm ca mới:

```ts
const chung = {
  nguon: "su-kien" as const,
  hoTen: "Nguyễn Thị Lan",
  email: "lan@example.com",
  sdt: "0901234567",
  facebook: "",
  tinhThanh: "TP.HCM",
  chuDeQuanTam: ["an_dam", "ngu"],
  nguonBietDen: "facebook",
  diCungChong: true,
  dongYNhanTin: true as const,
};

const base = { ...chung, trangThai: "mang_thai", thaiTuan: 20 } as Registration;
const daSinh = {
  ...chung,
  trangThai: "da_sinh",
  tenBe: "Gạo",
  beNgaySinh: new Date("2026-01-20"),
  beGioiTinh: "nu",
} as Registration;
```

Sửa hai test cũ dùng `beThangTuoi`:

```ts
  it("mẹ mang thai: 'Mang thai', cột bé rỗng, có số tuần thai", () => {
    const row = registrationToSheetRow(base, "MO-23456A");
    expect(at(row, "Tình trạng")).toBe("Mang thai");
    expect(at(row, "Bé (tháng tuổi)")).toBe("");
    expect(at(row, "Tên bé")).toBe("");
    expect(at(row, "Thai (tuần)")).toBe(20);
  });

  it("mẹ đã sinh: 'Đã sinh' kèm thông tin bé, cột tuần thai rỗng", () => {
    const row = registrationToSheetRow(daSinh, "MO-23456A");
    expect(at(row, "Tình trạng")).toBe("Đã sinh");
    expect(at(row, "Tên bé")).toBe("Gạo");
    expect(at(row, "Giới tính bé")).toBe("Nữ");
    expect(at(row, "Ngày sinh bé")).toBe("20/01/2026");
    expect(at(row, "Thai (tuần)")).toBe("");
  });

  it("chủ đề quan tâm nối bằng nhãn tiếng Việt", () => {
    expect(at(registrationToSheetRow(base, "MO-23456A"), "Chủ đề quan tâm")).toBe(
      "Ăn dặm, Ngủ",
    );
  });
```

Các test `Facebook`, `đi cùng chồng`, `mã check-in`, `ba cột check-in luôn rỗng`, `VALUE_INPUT_OPTION` giữ nguyên.

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx vitest run src/lib/sheets.test.ts`
Expected: FAIL — `registrationToSheetRow` chưa biết field mới.

- [ ] **Step 3: Viết lại `registrationToSheetRow` trong `src/lib/sheets.ts`**

Thay dòng 40-72 bằng:

```ts
/**
 * Dựng RegistrationRow rồi đưa qua `rowsToSheet` để lấy đúng 21 ô theo đúng
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
    // Sheet chụp lại thời điểm đăng ký, không theo dõi check-in.
    checked_in: false,
    checked_in_at: null,
    checked_in_source: null,
  };
  return rowsToSheet([row]).rows[0];
}
```

Cập nhật import ở đầu file:

```ts
import { rowsToSheet } from "./export-rows";
import { registrationToRow, type RegistrationRow } from "./supabase";
import type { Registration } from "./validation";
```

Sửa chú thích dòng 41 (`đúng 15 ô` → `đúng 21 ô`) — đã nằm trong khối trên.

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npx vitest run src/lib/sheets.test.ts`
Expected: PASS toàn bộ, gồm cả test khoá `VALUE_INPUT_OPTION === "RAW"`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sheets.ts src/lib/sheets.test.ts
git commit -m "feat: dòng mirror Sheets theo 21 cột, dùng chung ánh xạ với Supabase"
```

---

### Task 6: Brevo — attribute mới

**Files:**
- Modify: `src/lib/brevo.ts:65-83`

**Interfaces:**
- Consumes: `Registration` (Task 2), `chuDeLabel` (Task 1), `thangTuoiTuNgaySinh` (Task 1)
- Produces: không có API mới — chỉ đổi nội dung `attributes` gửi lên Brevo

Không có test tự động (cần mock HTTP; ngoài phạm vi repo hiện tại). Kiểm bằng tay ở Task 10.

- [ ] **Step 1: Sửa khối `attributes` trong `upsertContact`**

Thay dòng 70-83 bằng:

```ts
  if (isRegistration(data)) {
    attributes.HO_TEN = data.hoTen;
    attributes.SDT = data.sdt;
    attributes.TINH_THANH = data.tinhThanh;
    attributes.TRANG_THAI = data.trangThai;
    attributes.DI_CUNG_CHONG = data.diCungChong;
    attributes.NGUON_BIET_DEN = data.nguonBietDen;
    attributes.CHU_DE_QUAN_TAM = data.chuDeQuanTam.map(chuDeLabel).join(", ");
    if (data.facebook) attributes.FACEBOOK = data.facebook;
    if (checkinCode) attributes.MA_CHECKIN = checkinCode;

    // Mỗi nhánh chỉ gửi attribute của CHÍNH nó. `updateEnabled: true` nghĩa là
    // gửi chuỗi rỗng sẽ XOÁ TRẮNG giá trị cũ — một mẹ đăng ký lần hai sau khi
    // sinh sẽ mất sạch thông tin bé nếu ta gửi "" cho nhánh không áp dụng.
    if (data.trangThai === "mang_thai") {
      attributes.THAI_TUAN = data.thaiTuan;
    } else {
      attributes.TEN_BE = data.tenBe;
      attributes.BE_NGAY_SINH = data.beNgaySinh.toISOString().slice(0, 10);
      attributes.BE_GIOI_TINH = data.beGioiTinh;
      attributes.BE_THANG_TUOI = thangTuoiTuNgaySinh(data.beNgaySinh, new Date());
    }
  }
```

Cập nhật import đầu file:

```ts
import { chuDeLabel } from "./constants";
import { isRegistration, thangTuoiTuNgaySinh, type Submission } from "./validation";
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep brevo`
Expected: không còn lỗi nào ở `brevo.ts`.

- [ ] **Step 3: Chạy toàn bộ test**

Run: `npm test`
Expected: PASS — không test nào phủ `brevo.ts`, nhưng phải chắc không làm vỡ chỗ khác.

- [ ] **Step 4: Commit**

```bash
git add src/lib/brevo.ts
git commit -m "feat: gửi attribute form v2 lên Brevo, mỗi nhánh chỉ gửi field của nó"
```

---

### Task 7: Route đăng ký — waitlist vào Supabase

**Files:**
- Modify: `src/app/api/dang-ky/route.ts:104-127`

**Interfaces:**
- Consumes: `insertWaitlist` (Task 3), `insertRegistration` (Task 3)
- Produces: không có API mới

- [ ] **Step 1: Sửa khối ghi Supabase**

Thay dòng 104-115 bằng:

```ts
  // Bản ghi có cấu trúc cho /check-in + /admin.
  //  - Đăng ký sự kiện → bảng `registrations` (có mã check-in, thông tin bé).
  //  - Waitlist app    → bảng `waitlist` (chỉ email + consent).
  // Hai bảng RIÊNG, không gộp: gộp thì phải nới NOT NULL của ho_ten/sdt/
  // tinh_thanh/checkin_code, tức gỡ luôn lưới an toàn của đăng ký sự kiện thật.
  //
  // Non-fatal ở CẢ HAI nhánh: mẹ đã đăng ký xong ở Brevo rồi. Lỗi ở đây chỉ
  // log thật to để ops back-fill từ Brevo.
  if (supabaseConfigured()) {
    try {
      if (isRegistration(data)) {
        await insertRegistration(data, checkinCode!);
      } else {
        await insertWaitlist(data.email, data.dongYNhanTin);
      }
    } catch (err) {
      console.error("[dang-ky] Supabase insert failed:", data.email, err);
      warnings.push("supabase");
    }
  }
```

Cập nhật import dòng 4:

```ts
import { insertRegistration, insertWaitlist, supabaseConfigured } from "@/lib/supabase";
```

**Không đụng** khối Sheets (dòng 117-127) — waitlist cố ý KHÔNG mirror sang Sheets, điều kiện `isRegistration(data)` ở đó giữ nguyên.

- [ ] **Step 2: Typecheck + test**

Run: `npx tsc --noEmit && npm test`
Expected: sạch, toàn bộ test PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/dang-ky/route.ts
git commit -m "feat: waitlist ghi vào bảng Supabase riêng, không chạm nhánh Sheets"
```

---

### Task 8: Form đăng ký v2

**Files:**
- Modify: `src/components/RegistrationForm.tsx`

**Interfaces:**
- Consumes: `PROVINCES`, `CHU_DE_QUAN_TAM`, `NGUON_BIET_DEN` (Task 1); endpoint `POST /api/dang-ky` (Task 7)
- Produces: không có export mới

- [ ] **Step 1: Thêm state và payload**

Trong `RegistrationForm`, thay dòng 49 bằng:

```ts
  const [trangThai, setTrangThai] = useState<"mang_thai" | "da_sinh" | "">("");
  const [chuDe, setChuDe] = useState<string[]>([]);

  function toggleChuDe(value: string) {
    setChuDe((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }
```

Thay khối `payload` (dòng 57-72) bằng:

```ts
    const fd = new FormData(e.currentTarget);
    const daSinh = fd.get("trangThai") === "da_sinh";
    const payload = {
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
      // Chỉ gửi field của nhánh ĐANG chọn. Nhánh kia để undefined — schema
      // sẽ cắt bỏ, nhưng gửi đúng ngay từ đây thì thông báo lỗi cũng đúng chỗ.
      ...(daSinh
        ? {
            tenBe: String(fd.get("tenBe") ?? ""),
            beNgaySinh: String(fd.get("beNgaySinh") ?? ""),
            beGioiTinh: fd.get("beGioiTinh"),
          }
        : { thaiTuan: fd.get("thaiTuan") }),
    };
```

- [ ] **Step 2: Thêm component tiêu đề nhóm**

Thêm ngay sau component `Field` (sau dòng 43):

```tsx
/** Tiêu đề nhóm field. Form v2 dài hơn hẳn v1 — không chia nhóm thì mẹ điền
    trên điện thoại sẽ mất phương hướng giữa chừng. */
function Nhom({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-5">
      <legend className="mb-1 text-base font-extrabold text-ink">{title}</legend>
      {children}
    </fieldset>
  );
}
```

- [ ] **Step 3: Bọc nhóm "Thông tin mẹ" và đổi nhãn thành phố**

Bọc từ `<Field label="Họ tên">` tới hết khối `grid` chứa Facebook/Thành phố (dòng 116-184) vào:

```tsx
      <Nhom title="Thông tin mẹ">
        {/* ...Họ tên, SĐT, Email, Facebook, Thành phố giữ nguyên... */}
      </Nhom>
```

Trong đó đổi nhãn: dòng 166 `label="Tỉnh/Thành"` → `label="Thành phố"`, dòng 175 `Chọn tỉnh/thành` → `Chọn thành phố`.

- [ ] **Step 4: Thay khối điều kiện `beThangTuoi`**

Thay dòng 225-246 bằng (nhánh `da_sinh` bọc trong `<Nhom title="Thông tin bé">` thay cho `<div className="space-y-5">`):

```tsx
      {/* Hiện đúng nhánh đang chọn. Mẹ mang thai không bao giờ bị hỏi ngày sinh
          của bé chưa chào đời; mẹ đã sinh không bị hỏi tuần thai. Schema phía
          server ép cùng quy tắc này — đây chỉ là phép lịch sự. */}
      {trangThai === "mang_thai" && (
        <Field
          label="Thai bao nhiêu tuần?"
          htmlFor="thaiTuan"
          error={errors.thaiTuan}
          required
        >
          <input
            id="thaiTuan"
            name="thaiTuan"
            type="number"
            inputMode="numeric"
            min={1}
            max={42}
            placeholder="Ví dụ: 20"
            className={`${inputBase} ${ring("thaiTuan")}`}
            {...err("thaiTuan")}
          />
        </Field>
      )}

      {trangThai === "da_sinh" && (
        <Nhom title="Thông tin bé">
          <Field label="Tên bé" htmlFor="tenBe" error={errors.tenBe} required>
            <input
              id="tenBe"
              name="tenBe"
              placeholder="Gạo"
              className={`${inputBase} ${ring("tenBe")}`}
              {...err("tenBe")}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Ngày sinh của bé"
              htmlFor="beNgaySinh"
              error={errors.beNgaySinh}
              required
            >
              <input
                id="beNgaySinh"
                name="beNgaySinh"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                className={`${inputBase} ${ring("beNgaySinh")}`}
                {...err("beNgaySinh")}
              />
            </Field>

            <Field
              label="Giới tính"
              htmlFor="beGioiTinh-nam"
              error={errors.beGioiTinh}
              required
            >
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { value: "nam", label: "Bé trai" },
                    { value: "nu", label: "Bé gái" },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.value}
                    htmlFor={`beGioiTinh-${opt.value}`}
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-white px-4 py-3 transition-colors hover:bg-primary-faded-hover has-checked:border-primary has-checked:bg-primary-faded"
                  >
                    <input
                      id={`beGioiTinh-${opt.value}`}
                      type="radio"
                      name="beGioiTinh"
                      value={opt.value}
                      className="h-4 w-4 cursor-pointer accent-[#f08f8c]"
                    />
                    <span className="text-base font-medium text-ink">{opt.label}</span>
                  </label>
                ))}
              </div>
            </Field>
          </div>
        </Nhom>
      )}
```

- [ ] **Step 5: Thêm khối chủ đề quan tâm + nguồn biết đến**

Chèn ngay TRƯỚC khối `<label>` "Tôi đi cùng chồng" (dòng 248):

```tsx
      <Field
        label="Chủ đề mẹ quan tâm"
        htmlFor="chuDe-thai_ky"
        error={errors.chuDeQuanTam}
        required
      >
        <div className="grid gap-2.5 sm:grid-cols-2">
          {CHU_DE_QUAN_TAM.map((c) => (
            <label
              key={c.value}
              htmlFor={`chuDe-${c.value}`}
              className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-4 py-2.5 transition-colors ${
                chuDe.includes(c.value)
                  ? "border-primary bg-primary-faded"
                  : "border-line bg-white hover:bg-primary-faded-hover"
              }`}
            >
              <input
                id={`chuDe-${c.value}`}
                type="checkbox"
                checked={chuDe.includes(c.value)}
                onChange={() => toggleChuDe(c.value)}
                className="h-[18px] w-[18px] shrink-0 cursor-pointer rounded accent-[#f08f8c]"
              />
              <span className="text-base text-ink">{c.label}</span>
            </label>
          ))}
        </div>
      </Field>

      <Field
        label="Mẹ biết đến chương trình từ đâu?"
        htmlFor="nguonBietDen-facebook"
        error={errors.nguonBietDen}
        required
      >
        <div className="grid gap-2.5 sm:grid-cols-3">
          {NGUON_BIET_DEN.map((n) => (
            <label
              key={n.value}
              htmlFor={`nguonBietDen-${n.value}`}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-white px-4 py-2.5 transition-colors hover:bg-primary-faded-hover has-checked:border-primary has-checked:bg-primary-faded"
            >
              <input
                id={`nguonBietDen-${n.value}`}
                type="radio"
                name="nguonBietDen"
                value={n.value}
                className="h-4 w-4 shrink-0 cursor-pointer accent-[#f08f8c]"
              />
              <span className="text-base text-ink">{n.label}</span>
            </label>
          ))}
        </div>
      </Field>
```

- [ ] **Step 6: Cập nhật nhãn checkbox đồng ý**

Thay nội dung `<span>` ở dòng 265-268 bằng:

```tsx
          <span className="text-sm leading-5 text-ink-faded">
            Tôi đồng ý cho Mama Ơi lưu trữ thông tin để gửi email xác nhận, tài liệu
            chương trình và các thông tin hữu ích.
            <span className="ml-0.5 text-danger">*</span>
          </span>
```

- [ ] **Step 7: Cập nhật import**

Dòng 5:

```ts
import { CHU_DE_QUAN_TAM, NGUON_BIET_DEN, PROVINCES } from "@/lib/constants";
```

- [ ] **Step 8: Typecheck + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: cả ba sạch.

- [ ] **Step 9: Commit**

```bash
git add src/components/RegistrationForm.tsx
git commit -m "feat: form đăng ký v2 — thông tin bé, tuần thai, chủ đề quan tâm, nguồn biết đến"
```

---

### Task 9: API admin cho waitlist + export theo loại

**Files:**
- Create: `src/app/api/admin/waitlist/route.ts`
- Modify: `src/app/api/admin/export/route.ts`

**Interfaces:**
- Consumes: `listWaitlist` (Task 3), `waitlistToSheet` / `rowsToSheet` (Task 4), `isAdmin`
- Produces:
  - `GET /api/admin/waitlist` → `{ ok: true, rows: WaitlistRow[] }`
  - `POST /api/admin/export` nhận `{ ids: string[], loai?: "su-kien" | "waitlist" }`; thiếu `loai` mặc định `"su-kien"` (tương thích ngược)

- [ ] **Step 1: Tạo route waitlist**

Tạo `src/app/api/admin/waitlist/route.ts`:

```ts
import { isAdmin } from "@/lib/admin-auth";
import { listWaitlist } from "@/lib/supabase";

export async function GET() {
  if (!(await isAdmin())) {
    return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  try {
    const rows = await listWaitlist();
    return Response.json({ ok: true, rows });
  } catch (err) {
    console.error("[admin/waitlist] failed:", err);
    return Response.json({ error: "Không tải được danh sách" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Sửa route export**

Trong `src/app/api/admin/export/route.ts`, thay từ dòng 24 tới hết khối `try` bằng:

```ts
  const { ids, loai } = (body as { ids?: unknown; loai?: unknown }) ?? {};
  if (!Array.isArray(ids) || ids.some((i) => typeof i !== "string")) {
    return Response.json({ error: "Thiếu danh sách id" }, { status: 400 });
  }
  // Thiếu `loai` = client cũ → giữ hành vi cũ (đăng ký sự kiện).
  if (loai !== undefined && loai !== "su-kien" && loai !== "waitlist") {
    return Response.json({ error: "Loại không hợp lệ" }, { status: 400 });
  }
  const laWaitlist = loai === "waitlist";

  try {
    const wanted = new Set(ids as string[]);
    const { headers, rows: data } = laWaitlist
      ? waitlistToSheet((await listWaitlist()).filter((r) => wanted.has(r.id)))
      : rowsToSheet((await listRegistrations()).filter((r) => wanted.has(r.id)));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(laWaitlist ? "Waitlist" : "Check-in");
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
    const ten = laWaitlist ? "mamaoi-waitlist" : "mamaoi-day-checkin";
    return new Response(new Uint8Array(buf as ArrayBuffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${ten}-${stamp}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("[admin/export] failed:", err);
    return Response.json({ error: "Xuất file thất bại" }, { status: 502 });
  }
}
```

Cập nhật import dòng 3-4:

```ts
import { rowsToSheet, waitlistToSheet } from "@/lib/export-rows";
import { listRegistrations, listWaitlist } from "@/lib/supabase";
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: sạch. Route `/api/admin/waitlist` xuất hiện trong bảng route của build.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/waitlist/route.ts src/app/api/admin/export/route.ts
git commit -m "feat: API admin đọc waitlist + export tách theo loại"
```

---

### Task 10: Admin hai tab

**Files:**
- Modify: `src/app/admin/page.tsx`
- Modify: `src/components/AdminDashboard.tsx`
- Create: `src/components/WaitlistTab.tsx`
- Modify: `src/components/AdminDetailModal.tsx`

**Interfaces:**
- Consumes: `listRegistrations` + `listWaitlist` (Task 3), `GET /api/admin/waitlist` (Task 9), `POST /api/admin/export` với `loai` (Task 9)
- Produces: `AdminDashboard({ initialRows, initialWaitlist })`, `WaitlistTab({ initialRows })`

**Ràng buộc chuyển đổi:** logic poll / writeGenRef / fetchSeqRef trong `AdminDashboard` là lớp chống ghi-đè đã qua hai vòng sửa lỗi (xem `2026-07-16-admin-export-popup-poll-design.md`). **Chuyển nguyên khối, không tinh chỉnh.** Chỉ thêm state tab và đổi cột bảng.

- [ ] **Step 1: Sửa `src/app/admin/page.tsx`**

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/AdminDashboard";
import { isAdmin } from "@/lib/admin-auth";
import { listRegistrations, listWaitlist } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Admin — Check-in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  // Song song: hai truy vấn độc lập, tuần tự thì trang chờ gấp đôi vô ích.
  const [rows, waitlist] = await Promise.all([listRegistrations(), listWaitlist()]);
  return <AdminDashboard initialRows={rows} initialWaitlist={waitlist} />;
}
```

- [ ] **Step 2: Tạo `src/components/WaitlistTab.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import type { WaitlistRow } from "@/lib/supabase";
import { formatCheckinTime } from "@/lib/time";

/**
 * Danh sách chờ ứng dụng: chỉ đọc. Cố ý KHÔNG poll 5 giây như tab sự kiện —
 * poll ở đó sinh ra cho lúc 500 mẹ check-in đồng thời tại quầy, còn đây là
 * danh sách email không đổi trong lúc ai đó đang nhìn nó.
 */
export function WaitlistTab({ initialRows }: { initialRows: WaitlistRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [q, setQ] = useState("");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? rows.filter((r) => r.email.toLowerCase().includes(s)) : rows;
  }, [rows, q]);

  async function refresh() {
    setRefreshing(true);
    setError("");
    try {
      const res = await fetch("/api/admin/waitlist");
      if (!res.ok) {
        setError("Không tải được danh sách");
        return;
      }
      const data = await res.json();
      setRows(data.rows as WaitlistRow[]);
    } catch {
      setError("Không kết nối được. Vui lòng thử lại.");
    } finally {
      setRefreshing(false);
    }
  }

  async function exportXlsx() {
    setExporting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loai: "waitlist", ids: filtered.map((r) => r.id) }),
      });
      if (!res.ok) {
        setError("Xuất file thất bại");
        return;
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        "mamaoi-waitlist.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Hoãn revoke: trình duyệt cần một khoảng để bắt đầu tải blob URL sau click.
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch {
      setError("Không kết nối được. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-faded">
          Tổng: <strong className="text-ink">{rows.length}</strong> email
        </p>
        <div className="flex gap-2">
          <button
            onClick={exportXlsx}
            disabled={exporting || filtered.length === 0}
            className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-primary-faded-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? "Đang xuất..." : `Xuất Excel (${filtered.length})`}
          </button>
          <button
            onClick={() => void refresh()}
            disabled={refreshing}
            className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-primary-faded-hover disabled:opacity-50"
          >
            {refreshing ? "Đang tải..." : "Làm mới"}
          </button>
        </div>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Tìm theo email..."
        className="mt-6 w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink placeholder:text-ink-placeholder focus:border-primary focus:ring-2 focus:ring-primary focus:outline-none sm:max-w-md"
      />
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-line text-ink-faded">
            <tr>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Đồng ý nhận tin</th>
              <th className="px-4 py-3 font-semibold">Thời điểm đăng ký</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-3 font-semibold text-ink">{r.email}</td>
                <td className="px-4 py-3 text-ink">{r.dong_y_nhan_tin ? "Có" : "—"}</td>
                <td className="px-4 py-3 text-ink">{formatCheckinTime(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-ink-faded">
            {rows.length === 0 ? "Chưa có ai đăng ký nhận tin." : "Không tìm thấy email nào."}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Thêm tab vào `AdminDashboard`**

Sửa chữ ký hàm (dòng 14):

```tsx
export function AdminDashboard({
  initialRows,
  initialWaitlist,
}: {
  initialRows: RegistrationRow[];
  initialWaitlist: WaitlistRow[];
}) {
```

Thêm state ngay sau `const [rows, setRows] = useState(initialRows);`:

```tsx
  const [tab, setTab] = useState<"su-kien" | "waitlist">("su-kien");
```

Cập nhật import dòng 5:

```tsx
import type { RegistrationRow, WaitlistRow } from "@/lib/supabase";
import { WaitlistTab } from "./WaitlistTab";
```

Sửa `useEffect` poll (dòng 136-151) để dừng poll khi đang ở tab waitlist — thêm `tab` vào điều kiện đầu:

```tsx
  useEffect(() => {
    if (stopped || tab !== "su-kien") return;
```

và thêm `tab` vào mảng phụ thuộc: `}, [refresh, stopped, tab]);`

Thay khối JSX từ `<h1>` (dòng 240) tới hết `</div>` bọc header, và bọc phần còn lại:

```tsx
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold text-ink">Mama Ơi — Admin</h1>
          <button
            onClick={logout}
            className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink-faded hover:bg-primary-faded-hover"
          >
            Đăng xuất
          </button>
        </div>

        {/* Hai nguồn đăng ký hoàn toàn khác nhau: mẹ giữ chỗ sự kiện (có mã
            check-in) và mẹ chờ app ra mắt (chỉ email). Gộp một bảng thì quá
            nửa số cột bỏ trống. */}
        <div role="tablist" aria-label="Nguồn đăng ký" className="mt-6 flex gap-2">
          {(
            [
              { id: "su-kien", label: "Sự kiện", count: rows.length },
              { id: "waitlist", label: "Waitlist app", count: initialWaitlist.length },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? "bg-primary text-white"
                  : "border border-line bg-white text-ink-faded hover:bg-primary-faded-hover"
              }`}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "waitlist" ? (
            <WaitlistTab initialRows={initialWaitlist} />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-faded">
                  Đã check-in: <strong className="text-success">{checkedInCount}</strong> /{" "}
                  {rows.length}
                </p>
                <div className="flex gap-2">
                  {/* CHUYỂN NGUYÊN VĂN dòng 247-266 của file gốc: nút Xuất Excel
                      và nút Làm mới, kể cả khối chú thích dài về manual refresh
                      retry — chú thích đó ghi lại một lỗi đã sửa, đừng cắt. */}
                </div>
              </div>

              {/* CHUYỂN NGUYÊN VĂN dòng 276-286: ô tìm kiếm + exportError */}
              {/* CHUYỂN NGUYÊN VĂN dòng 288-350: <div> bọc <table> đầy đủ */}
            </>
          )}
        </div>
```

**Ánh xạ dòng gốc → vị trí mới** (đánh số theo `AdminDashboard.tsx` ở commit `19955c8`):

| Dòng gốc | Nội dung | Đi đâu |
|---|---|---|
| 241 | `<h1>Check-in — Mama Ơi Day</h1>` | đổi chữ thành `Mama Ơi — Admin`, ở header ngoài |
| 242-244 | `<p>Đã check-in: X / Y</p>` | vào nhánh `su-kien` |
| 247-253 | nút `Xuất Excel` | vào nhánh `su-kien` |
| 254-266 | nút `Làm mới` + chú thích | vào nhánh `su-kien`, **giữ nguyên chú thích** |
| 267-272 | nút `Đăng xuất` | ở lại header ngoài, dùng cho cả hai tab |
| 276-286 | ô tìm kiếm + `exportError` | vào nhánh `su-kien` |
| 288-350 | `<div>` + `<table>` | vào nhánh `su-kien` |
| 352-360 | `{openRow && <AdminDetailModal .../>}` | ở lại ngoài cùng, không đổi |

Trong lời gọi `exportXlsx` của tab sự kiện, thêm `loai`:

```tsx
        body: JSON.stringify({ loai: "su-kien", ids: filtered.map((r) => r.id) }),
```

Đổi cột bảng sự kiện — thay `<th>Tỉnh/Thành</th>` thành `<th>Thành phố</th>`, và thay ô `Tình trạng` (dòng 315-319) bằng:

```tsx
                  <td className="px-4 py-3 text-ink">
                    {r.trang_thai === "mang_thai"
                      ? `Mang thai${r.thai_tuan != null ? ` · ${r.thai_tuan} tuần` : ""}`
                      : `Đã sinh${r.be_thang_tuoi != null ? ` · ${r.be_thang_tuoi}th` : ""}`}
                  </td>
```

- [ ] **Step 4: Cập nhật `AdminDetailModal`**

Thay khối `<Field>` (dòng 83-99) bằng:

```tsx
          <Field label="Email" value={row.email} />
          <Field label="SĐT" value={row.sdt} />
          <Field label="Facebook" value={row.facebook ?? ""} />
          <Field
            label="Tình trạng"
            value={
              row.trang_thai === "mang_thai"
                ? `Mang thai${row.thai_tuan != null ? ` · ${row.thai_tuan} tuần` : ""}`
                : "Đã sinh"
            }
          />
          {row.trang_thai === "da_sinh" && (
            <>
              <Field label="Tên bé" value={row.ten_be ?? ""} />
              <Field label="Ngày sinh bé" value={ngayVN(row.be_ngay_sinh)} />
              <Field
                label="Giới tính bé"
                value={
                  row.be_gioi_tinh === "nam"
                    ? "Bé trai"
                    : row.be_gioi_tinh === "nu"
                      ? "Bé gái"
                      : ""
                }
              />
              <Field
                label="Tháng tuổi"
                value={row.be_thang_tuoi != null ? `${row.be_thang_tuoi} tháng` : ""}
              />
            </>
          )}
          <Field
            label="Chủ đề quan tâm"
            value={row.chu_de_quan_tam.map(chuDeLabel).join(", ")}
          />
          <Field
            label="Nguồn biết đến"
            value={row.nguon_biet_den ? nguonBietDenLabel(row.nguon_biet_den) : ""}
          />
          <Field label="Đi cùng chồng" value={row.di_cung_chong ? "Có" : "—"} />
          <Field label="Đồng ý nhận tin" value={row.dong_y_nhan_tin ? "Có" : "—"} />
          <Field label="Nguồn đăng ký" value={row.nguon} />
          <Field label="Thời điểm đăng ký" value={formatCheckinTime(row.created_at)} />
          <Field label="Nguồn check-in" value={row.checked_in_source ?? ""} />
```

Cập nhật import (dòng 5) — `ngayVN` lấy từ `time.ts` (Task 4), **không** định nghĩa lại trong file này:

```tsx
import { chuDeLabel, nguonBietDenLabel } from "@/lib/constants";
import { formatCheckinTime, isoToVNLocalInput, ngayVN } from "@/lib/time";
```

- [ ] **Step 5: Typecheck, lint, build, test**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: cả bốn sạch.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/page.tsx src/components/AdminDashboard.tsx src/components/WaitlistTab.tsx src/components/AdminDetailModal.tsx
git commit -m "feat: admin hai tab — sự kiện và waitlist app tách biệt"
```

---

### Task 11: Kiểm thử tay đầu-cuối

**Files:** không sửa file nào — đây là cổng xác minh trước khi merge.

**Việc tay bắt buộc phải xong TRƯỚC bước này:**

1. Chạy `supabase/2026-07-20-form-v2.sql` trong Supabase SQL editor
2. Tạo 6 attribute trong Brevo: `THAI_TUAN` (number), `TEN_BE` (text), `BE_NGAY_SINH` (date), `BE_GIOI_TINH` (text), `CHU_DE_QUAN_TAM` (text), `NGUON_BIET_DEN` (text)
3. Xoá header 15 cột cũ trong Google Sheet đích (hoặc xoá sạch sheet)

- [ ] **Step 1: Chạy dev server**

Run: `npm run dev`

- [ ] **Step 2: Đăng ký thử nhánh mang thai**

Mở `http://localhost:3000/su-kien`. Điền: họ tên, SĐT `0901234567`, email thật của bạn, thành phố, chọn **Đang mang thai**, tuần `20`, tick 2 chủ đề, chọn nguồn `Facebook`, tick đồng ý. Submit.

Kỳ vọng: chuyển sang `/cam-on` kèm mã `MO-XXXXXX`.

- [ ] **Step 3: Đăng ký thử nhánh đã sinh**

Email KHÁC. Chọn **Bé đã chào đời**, tên bé `Gạo`, ngày sinh 6 tháng trước, giới tính Bé gái.

Kỳ vọng: thành công, và form **không hề hiện** ô tuần thai.

- [ ] **Step 4: Kiểm tra ba đích**

- Supabase → bảng `registrations`: hai dòng, cột `thai_tuan` / `ten_be` đúng nhánh, `be_thang_tuoi` = 6 ở dòng thứ hai
- Google Sheet: header 21 cột, hai dòng mới khớp cột
- Brevo → Contacts: hai contact, attribute mới có giá trị

- [ ] **Step 5: Thử waitlist**

Mở `http://localhost:3000/`, cuộn xuống form "Nhận tin khi Mama Ơi ra mắt", nhập email thứ ba, tick đồng ý, submit.

Kỳ vọng: hiện "Cảm ơn mẹ! 🎉". Supabase bảng `waitlist` có một dòng. Google Sheet **KHÔNG** có dòng mới (waitlist cố ý không mirror).

- [ ] **Step 6: Kiểm tra admin hai tab**

Mở `http://localhost:3000/admin`, đăng nhập.

- Tab **Sự kiện (2)**: hai dòng, cột Tình trạng hiện `Mang thai · 20 tuần` và `Đã sinh · 6th`
- Bấm tên mẹ → modal hiện đủ chủ đề quan tâm, nguồn biết đến, thông tin bé
- Tab **Waitlist app (1)**: một email, tìm kiếm chạy
- Bấm **Xuất Excel** ở CẢ hai tab → hai file khác nhau, tên khác nhau, số cột khác nhau (21 vs 3)

- [ ] **Step 7: Thử ca lỗi**

Submit form sự kiện khi bỏ trống chủ đề quan tâm → phải hiện lỗi *"Vui lòng chọn ít nhất một chủ đề"* và cuộn tới chỗ sai.

Nhập ngày sinh bé 4 năm trước → lỗi *"Bé trên 36 tháng nằm ngoài phạm vi sự kiện"*.

- [ ] **Step 8: Commit ghi nhận (nếu có sửa vặt)**

```bash
git add -A
git commit -m "fix: sửa sau kiểm thử tay form v2"
```

---

## Sau khi xong

Chạy `superpowers:finishing-a-development-branch` để quyết định merge/PR.

**Nhắc lại rủi ro lịch:** mở đăng ký 25/07. Migration + attribute Brevo + header Sheet phải xong trên **production** trước ngày đó, không chỉ trên máy local. Deploy code mới khi DB production còn schema cũ = mọi lượt đăng ký hỏng.
