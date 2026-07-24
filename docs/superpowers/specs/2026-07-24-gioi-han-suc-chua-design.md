# Giới hạn 500 chỗ cho Mama Ơi Day — Design

**Ngày:** 2026-07-24
**Trạng thái:** chờ user duyệt
**Nền tảng:** tiếp nối `2026-07-20-google-sheets-mirror-design.md` và `2026-07-20-form-dang-ky-v2-design.md` (đã merge `main`)

## Mục tiêu

Sự kiện chỉ chứa được **500 mẹ**. Hiện `POST /api/dang-ky` nhận vô hạn lượt đăng ký — mẹ thứ 501, 600, 900 đều nhận email xác nhận kèm mã QR như thường, và ban tổ chức chỉ phát hiện ra khi mở `/admin` đếm tay.

Spec này thêm một cổng chặn: **kiểm tra tại thời điểm mẹ bấm "Đăng ký ngay"**. Nếu lúc đó đã đủ 500 mẹ thì báo hết chỗ, không sinh mã, không gửi email.

**Gấp:** đăng ký mở ngày **25/07/2026** (ngày mai), điều hướng từ trang Facebook của Ngô Thanh Vân. Lượt submit sẽ dồn vào một khoảng rất hẹp, nên đụng độ ở mốc 500 là tình huống thật chứ không phải giả định.

## Hiện trạng (đã kiểm tra 2026-07-24)

`POST /api/dang-ky` chạy đúng thứ tự sau:

| Bước | Vị trí | Thất bại thì sao |
|---|---|---|
| Validate Zod + honeypot | `route.ts:36-73` | 400, kèm `fieldErrors` |
| `existingCheckinCode` (tra Brevo, tái dùng mã cũ) | `route.ts:82-88` | nuốt lỗi, sinh mã mới |
| Brevo upsert contact | `route.ts:92-101` | **502 — đăng ký KHÔNG thành công** |
| Gửi email xác nhận + QR | `route.ts:106-116` | `warnings: ["email"]` |
| Supabase upsert `registrations` | `route.ts:127-138` | `warnings: ["supabase"]` |
| Google Sheets append | `route.ts:147-158` | `warnings: ["sheets"]` |

Không có bất kỳ chỗ nào đếm số lượng.

## Quyết định 1 — Đếm ở Supabase, KHÔNG đếm dòng Google Sheet

User đề xuất ban đầu: *"kiểm tra các email đã được đăng ký trên excel (đếm số row)"*. Đếm dòng Sheet cho ra **số sai theo cả hai chiều**, nên spec này không dùng.

| Nguồn | Đếm được gì | Kết luận |
|---|---|---|
| Google Sheet (tab `register`) | Append thuần tuý — mẹ submit hai lần là **hai dòng**. Ghi Sheet lại non-fatal (`route.ts:147`), lỗi thì **thiếu dòng** mà đăng ký vẫn thành công. | ❌ Vừa đếm dư (trùng) vừa đếm thiếu (append lỗi) |
| Brevo | Là nguồn sự thật của contact, nhưng gộp cả `app-waitlist` lẫn `su-kien` trong cùng danh sách contact; đếm phải lọc theo attribute qua API phân trang. | ❌ Chậm, nằm trên đường đi của mẹ đang chờ |
| Supabase `registrations` | Upsert theo `email` (`supabase.ts:114`) → **một mẹ đúng một dòng**. Bảng riêng, không lẫn waitlist. `count` là một câu query. | ✅ |

Chính `sheets.ts:60` đã tự ghi cảnh báo này vào dòng đầu Sheet: *"⚠ Bản ghi thô, tự động — có thể có dòng trùng […] Số liệu chính thức: /admin → Xuất Excel."* — tức tác giả trước đã xác định Sheet không phải nguồn đếm.

`count(*)` của `registrations` **chính là** số mẹ đang giữ chỗ, và cũng đúng bằng con số `/admin` hiển thị.

## Quyết định 2 — Cổng chặn đặt trong Postgres, không đặt trong route

Cách hiển nhiên là đếm trong route rồi mới ghi:

```ts
const { count } = await db().from("registrations").select("*", { count: "exact", head: true });
if (count >= 500) return 409;
await insertRegistration(...);
```

