# Form đăng ký v2 + Waitlist vào Admin — Design

**Ngày:** 2026-07-20
**Trạng thái:** đã duyệt (user duyệt 2026-07-20)
**Nền tảng:** tiếp nối `2026-07-20-google-sheets-mirror-design.md` (đã merge `main`)

## Mục tiêu

Hai việc, gộp một lần triển khai vì cùng đụng bảng `registrations` và trang `/admin`:

1. **Form đăng ký "Mama Ơi Day" đổi cấu trúc field** — thêm thông tin bé (tên, ngày sinh, giới tính), số tuần thai, chủ đề quan tâm, nguồn biết đến chương trình.
2. **Waitlist app ("Nhận tin khi Mama Ơi ra mắt") hiện trong `/admin`**, tách biệt khỏi đăng ký sự kiện.

User chọn gộp (2026-07-20) thay vì làm tuần tự. Lý do kỹ thuật ủng hộ: làm waitlist trước sẽ phải viết lại tab "Sự kiện" ngay sau đó khi form đổi cột.

## Hiện trạng (đã kiểm tra 2026-07-20, commit `19955c8`)

Test suite 30/30 pass, `npm run build` sạch.

**Luồng đăng ký** — `POST /api/dang-ky` phân nhánh theo `nguon`:

| Đích | `su-kien` | `app-waitlist` |
|---|---|---|
| Brevo (nguồn sự thật) | ✅ list `BREVO_LIST_EVENT` | ✅ list `BREVO_LIST_WAITLIST` |
| Email xác nhận | ✅ kèm QR check-in | ✅ email cảm ơn |
| Supabase | ✅ `registrations` | ❌ **chặn bởi `isRegistration(data)`** (`route.ts:108`) |
| Google Sheets | ✅ | ❌ (`route.ts:120`) |
| `/admin` | ✅ bảng check-in | ❌ |

Waitlist hiện **chỉ tồn tại ở Brevo**. Đó là lý do nó không hiện trong admin.

**Field form sự kiện hiện tại** (`validation.ts:28-75`): `hoTen`, `email`, `sdt`, `facebook?`, `tinhThanh`, `trangThai`, `beThangTuoi?`, `diCungChong`, `dongYNhanTin`.

## Quyết định thiết kế

### Quyết định 1 — Giữ `trang_thai` làm trục phân nhánh, KHÔNG thêm boolean mới

Yêu cầu của user viết "Nếu đang mang thai: Có/Không". Đó **chính là** trục `mang_thai | da_sinh` đang có, chỉ khác cách diễn đạt. Map thẳng lên enum cũ.

Không thêm cột `dang_mang_thai boolean`. Hai cột cùng mô tả một sự thật là mở đường cho trạng thái mâu thuẫn (`dang_mang_thai = true` nhưng `trang_thai = 'da_sinh'`), và `TRANG_THAI` đã nối vào Brevo segmentation, `sheets.ts`, `export-rows.ts`, `AdminDashboard`, cùng mô hình "Membership First" mà `CLAUDE.md` mô tả.

UI vẫn hiện đúng chữ user muốn ("Đang mang thai" / "Bé đã chào đời"); chỉ giá trị lưu là giữ nguyên.

### Quyết định 2 — Hỏi ngày sinh bé, TỰ SUY RA số tháng tuổi

Form cũ hỏi thẳng `beThangTuoi`. Form mới hỏi ngày sinh. **Bỏ hẳn ô nhập số tháng**, tính từ ngày sinh lúc ghi.

Lý do: "3 tháng tuổi" nhập ngày 20/07 sẽ sai vào tháng 10 — dữ liệu tự mục theo thời gian. Ngày sinh thì đúng vĩnh viễn. `BE_THANG_TUOI` gửi Brevo vẫn còn (segmentation cần con số này), chỉ khác là được tính chứ không phải gõ tay.

`be_thang_tuoi` vẫn lưu trong DB dưới dạng cột dẫn xuất — snapshot lúc đăng ký, phục vụ export/Sheets. Nguồn sự thật là `be_ngay_sinh`.

### Quyết định 3 — Bảng `waitlist` riêng, không dùng chung `registrations`

Waitlist chỉ có email + consent. Nhét vào `registrations` phải nới `NOT NULL` trên `ho_ten`, `sdt`, `tinh_thanh`, `trang_thai`, `checkin_code` — tức là gỡ lưới an toàn của đăng ký sự kiện thật, để một bug có thể ghi được dòng sự kiện thiếu SĐT.

