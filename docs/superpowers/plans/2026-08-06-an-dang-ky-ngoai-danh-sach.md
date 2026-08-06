# Ẩn đăng ký ngoài danh sách khách mời — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bảng `/admin` và mọi nơi liệt kê đăng ký chỉ còn thấy 517 mẹ trong danh sách khách mời đã chốt, thay vì 1003 dòng trong Supabase.

**Architecture:** Thêm cột `duoc_moi boolean not null default true` vào `registrations`, nạp một lần cờ `false` cho 486 dòng không có mã trong file Excel, rồi lọc bằng đúng một mệnh đề `.eq("duoc_moi", true)` trong `listRegistrations()`. Vì `listRegistrations()` là điểm nghẽn duy nhất của cả 5 nơi tiêu thụ, không nơi nào phải sửa riêng. Đường `findByCode()` **không** lọc, nên check-in QR không đổi hành vi.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (PostgREST qua `@supabase/supabase-js`), vitest, Python 3 + openpyxl (chỉ để sinh file SQL một lần).

**Spec:** `docs/superpowers/specs/2026-08-06-an-dang-ky-ngoai-danh-sach-design.md`

## Global Constraints

- **THỨ TỰ BẮT BUỘC: Task 2 (chạy SQL trên Supabase) phải xong TRƯỚC khi code của Task 4 lên production.** Deploy `.eq("duoc_moi", true)` khi cột chưa tồn tại thì PostgREST trả lỗi, `listRegistrations()` ném, `/admin` thành 502 và trang gửi mail hàng loạt chết theo. Thêm cột với `default true` không đổi hành vi gì nên chạy trước là an toàn tuyệt đối.
- Khoá đối chiếu là `checkin_code`, **không phải** `email`. Ops đã sửa email của 4 mẹ sau khi xuất Excel; đối chiếu bằng email ẩn oan đúng 4 mẹ đó.
- Số liệu kỳ vọng, dùng làm mốc kiểm ở mọi bước: **1003** dòng tổng, **517** `duoc_moi = true`, **486** `duoc_moi = false`, **0** dòng `false` mà `checked_in = true`.
- Không đường ghi nào được gửi cột `duoc_moi` lên DB. Default của Postgres là thứ duy nhất quyết định giá trị lúc insert.
- `findByCode()`, `findByEmail()`, `adminUpdateCheckin()`, `checkinByCode()`, bảng `waitlist` — **không đụng tới**.
- Chú thích và chuỗi hiển thị viết tiếng Việt, theo văn phong sẵn có của repo (giải thích *vì sao*, không mô tả lại code).
- File `.env.local` chứa khoá thật — không bao giờ commit, không bao giờ in ra log.
- Đường dẫn file Excel nguồn: `/Users/lehuuphu/Downloads/MamaOi – Đăng ký.xlsx`. File này nằm NGOÀI repo và không được commit (chứa PII của 1003 người).

---

### Task 1: Sinh file SQL nạp danh sách khách mời

**Files:**
- Create: `supabase/2026-08-06-duoc-moi.sql` (sinh tự động, có commit)
- Create: `scripts/sinh-duoc-moi-sql.py` (bộ sinh, có commit để lần sau nạp lại được)
- Đọc (không sửa, không commit): `/Users/lehuuphu/Downloads/MamaOi – Đăng ký.xlsx`

**Interfaces:**
- Consumes: không có.
- Produces: `supabase/2026-08-06-duoc-moi.sql` — file SQL Task 2 sẽ chạy tay. Chứa một `alter table … add column if not exists duoc_moi boolean not null default true` và một `update … set duoc_moi = false where created_at < '2026-08-06T00:00:00+07:00' and checkin_code not in (518 mã)`.

- [ ] **Step 1: Kiểm openpyxl có sẵn**

Run: `python3 -c "import openpyxl; print(openpyxl.__version__)"`
Expected: in ra số phiên bản. Nếu `ModuleNotFoundError` thì `python3 -m pip install openpyxl` rồi chạy lại.

- [ ] **Step 2: Viết bộ sinh**