Cách này **hỏng đúng vào lúc quan trọng nhất**. Hai request cùng đọc `count = 499` trong cùng một mili-giây thì cả hai đều đi tiếp và ghi → 501 mẹ. Ngày mở đăng ký có traffic dồn từ Facebook, khoảng trống giữa `select` và `insert` đủ rộng để lọt nhiều hơn một.

Thay vào đó, **đếm và ghi nằm trong cùng một transaction có khoá**, dưới dạng một Postgres function:

```sql
create or replace function giu_cho_dang_ky(p_row jsonb, p_gioi_han int)
returns text
language plpgsql
as $$
declare
  v_email text := p_row->>'email';
  v_dem   int;
begin
  -- Khoá theo transaction: các lượt submit đồng thời xếp hàng qua đây, nên
  -- count() bên dưới không bao giờ đọc phải số cũ của một transaction khác
  -- đang ghi dở. Tự nhả khi transaction kết thúc, không cần unlock tay.
  perform pg_advisory_xact_lock(hashtext('mamaoi_suc_chua'));

  -- Email đã có chỗ thì LUÔN đi tiếp, kể cả khi đã đủ 500. Mẹ này không
  -- chiếm thêm ghế nào — chặn ở đây là đuổi mẹ khỏi chỗ mẹ đang giữ.
  if exists (select 1 from registrations where email = v_email) then
    return 'da_dang_ky';
  end if;

  select count(*) into v_dem from registrations;
  if v_dem >= p_gioi_han then
    return 'het_cho';
  end if;

  insert into registrations
    select * from jsonb_populate_record(
      null::registrations,
      jsonb_build_object(
        'id',         gen_random_uuid(),
        'created_at', now(),
        'checked_in', false
      ) || p_row
    );
  return 'moi';
end $$;
```

Ba điểm đáng chú ý:

- **`jsonb_populate_record` thay vì liệt kê cột.** Danh sách cột chỉ được phép tồn tại một chỗ — `registrationToRow` trong `supabase.ts:83`. Viết lại 20 tên cột trong SQL nghĩa là lần sau thêm field phải nhớ sửa hai nơi, quên một bên là ghi thiếu dữ liệu âm thầm.
- **`jsonb_build_object(...) || p_row`** đứng trước để bù giá trị mặc định. `jsonb_populate_record` với `null::registrations` đặt NULL cho mọi cột vắng mặt (**không** lấy `DEFAULT` của bảng), nên `id` sẽ NULL và vi phạm primary key nếu không bù.
- **`p_gioi_han` là tham số**, không hard-code 500 trong SQL — xem Quyết định 5.

File migration: `supabase/2026-07-24-suc-chua.sql`, theo đúng quy ước hai file migration đã có (chạy tay trong Supabase SQL editor trước khi deploy, chỉ thêm, chạy lại nhiều lần vẫn an toàn).

## Quyết định 3 — Cổng chặn chạy TRƯỚC Brevo, đảo thứ tự route

Cổng phải nằm trước Brevo. Đặt sau thì mẹ đã nhận email xác nhận kèm mã QR rồi mới bị báo hết chỗ — không sửa được.

Thứ tự mới:

| Bước | Thất bại thì sao |
|---|---|
| Validate Zod + honeypot | 400 (không đổi) |
| `existingCheckinCode` (tra Brevo) | nuốt lỗi, sinh mã mới (không đổi) |
| **`giu_cho_dang_ky` — cổng chặn + ghi Supabase** | **`het_cho` → 409; lỗi kỹ thuật → đi tiếp (Quyết định 4)** |
| `insertRegistration` — CHỈ khi RPC trả `'da_dang_ky'` | `warnings: ["supabase"]` |
| Brevo upsert contact | 502 (không đổi) |
| Gửi email xác nhận + QR | `warnings: ["email"]` (không đổi) |
| Google Sheets append | `warnings: ["sheets"]` (không đổi) |

Bước Supabase cũ (`route.ts:127-138`) bị bước cổng chặn thay thế cho nhánh `su-kien`. RPC đã tự `insert` ở nhánh `'moi'`, nên route **chỉ** gọi thêm `insertRegistration` khi RPC trả `'da_dang_ky'` — để mẹ sửa số điện thoại rồi submit lại thì dòng cũ được cập nhật, đúng hành vi upsert hiện nay. Gọi ở cả hai nhánh sẽ thành một lượt ghi thừa ngay sau khi vừa insert.