`validation.ts:11-14` đã ghi rõ chủ ý này: *"padding the missing fields with placeholders would write fake phone numbers and fake baby ages into the CRM, which is worse than having no data at all."* Spec này giữ nguyên nguyên tắc đó.

### Quyết định 4 — Migration dựng lại, không backfill

User xác nhận (2026-07-20) Supabase **chưa có đăng ký thật**, chỉ dữ liệu test. Nên migration được phép `drop`/`add` cột thoải mái, không cần đường hai bước giữ dữ liệu.

Nếu điều này sai — có dữ liệu thật — migration phải viết lại theo hướng thêm cột nullable + backfill. Kiểm tra `select count(*) from registrations` trước khi chạy.

## Lược đồ dữ liệu

### `registrations` — dựng lại

```sql
-- Thông tin mẹ
ho_ten          text not null
email           text not null unique
sdt             text not null
facebook        text                      -- giữ, tuỳ chọn
tinh_thanh      text not null             -- nhãn UI đổi thành "Thành phố"

-- Trục phân nhánh
trang_thai      text not null check (trang_thai in ('mang_thai','da_sinh'))
thai_tuan       int  check (thai_tuan between 1 and 42)   -- chỉ khi mang_thai

-- Thông tin bé — chỉ khi da_sinh
ten_be          text
be_ngay_sinh    date
be_gioi_tinh    text check (be_gioi_tinh in ('nam','nu'))
be_thang_tuoi   int                       -- DẪN XUẤT từ be_ngay_sinh lúc ghi

-- Field mới
chu_de_quan_tam text[] not null default '{}'
nguon_biet_den  text not null check (nguon_biet_den in
                  ('facebook','tiktok','instagram','ban_be','khac'))

-- Giữ nguyên
di_cung_chong   boolean not null default false
dong_y_nhan_tin boolean not null
nguon           text not null
checkin_code    text not null unique
checked_in      boolean not null default false
checked_in_at   timestamptz
checked_in_source text check (checked_in_source in ('qr','admin'))
```

Bỏ so với bản cũ: không có. `be_thang_tuoi` đổi từ *nhập tay* sang *dẫn xuất* nhưng cột vẫn còn.

### `waitlist` — bảng mới

```sql
create table waitlist (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  email           text not null unique,
  dong_y_nhan_tin boolean not null default true
);
```

`email` unique để mẹ submit hai lần vẫn là một dòng (upsert), khớp cách `registrations` xử lý.

### Giá trị hợp lệ

**`chu_de_quan_tam`** (chọn nhiều, 9 giá trị):
`thai_ky`, `ivf`, `an_dam`, `ngu`, `tiem_chung`, `phat_trien_nao`, `van_dong`, `sua_me`, `sau_sinh`

Nhãn UI: Thai kỳ · IVF · Ăn dặm · Ngủ · Tiêm chủng · Phát triển não · Vận động · Nuôi con bằng sữa mẹ · Sau sinh

**`nguon_biet_den`** (chọn một, 5 giá trị):
`facebook`, `tiktok`, `instagram`, `ban_be`, `khac`

Nhãn UI: Facebook · TikTok · Instagram · Bạn bè · Khác

## Validation (`src/lib/validation.ts`)

`registrationSchema` thành **discriminated union** trên `trangThai`. Đây là chỗ ép quy tắc "ẩn hẳn thông tin bé", không chỉ ẩn ở UI:

- Nhánh `mang_thai`: `thaiTuan` **bắt buộc** (1–42); `tenBe` / `beNgaySinh` / `beGioiTinh` **không được phép có**.
- Nhánh `da_sinh`: `tenBe`, `beNgaySinh`, `beGioiTinh` **bắt buộc**; `thaiTuan` không được phép có.

Field chung cả hai nhánh: `hoTen`, `email`, `sdt`, `facebook?`, `tinhThanh`, `chuDeQuanTam`, `nguonBietDen`, `diCungChong`, `dongYNhanTin`, `recaptchaToken?`, `website?`.

Ràng buộc thêm:
- `chuDeQuanTam`: mảng, ít nhất 1 phần tử, mỗi phần tử thuộc 9 giá trị trên. Thông báo lỗi: *"Vui lòng chọn ít nhất một chủ đề"*.
- `beNgaySinh`: không được ở tương lai; không quá 36 tháng trước (khớp giới hạn `beThangTuoi.max(36)` cũ — *"Bé trên 36 tháng nằm ngoài phạm vi sự kiện"*).
- `waitlistSchema`: giữ nguyên, không đổi.