Tạo `scripts/sinh-duoc-moi-sql.py` với đúng nội dung sau:

```python
"""Sinh supabase/2026-08-06-duoc-moi.sql từ sheet `register` của file Excel chốt
danh sách khách mời.

    python3 scripts/sinh-duoc-moi-sql.py "/duong/dan/MamaOi – Đăng ký.xlsx"

File Excel nằm NGOÀI repo (chứa PII của 1003 người) nên đường dẫn truyền vào,
không hardcode. Bộ sinh này được commit để lần nạp lại sau còn tái lập được
chính xác cách 518 mã kia được chọn.
"""
import re, sys, openpyxl

XLSX = sys.argv[1] if len(sys.argv) > 1 else '/Users/lehuuphu/Downloads/MamaOi – Đăng ký.xlsx'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'supabase/2026-08-06-duoc-moi.sql'

ws = openpyxl.load_workbook(XLSX, data_only=True)['register']
hdr = [c for c in next(ws.iter_rows(values_only=True))]
i = hdr.index('Mã check-in')
codes = sorted({str(r[i]).strip() for r in ws.iter_rows(min_row=2, values_only=True) if r[i]})

# Hai cổng chặn. Một mã méo hoặc thiếu mã lọt vào `not in (...)` là ẩn nhầm mẹ
# thật, mà file SQL 518 dòng thì không ai soi ra bằng mắt. Thà dừng còn hơn ghi.
bad = [c for c in codes if not re.fullmatch(r'MO-[A-Z0-9]{6}', c)]
if bad:
    sys.exit(f'Mã sai định dạng, dừng: {bad}')
if len(codes) != 518:
    sys.exit(f'Chờ 518 mã, đọc được {len(codes)}. Dừng để người kiểm lại.')

lines = ',\n'.join('    ' + ', '.join(f"'{c}'" for c in codes[k:k + 6]) for k in range(0, len(codes), 6))
open(OUT, 'w', encoding='utf-8').write(f'''-- Ẩn khỏi /admin những đăng ký KHÔNG nằm trong danh sách khách mời đã chốt.
--
-- Danh sách khách mời là {len(codes)} mã check-in trong sheet `register` của file
-- "MamaOi – Đăng ký.xlsx" (bản 06/08/2026, ops chốt tay từ 1003 lượt đăng ký).
-- Sinh tự động bởi scripts/sinh-duoc-moi-sql.py — đừng sửa tay danh sách bên dưới.
--
-- Khoá đối chiếu là `checkin_code` chứ KHÔNG phải email: ops đã sửa email của 4
-- mẹ sau khi xuất file (meomeodat@gnail.com -> @gmail.com, tuan8150@gmail.cm ->
-- .com, ...). Đối chiếu bằng email là ẩn oan đúng 4 mẹ đó. Mã check-in bất biến.
--
-- CHẠY TAY trong Supabase SQL editor TRƯỚC KHI deploy code đọc cột này. Chỉ
-- thêm cột và cập nhật cờ, KHÔNG xoá dòng nào. Chạy lại nhiều lần vẫn an toàn.
-- Kiểm trước khi chạy:  select count(*) from registrations;   -- kỳ vọng 1003

alter table registrations
  add column if not exists duoc_moi boolean not null default true;

-- `created_at <` là LƯỚI AN TOÀN, không phải trang trí: thiếu nó, chạy lại file
-- này sau 06/08 sẽ ẩn mất mọi đăng ký ops tạo tay về sau — đúng thứ mà default
-- `true` sinh ra để bảo vệ.
update registrations set duoc_moi = false
where created_at < '2026-08-06T00:00:00+07:00'
  and checkin_code not in (
{lines}
  );

-- Kỳ vọng sau khi chạy: 517 true, 486 false, 0 dòng false mà đã check-in.
-- select count(*) filter (where duoc_moi)      from registrations;  -- 517
-- select count(*) filter (where not duoc_moi)  from registrations;  -- 486
-- select count(*) from registrations where not duoc_moi and checked_in;  -- 0
''')
print(f'Đã ghi {OUT}: {len(codes)} mã')
```

- [ ] **Step 3: Chạy bộ sinh**