**Nhánh `app-waitlist` giữ nguyên hoàn toàn** — waitlist app không có giới hạn chỗ, vẫn `insertWaitlist` ở đúng vị trí cũ.

Hệ quả của việc đảo thứ tự, đã cân nhắc và chấp nhận:

- **Brevo lỗi sau khi đã giữ chỗ** → mẹ thấy 502 và submit lại. Lần hai, email đã nằm trong bảng → `'da_dang_ky'` → không tốn ghế thứ hai. Tự lành.
- **Ghế bị giữ cho một lượt đăng ký mà mẹ tưởng là thất bại** (Brevo chết hẳn, mẹ bỏ cuộc) → dòng vẫn nằm trong `registrations` và chiếm một chỗ. Đây là cái giá của việc chặn chính xác; ops nhìn `/admin` thấy dòng không có contact Brevo tương ứng và xoá tay được.

## Quyết định 4 — Supabase hỏng thì MỞ, không đóng

Nếu `giu_cho_dang_ky` ném lỗi, hoặc `supabaseConfigured()` trả `false` (môi trường dev chưa cấu hình), route **cho đăng ký đi tiếp** thay vì báo hết chỗ.

| | Fail open (chọn) | Fail closed |
|---|---|---|
| Supabase chập 5 phút ngày mở đăng ký | Nhận dư vài mẹ ở sự kiện miễn phí vốn luôn có người vắng | Đuổi **toàn bộ** mẹ vào đăng ký trong 5 phút đó, đúng lúc traffic Facebook cao nhất |
| Khôi phục | Ops back-fill từ Brevo — đúng đường đã ghi ở `route.ts:127` | Không khôi phục được, lead đã bỏ đi |

Lỗi ghi vào `warnings: ["supabase"]` như hiện tại, và log to để ops thấy.

## Quyết định 5 — `EVENT_CAPACITY` đọc từ env, mặc định 500

**User chốt: env override.**

`EVENT.capacity` hiện là chuỗi hiển thị `"500 mẹ bỉm"`, và `page.tsx:608` đang `parseInt` chuỗi đó để lấy số — mong manh, đổi copy thành `"Giới hạn 500 mẹ"` là `parseInt` trả `NaN`.

Thêm vào `src/lib/constants.ts`:

```ts
/** Sức chứa sự kiện. Ops đổi được qua env EVENT_CAPACITY mà không cần deploy. */
export const SUC_CHUA_MAC_DINH = 500;
```

và một hàm đọc env phía server (`src/lib/suc-chua.ts`):

```ts
export function sucChua(): number {
  const raw = process.env.EVENT_CAPACITY;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isInteger(n) && n > 0 ? n : SUC_CHUA_MAC_DINH;
}
```

Env rác (`"abc"`, `"0"`, `"-5"`) rơi về 500 chứ không về `NaN` — `NaN >= p_gioi_han` trong SQL cho `null`, và cổng chặn sẽ im lặng không chặn gì cả.

`page.tsx:608` đổi sang dùng `SUC_CHUA_MAC_DINH` thay cho `parseInt(EVENT.capacity, 10)`. Chuỗi copy `EVENT.capacity` giữ nguyên từng chữ (wording khách duyệt).

Thêm `EVENT_CAPACITY` vào `.env.example`.

## Quyết định 6 — Mẹ 501 thấy gì

API trả **409** với `{ error, full: true, gioiHan: number }`.

`gioiHan` là **con số thật đang áp dụng** (`sucChua()`), không phải hằng 500. Nếu ops nâng `EVENT_CAPACITY=550` mà câu thông báo vẫn đọc hằng mặc định thì mẹ sẽ thấy "đã đủ 500 mẹ" trong khi hệ thống nhận tới 550 — sai số ngay trên màn hình từ chối. Form render số lấy từ response.

`RegistrationForm` hiện đã có sẵn ô đỏ `errors.form` (`RegistrationForm.tsx:251-255`) và hàm `scrollToFirstError` bắt theo `[role="alert"]`. Hết chỗ **không** dùng ô đỏ đó: đây không phải lỗi mẹ điền sai, mà là tin xấu sau khi mẹ đã điền xong một form dài.

Thay vào đó một khối riêng thay chỗ nút submit, dùng `bg-primary-faded` + `rounded-xl` như các surface khác:

> **Rất tiếc, sự kiện đã đủ 500 mẹ.**
> Mẹ để lại email để Mama Ơi báo ngay khi có chỗ trống nhé.