Hàm mới `thangTuoiTuNgaySinh(ngaySinh: Date, moc: Date): number` — hàm thuần, tính số tháng tròn. Đặt ở `src/lib/validation.ts` cạnh schema, test riêng.

## Form UI (`src/components/RegistrationForm.tsx`)

Chia 5 nhóm có tiêu đề, dùng lại component `Field` sẵn có:

1. **Thông tin mẹ** — Họ tên, Số điện thoại, Email, Thành phố (`PROVINCES`), Facebook (tuỳ chọn)
2. **Tình trạng hiện tại** — radio "Đang mang thai" / "Bé đã chào đời"
3. **Nhánh điều kiện:**
   - `mang_thai` → ô số "Thai bao nhiêu tuần?"
   - `da_sinh` → Tên bé, Ngày sinh (`<input type="date">`), Giới tính (radio Nam/Nữ)
4. **Chủ đề quan tâm** — 9 checkbox
5. **Nguồn biết đến chương trình** — 5 radio

Sau đó giữ nguyên: checkbox "đi cùng chồng", checkbox đồng ý, honeypot `website`.

Đổi nhánh mang thai/đã sinh **xoá giá trị của nhánh kia** khỏi state, để không gửi lên field mà schema cấm.

Nhãn checkbox đồng ý cập nhật theo wording user đưa: *"Tôi đồng ý cho Mama Ơi lưu trữ thông tin để gửi email xác nhận, tài liệu chương trình và các thông tin hữu ích."*

## Ảnh hưởng xuôi dòng

### Brevo (`src/lib/brevo.ts`)

Attribute mới cho nhánh `su-kien`: `THAI_TUAN`, `TEN_BE`, `BE_NGAY_SINH`, `BE_GIOI_TINH`, `CHU_DE_QUAN_TAM` (chuỗi nối `,`), `NGUON_BIET_DEN`.

Giữ nguyên tắc sẵn có ở `brevo.ts:78-82` — **chỉ gửi attribute khi nó có nghĩa**. `THAI_TUAN` không gửi cho mẹ đã sinh; `TEN_BE` không gửi cho mẹ đang mang thai. Gửi giá trị rỗng sẽ ghi đè dữ liệu cũ thành trống khi mẹ đăng ký lần hai (`updateEnabled: true`).

`BE_THANG_TUOI` vẫn gửi như cũ, lấy từ giá trị dẫn xuất.

### Google Sheets (`src/lib/sheets.ts`) và Excel (`src/lib/export-rows.ts`)

Cả hai đang cố định 15 cột. Cột mới nâng lên **21**, giữ đúng thứ tự giữa hai nơi:

```
Họ tên · Email · SĐT · Facebook · Thành phố · Tình trạng · Thai (tuần) ·
Tên bé · Ngày sinh bé · Giới tính bé · Bé (tháng tuổi) · Chủ đề quan tâm ·
Nguồn biết đến · Đi cùng chồng · Đồng ý nhận tin · Mã check-in ·
Nguồn đăng ký · Thời điểm đăng ký · Đã check-in · Giờ check-in · Nguồn check-in
```

`chu_de_quan_tam` xuất ra dạng chuỗi nối `, ` bằng nhãn tiếng Việt.

**Waitlist KHÔNG mirror sang Sheets** (user chọn 2026-07-20). Nhánh Sheets giữ nguyên điều kiện `isRegistration(data)`.

Google Sheet đích đang có header 15 cột từ lần trước — **phải xoá sheet hoặc sửa header tay** trước khi chạy bản mới, nếu không dữ liệu lệch cột.

### `/api/dang-ky` (`route.ts`)

Thêm nhánh waitlist vào Supabase, song song nhánh sự kiện đã có:

```
if (isRegistration(data) && supabaseConfigured())  → insertRegistration(...)
else if (supabaseConfigured())                     → insertWaitlist(data)
```

Giữ nguyên tắc hiện hành: **không được làm hỏng request**. Brevo đã giữ lead; lỗi Supabase chỉ log và đẩy vào `warnings`, đúng như `route.ts:106-115`.

### `/admin` — hai tab

`AdminDashboard` tách thành:

- `AdminDashboard` — vỏ ngoài, giữ state tab, render header + tab bar
- `EventTab` — toàn bộ logic hiện tại (poll, check-in, export, modal). **Chuyển nguyên khối, không sửa logic** ngoài việc đổi cột bảng theo schema mới.
- `WaitlistTab` — mới, đơn giản: bảng Email + Thời điểm đăng ký, ô tìm theo email, nút xuất Excel.