Run: `python3 scripts/sinh-duoc-moi-sql.py "/Users/lehuuphu/Downloads/MamaOi – Đăng ký.xlsx"`
Expected: `Đã ghi supabase/2026-08-06-duoc-moi.sql: 518 mã`

Nếu in ra "Chờ 518 mã, đọc được N" thì **DỪNG** — file Excel đã đổi so với lúc viết spec, phải đối chiếu lại số liệu với người dùng trước khi đi tiếp.

- [ ] **Step 4: Kiểm file sinh ra**

Run:
```bash
grep -o "'MO-[A-Z0-9]\{6\}'" supabase/2026-08-06-duoc-moi.sql | sort -u | wc -l
grep -c "add column if not exists duoc_moi" supabase/2026-08-06-duoc-moi.sql
grep -c "created_at < '2026-08-06T00:00:00+07:00'" supabase/2026-08-06-duoc-moi.sql
```
Expected: lần lượt `518`, `1`, `1`.

Mệnh đề `created_at <` phải có mặt — thiếu nó là lỗi nghiêm trọng, xem Global Constraints.

- [ ] **Step 5: Commit**

```bash
git add scripts/sinh-duoc-moi-sql.py supabase/2026-08-06-duoc-moi.sql
git commit -m "feat: SQL nạp cột duoc_moi cho 518 mã trong danh sách khách mời"
```

---

### Task 2: Chạy SQL trên Supabase và xác minh số liệu

**Files:** không sửa file nào. Task này thao tác trên database production.

**Interfaces:**
- Consumes: `supabase/2026-08-06-duoc-moi.sql` từ Task 1.
- Produces: cột `registrations.duoc_moi` tồn tại trên Supabase, 486 dòng đã được đặt `false`. Task 4 phụ thuộc vào việc này đã xong.

> **Task này chạm production và cần người dùng bấm.** Đưa nội dung file SQL cho người dùng chạy trong Supabase SQL editor, hoặc xin phép chạy qua REST/psql. Không tự ý chạy khi chưa được đồng ý.

- [ ] **Step 1: Xác nhận có bản backup trước khi đụng schema**

Run: `ls -la /Users/lehuuphu/Downloads/MAMAOI/supabase-backup-*/manifest.json`
Expected: có ít nhất một thư mục backup. Bản chụp lúc 06/08 10:56 chứa đủ 1003 dòng `registrations` và 416 dòng `waitlist`.

Không có backup thì **DỪNG** và chạy `python3 /Users/lehuuphu/Downloads/MAMAOI/backup_supabase.py` trước.

- [ ] **Step 2: Đếm mốc trước khi chạy**

Chạy trong Supabase SQL editor:
```sql
select count(*) from registrations;
```
Expected: `1003`.

Ra số khác thì **DỪNG** — dữ liệu đã đổi kể từ lúc chốt spec, phải đối chiếu lại 517/486 với người dùng.

- [ ] **Step 3: Chạy file SQL**

Dán toàn bộ nội dung `supabase/2026-08-06-duoc-moi.sql` vào Supabase SQL editor và chạy.
Expected: `ALTER TABLE` thành công, `UPDATE 486`.

- [ ] **Step 4: Xác minh ba con số**

Chạy trong Supabase SQL editor:
```sql
select
  count(*)                                          as tong,
  count(*) filter (where duoc_moi)                  as hien,
  count(*) filter (where not duoc_moi)              as an,
  count(*) filter (where not duoc_moi and checked_in) as an_ma_da_checkin
from registrations;
```
Expected: `tong = 1003`, `hien = 517`, `an = 486`, `an_ma_da_checkin = 0`.

Bất kỳ số nào lệch → **DỪNG**, đừng đi tiếp sang Task 3/4. Cách lùi: `update registrations set duoc_moi = true;` đưa mọi thứ về trạng thái không lọc, app vẫn chạy y như cũ.

- [ ] **Step 5: Xác minh 4 mẹ từng bị sửa email KHÔNG bị ẩn oan**