kèm nút dẫn sang form nhận tin app (`/ung-dung`) để không mất lead — đúng directive *Membership First*.

**Copy này CHƯA được khách duyệt.** Mọi wording trên trang đều là chữ khách duyệt, nên chuỗi trên là đề xuất; nếu khách sửa thì chỉ sửa hằng trong `constants.ts`, không đụng logic. Hằng đó là hàm nhận số chỗ (`(n: number) => \`Rất tiếc, sự kiện đã đủ ${n} mẹ.\``) để số luôn khớp `gioiHan` trả về từ API.

## Quyết định 7 — Không đụng `/admin`

**User chốt: giữ nguyên `/admin`.** Không thêm dòng đếm "482 / 500". Ops vẫn đếm được qua số dòng sẵn có trên bảng.

## Thay đổi theo file

| File | Thay đổi |
|---|---|
| `supabase/2026-07-24-suc-chua.sql` | **Mới.** Function `giu_cho_dang_ky`. Chạy tay trước khi deploy. |
| `src/lib/suc-chua.ts` | **Mới.** `sucChua()` đọc env; `quyetDinhSucChua()` thuần tuý, ánh xạ kết quả RPC → hành động của route. |
| `src/lib/suc-chua.test.ts` | **Mới.** Unit test hai hàm trên. |
| `src/lib/supabase.ts` | Thêm `giuChoDangKy(data, code, gioiHan)` gọi RPC, trả `'moi' \| 'da_dang_ky' \| 'het_cho'`. Dùng lại `registrationToRow`. `insertRegistration` giữ nguyên (còn dùng cho nhánh `da_dang_ky` để làm mới thông tin). |
| `src/lib/constants.ts` | Thêm `SUC_CHUA_MAC_DINH = 500` và chuỗi copy hết chỗ. |
| `src/app/api/dang-ky/route.ts` | Đảo thứ tự: cổng chặn trước Brevo. Nhánh `het_cho` → 409. |
| `src/app/api/dang-ky/route.test.ts` | Thêm case đầy chỗ → 409 + không gọi Brevo; email cũ vẫn qua được khi đầy. |
| `src/components/RegistrationForm.tsx` | Bắt `full: true` → hiện khối hết chỗ thay nút submit. |
| `src/app/page.tsx` | `parseInt(EVENT.capacity, 10)` → `SUC_CHUA_MAC_DINH`. |
| `.env.example` | Thêm `EVENT_CAPACITY`. |

## Kiểm chứng

**Tự động** (`npm run test`, vitest chạy env `node`, repo không có hạ tầng test component React):

- `sucChua()`: không có env → 500; `"550"` → 550; `"abc"` / `"0"` / `"-5"` / `""` → 500.
- `quyetDinhSucChua()`: `'het_cho'` → chặn; `'moi'` và `'da_dang_ky'` → đi tiếp; lỗi ném ra → đi tiếp (fail open).
- Route test với `vi.mock("@/lib/supabase")`: đầy chỗ → 409, `full: true`, **và `upsertContact` không được gọi lần nào** (khẳng định không có email nào được gửi cho mẹ bị từ chối). Email đã đăng ký → không trả 409 dù đang đầy.

**Tay** (không tự động hoá được vì cần Postgres thật):

- Chạy migration trong Supabase SQL editor, `select giu_cho_dang_ky('{"email":"x@y.z", ...}'::jsonb, 0)` → `'het_cho'`.
- Đặt `EVENT_CAPACITY=1` ở `.env.local`, đăng ký mẹ thứ hai → thấy khối hết chỗ, hộp thư không có email mới.
- `npm run lint`, `npm run build`.

## Ngoài phạm vi

- **Danh sách dự bị / waitlist sự kiện.** User chốt chặn cứng. Mẹ bị từ chối chỉ được mời sang form nhận tin app.
- **Khoá form trước khi mẹ điền** (hiện banner "đã đầy" ngay khi mở trang). User chốt kiểm tra tại thời điểm submit. Nghĩa là mẹ vẫn có thể điền hết form rồi mới biết hết chỗ — đã chấp nhận.
- **Đếm chỗ hiển thị realtime trên landing page.**
- **`/admin`** — Quyết định 7.
- **UI dropdown chọn thành phố** — đang tạm gác, quay lại sau khi việc này xong.