Tab bar hiện số đếm: `Sự kiện (342)` · `Waitlist (1.240)`.

Cột bảng tab Sự kiện: Họ tên · SĐT · Thành phố · Tình trạng · Bé · Check-in · Giờ check-in.
`AdminDetailModal` hiện đầy đủ field mới (chủ đề quan tâm, nguồn biết đến, thông tin bé).

**Waitlist không có poll tự động** (user chọn) — dữ liệu lấy lúc load trang, có nút "Làm mới". Poll 5s sinh ra cho lúc 500 mẹ check-in đồng thời; waitlist chỉ là danh sách đọc.

**Waitlist không có check-in** — không có gì để check vào.

### API mới

- `GET /api/admin/waitlist` — trả danh sách, cùng cơ chế `isAdmin()` như `/api/admin/registrations`
- `POST /api/admin/export` — thêm tham số `loai: "su-kien" | "waitlist"` để chọn bộ cột và tên file. Giữ nguyên nguyên tắc ở `export/route.ts:7-13`: nhận `ids`, server đọc lại từ DB, không tin dữ liệu client khai.

## Kiểm thử

Test hiện có phải sửa vì pin cấu trúc cũ: `export-rows.test.ts`, `sheets.test.ts`.
`validation.test.ts` hiện chỉ phủ `isValidCheckinCode` — không vỡ vì đổi schema; test schema mới thêm vào chính file này.

Test mới:

| Đối tượng | Ca |
|---|---|
| `thangTuoiTuNgaySinh` | tròn tháng, lẻ ngày, cùng tháng → 0, biên 36 tháng |
| `registrationSchema` nhánh `mang_thai` | thiếu `thaiTuan` → lỗi; có `tenBe` → lỗi; `thaiTuan` 0 và 43 → lỗi |
| `registrationSchema` nhánh `da_sinh` | thiếu `beNgaySinh` → lỗi; có `thaiTuan` → lỗi; ngày sinh tương lai → lỗi; quá 36 tháng → lỗi |
| `chuDeQuanTam` | mảng rỗng → lỗi; giá trị lạ → lỗi; nhiều giá trị hợp lệ → pass |
| `nguonBietDen` | giá trị lạ → lỗi |
| `rowsToSheet` | 21 cột đúng thứ tự; mẹ mang thai để trống ô bé; chủ đề nối chuỗi |
| `waitlistSchema` | không đổi — test hồi quy để chắc |

Không viết test cho UI form (repo chưa có hạ tầng test component; ngoài phạm vi).

## Việc tay bắt buộc — không code nào thay được

1. **Chạy SQL migration** trong Supabase console (cả `registrations` và `waitlist`).
2. **Tạo attribute mới trong Brevo dashboard**: `THAI_TUAN`, `TEN_BE`, `BE_NGAY_SINH`, `BE_GIOI_TINH`, `CHU_DE_QUAN_TAM`, `NGUON_BIET_DEN`. **Brevo từ chối attribute chưa khai báo** — bỏ bước này là email xác nhận gãy, và `upsertContact` ném lỗi khiến đăng ký trả 502.
3. **Xoá header cũ trong Google Sheet đích** (15 cột → 21 cột).

Ba bước này phải xong **trước** khi deploy, không phải sau.

## Rủi ro

**Lịch.** Hôm nay 20/07, mở đăng ký 25/07 — còn 5 ngày. Việc này đụng 9 file + 2 hệ thống ngoài. Không còn chỗ cho vòng đổi field lớn; danh sách field coi như chốt cứng từ đây.

**Thứ tự deploy.** Code mới + DB cũ = mọi lượt đăng ký hỏng. Migration phải chạy trước khi deploy. Vì chưa mở đăng ký nên cửa sổ hỏng này không ảnh hưởng người thật, miễn là làm xong trước 25/07.

**Brevo `updateEnabled: true`.** Mẹ đã ở waitlist rồi đăng ký sự kiện phải thành MỘT contact giàu hơn (`brevo.ts:48-56`). Logic "chỉ gửi attribute khi có nghĩa" giữ đúng tính chất này — phải kiểm lại sau khi thêm 6 attribute mới.

## Ngoài phạm vi

- Mirror waitlist sang Google Sheets (user bỏ)
- Poll tự động cho tab waitlist (user bỏ)
- Xoá/sửa dòng waitlist từ admin
- Test component cho form
- Sửa chỗ nav trang chủ hiện "Mama Ơi Day" hai lần (`Header.tsx:31-34`) — lỗi UI riêng, không liên quan