Chạy trong Supabase SQL editor:
```sql
select email, checkin_code, duoc_moi from registrations
where checkin_code in ('MO-8U4WXJ', 'MO-ZFNKWJ', 'MO-S5YQXS', 'MO-NUL3X7');
```
Expected: 4 dòng, tất cả `duoc_moi = true`.

Đây là phép kiểm quan trọng nhất của cả task: nó chứng minh việc đối chiếu bằng `checkin_code` thay vì email đã có tác dụng thật.

- [ ] **Step 6: Xác nhận app vẫn chạy y như cũ**

Mở `/admin`. Expected: vẫn hiện **1003** dòng, không có gì đổi — code chưa đọc cột mới. Đây là bằng chứng bước migration không gây gián đoạn.

---

### Task 3: Đưa `duoc_moi` vào kiểu, chặn mọi đường ghi gửi cột này lên

**Files:**
- Modify: `src/lib/supabase.ts:10-47` (kiểu `RegistrationRow`), `:85-89` (kiểu trả về `registrationToRow`), `:154-159` (tham số `insertRegistrationThuCong`)
- Modify: `src/lib/dang-ky-thu-cong.ts:89-95` (kiểu trả về `thuCongToRow`)
- Test: `src/lib/supabase-rows.test.ts`, `src/lib/dang-ky-thu-cong.test.ts`

**Interfaces:**
- Consumes: cột `duoc_moi` đã tồn tại trên DB (Task 2).
- Produces: `RegistrationRow` có thêm trường `duoc_moi: boolean`. `registrationToRow(data, code, moc)` và `thuCongToRow(d, code)` giữ nguyên chữ ký, chỉ đổi kiểu trả về thành `Omit<RegistrationRow, "id" | "created_at" | "checked_in" | "checked_in_at" | "checked_in_source" | "duoc_moi">`. Task 4 dùng `RegistrationRow` đã có trường mới.

> **Lưu ý về "red" của task này:** cái đỏ trước là **trình biên dịch TypeScript**, không phải vitest. Step 2 làm `tsc` đỏ, Step 3 làm nó xanh. Test vitest ở Step 4 là lưới chống hồi quy cho tương lai — Step 5 chứng minh nó thật sự bắt được lỗi.

- [ ] **Step 1: Chụp mốc — toàn bộ test đang xanh**

Run: `npm test`
Expected: PASS toàn bộ. Ghi lại số test để so ở cuối.

- [ ] **Step 2: Thêm trường vào `RegistrationRow` để `tsc` đỏ**

Trong `src/lib/supabase.ts`, thêm vào cuối type `RegistrationRow` (ngay sau `checked_in_source`):

```ts
  /**
   * Có nằm trong danh sách khách mời đã chốt hay không. `false` = ẩn khỏi MỌI
   * chỗ liệt kê (`listRegistrations`), nhưng vẫn tra được bằng mã
   * (`findByCode`) nên check-in QR không đổi hành vi.
   *
   * DB đặt `default true`, và KHÔNG đường ghi nào được gửi cột này lên — đó là
   * lý do nó nằm trong `Omit<>` ở `registrationToRow` / `thuCongToRow` /
   * `insertRegistrationThuCong`. Nhờ vậy dòng ops tạo tay mặc định hiện, còn
   * một mẹ đã ẩn gửi lại form thì upsert không bật cô ấy hiện lại.
   */
  duoc_moi: boolean;
```

- [ ] **Step 3: Chạy `tsc` để thấy nó đỏ**

Run: `npx tsc --noEmit`
Expected: FAIL, hai lỗi kiểu `Property 'duoc_moi' is missing in type ... but required in type 'Omit<RegistrationRow, ...>'` — một ở `registrationToRow` (`src/lib/supabase.ts`), một ở `thuCongToRow` (`src/lib/dang-ky-thu-cong.ts`).

- [ ] **Step 4: Thêm `"duoc_moi"` vào ba chỗ `Omit<>` để xanh lại**

Trong `src/lib/supabase.ts`, kiểu trả về của `registrationToRow`:

```ts
): Omit<RegistrationRow, "id" | "created_at" | "checked_in" | "checked_in_at" | "checked_in_source" | "duoc_moi"> {
```

Trong `src/lib/supabase.ts`, tham số của `insertRegistrationThuCong`:

```ts
  row: Omit<
    RegistrationRow,
    "id" | "created_at" | "checked_in" | "checked_in_at" | "checked_in_source" | "duoc_moi"
  >,
```

Trong `src/lib/dang-ky-thu-cong.ts`, kiểu trả về của `thuCongToRow`:

```ts
): Omit<
  RegistrationRow,
  "id" | "created_at" | "checked_in" | "checked_in_at" | "checked_in_source" | "duoc_moi"
> {
```

Không sửa thân hàm nào — không hàm nào được gán `duoc_moi`.

- [ ] **Step 5: Chạy `tsc` để xác nhận xanh**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 6: Thêm lưới chống hồi quy vào `supabase-rows.test.ts`**

Thêm vào cuối `describe("registrationToRow", ...)` trong `src/lib/supabase-rows.test.ts`:

```ts
  /**
   * Cột `duoc_moi` do DB quyết định bằng `default true`, KHÔNG do code. Gửi kèm
   * nó trong payload là phá hai thứ cùng lúc: dòng ops tạo tay hết mặc định
   * hiện, và `insertRegistration` (upsert) sẽ bật lại thành hiện một mẹ mà ops
   * đã cố tình ẩn. `Omit<>` chặn ở tầng kiểu; test này chặn ở tầng chạy thật.
   */
  it("KHÔNG gửi duoc_moi lên DB — cột đó do default của Postgres quyết định", () => {
    expect(registrationToRow(mangThai, "MO-23456A", MOC)).not.toHaveProperty("duoc_moi");
    expect(registrationToRow(daSinh, "MO-23456A", MOC)).not.toHaveProperty("duoc_moi");
  });
```

- [ ] **Step 7: Thêm lưới tương tự vào `dang-ky-thu-cong.test.ts`**

Thêm vào cuối `describe("thuCongToRow", ...)` trong `src/lib/dang-ky-thu-cong.test.ts`, ngay sau test `"không đụng tới các cột check-in"`. Dùng lại biến `row` đã dựng sẵn ở đầu `describe` (dòng 88) — đúng lối các test khác trong khối này:

```ts
  /**
   * Cùng lý lẽ với test cùng tên trong supabase-rows.test.ts: dòng ops tạo tay
   * phải HIỆN ngay sau khi thêm, và điều đó chỉ đúng khi payload không mang
   * `duoc_moi` để `default true` của Postgres được áp.
   */
  it("KHÔNG gửi duoc_moi lên DB — cột đó do default của Postgres quyết định", () => {
    expect(row).not.toHaveProperty("duoc_moi");
  });
```

- [ ] **Step 8: Chạy test**

Run: `npm test`
Expected: PASS toàn bộ, nhiều hơn Step 1 đúng 2 test.

- [ ] **Step 9: Chứng minh lưới thật sự bắt được lỗi**

Tạm thêm `duoc_moi: true,` vào object trả về của `thuCongToRow` trong `src/lib/dang-ky-thu-cong.ts`.

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` FAIL (`'duoc_moi' does not exist in type 'Omit<...>'`). Nếu vì lý do nào đó `tsc` cho qua, thì `npm test` phải FAIL ở test vừa thêm.

**Gỡ dòng tạm đó ra**, rồi chạy lại `npx tsc --noEmit && npm test` → xanh.

- [ ] **Step 10: Commit**

```bash
git add src/lib/supabase.ts src/lib/dang-ky-thu-cong.ts src/lib/supabase-rows.test.ts src/lib/dang-ky-thu-cong.test.ts
git commit -m "feat: thêm cột duoc_moi vào RegistrationRow, chặn mọi đường ghi gửi cột này"
```

---

### Task 4: Lọc `listRegistrations` và xác minh trên app thật

**Files:**
- Modify: `src/lib/supabase.ts:207-214` (hàm `listRegistrations`)

**Interfaces:**
- Consumes: cột `duoc_moi` đã có dữ liệu đúng trên DB (Task 2), trường `duoc_moi` đã có trong `RegistrationRow` (Task 3).
- Produces: `listRegistrations()` chỉ trả về dòng `duoc_moi = true`. Chữ ký không đổi: `Promise<RegistrationRow[]>`. Năm nơi tiêu thụ (`/admin`, `/api/admin/registrations`, `/api/admin/export`, `/admin/gui-mail-hang-loat` page + route, `/admin/gui-mail` page) tự động nhận danh sách đã lọc, không nơi nào phải sửa.

> **Chặn cứng:** không làm task này nếu Task 2 Step 4 chưa cho đúng 517/486/0. Deploy mệnh đề `.eq` khi cột chưa tồn tại là làm chết `/admin`.

- [ ] **Step 1: Xác nhận Task 2 đã xong**

Chạy trong Supabase SQL editor:
```sql
select count(*) filter (where duoc_moi) as hien, count(*) filter (where not duoc_moi) as an
from registrations;
```
Expected: `hien = 517`, `an = 486`. Chưa đúng thì **DỪNG**, quay lại Task 2.

- [ ] **Step 2: Thêm mệnh đề lọc**

Trong `src/lib/supabase.ts`, thay thân `listRegistrations`:

```ts
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
```

- [ ] **Step 3: Chạy test, lint, build**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: tất cả PASS. Không test nào vỡ — mọi test route đều `vi.mock("@/lib/supabase")` nên không chạm mệnh đề này.

- [ ] **Step 4: Xác minh trên dev server — đây là phép kiểm thật của task**

Run: `npm run dev`, rồi đăng nhập `/admin`.

Kiểm đủ năm điểm:

| Nơi | Kỳ vọng |
|---|---|
| Tab "Sự kiện" | `Sự kiện (517)` |
| Dòng đếm trên bảng | `Đã check-in: N / 517` |
| Nút xuất | `Xuất Excel (517)` |
| `/admin/gui-mail-hang-loat` | danh sách 517 dòng |
| `/admin/gui-mail` | picker 517 dòng |

Tab "Waitlist app" phải **không đổi** (414 dòng) — bảng đó ngoài phạm vi.

- [ ] **Step 5: Xác minh check-in của người bị ẩn VẪN chạy**

Lấy một mã thuộc nhóm ẩn:
```sql
select checkin_code from registrations where not duoc_moi and not checked_in limit 1;
```

Mở `http://localhost:3000/check-in/<mã đó>`.
Expected: trang hiện thông tin mẹ và check-in được **bình thường** — đúng quyết định #2 của spec.

Sau đó kiểm lại: `select checked_in from registrations where checkin_code = '<mã đó>';` → `true`. Rồi trả về trạng thái cũ: `update registrations set checked_in = false, checked_in_at = null, checked_in_source = null where checkin_code = '<mã đó>';`

Mẹ này vẫn **không** xuất hiện trong bảng `/admin` — đúng như §7 của spec đã nêu là rủi ro chấp nhận.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat: listRegistrations chỉ trả về đăng ký trong danh sách khách mời"
```

- [ ] **Step 7: Báo cáo số liệu thật cho người dùng**

Đưa lại: số dòng ở mỗi điểm trong bảng Step 4, kết quả Step 5, và nhắc rằng 486 dòng vẫn nguyên trong DB cùng bản backup `~/Downloads/MAMAOI/supabase-backup-20260806-105631`. Nêu rõ nếu có bước nào bỏ qua.

---

## Ngoài phạm vi kế hoạch này

- Dọn 486 contact tương ứng bên **Brevo** và trên **Google Sheet** — hai chỗ đó vẫn còn đủ dữ liệu, và gửi mail từ dashboard Brevo vẫn chạm tới họ.
- Nút gạt "Hiện cả ngoài danh sách" — spec đã loại ở quyết định #3.
- Bốn mã QR đang bị hai người dùng chung (`MO-48YUMS`, `MO-EW8FT6`, `MO-8K63ED`, `MO-RSNASJ`) — việc của ops, không sửa bằng code. Xem §9 của spec.
- Bảng `waitlist` — không lọc gì.
