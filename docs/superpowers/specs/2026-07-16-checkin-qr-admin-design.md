# Thiết kế: Check-in QR + Trang Admin (Supabase)

- **Ngày:** 2026-07-16
- **Trạng thái:** Đã chốt thiết kế, chờ review spec trước khi lập kế hoạch code
- **Phạm vi:** Thêm luồng check-in cho Mama Ơi Day (30/08/2026) + trang admin quản lý check-in; chuyển kho dữ liệu vận hành từ Google Sheets sang Supabase.

---

## 1. Bối cảnh & mục tiêu

Yêu cầu gốc: email xác nhận đăng ký sự kiện phải kèm **đường dẫn check-in + QR code**; có **trang check-in** dùng mã để xác nhận "check-in thành công lúc mấy giờ". Bổ sung sau đó: bỏ Google Sheets, làm **trang admin** đơn giản để theo dõi danh sách đăng ký, tick check-in thủ công và sửa giờ. Hạ tầng dữ liệu chuyển sang **Supabase** (project `MamaOiPage`, `https://ynebuselhjttlvbfpklb.supabase.co`).

Trạng thái hiện có trong repo (đã dùng lại, không làm lại):
- `generateCheckinCode()` sinh mã `MO-XXXXXX` (bảng chữ bỏ I/O/0/1 để đọc/gõ tay được) — `src/lib/validation.ts`.
- Đăng ký sự kiện đã sinh mã, lưu Brevo (`MA_CHECKIN`), đính kèm QR (đang encode **chuỗi mã trơn**), in mã dạng chữ trong email — `src/lib/brevo.ts`.
- Route `POST /api/dang-ky` đã điều phối Brevo (bắt buộc thành công) + Google Sheets (mirror, không bắt buộc).

Khoảng trống cần lấp: (1) QR chưa phải đường dẫn; (2) chưa có trang check-in; (3) chưa ghi lại thời điểm check-in; (4) chưa có trang admin; (5) còn phụ thuộc Google Sheets.

## 2. Quyết định đã chốt

| # | Quyết định | Lựa chọn |
|---|---|---|
| 1 | Ai check-in | **Cả hai**: mẹ/NV tự quét QR (luồng 1) + admin quản lý thủ công (luồng 2) |
| 2 | Kho dữ liệu vận hành | **Supabase** (Postgres). Bỏ hoàn toàn Google Sheets |
| 3 | Nguồn sự thật liên hệ/email | **Brevo** giữ nguyên (CRM + gửi email), vẫn bắt buộc thành công |
| 4 | Đăng nhập admin | **Env-cred + cookie httpOnly đã ký** (không dùng Supabase Auth) |
| 5 | Cổng thời gian cho `/check-in` | **Không** — cho check-in bất kỳ lúc nào nếu mã hợp lệ |
| 6 | Truy cập Supabase | **Server-side bằng service role key**; client không đụng thẳng Supabase (không cần RLS phức tạp) |

## 3. Kiến trúc tổng thể

```
Đăng ký sự kiện
   └─ POST /api/dang-ky
        ├─ Brevo upsert contact (BẮT BUỘC — nguồn sự thật, lỗi thì trả lỗi thật)
        ├─ Supabase upsert registrations (KHÔNG bắt buộc — log to nếu lỗi, back-fill sau)
        └─ Gửi email: QR = URL /check-in/<code>  +  nút đường dẫn  +  mã chữ

Check-in (2 luồng, cùng ghi vào Supabase — kho duy nhất cho check-in)
   Luồng 1 (QR):   mẹ/NV quét QR → /check-in/[code] (đọc) → bấm "Xác nhận" → POST /api/check-in (ghi)
   Luồng 2 (admin): /admin (đăng nhập) → tick "đã check-in" + sửa giờ → POST /api/admin/checkin (ghi)
```

Nguyên tắc: **Brevo = CRM/email; Supabase = bản ghi có cấu trúc + trạng thái check-in.** Mọi logic check-in chỉ đọc/ghi Supabase. `brevo.ts` gần như chỉ đổi nội dung QR trong email.

## 4. Mô hình dữ liệu — Supabase

Bảng `registrations` (chỉ chứa **đăng ký sự kiện**; waitlist app vẫn chỉ nằm ở Brevo vì không có gì để check-in):

```sql
create extension if not exists pgcrypto;

create table registrations (
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

create unique index registrations_checkin_code_key on registrations (checkin_code);
```

- **`email` unique + upsert on conflict** → một mẹ = một dòng, kể cả khi gửi form 2 lần. Khi trùng email: cập nhật thông tin hồ sơ + `checkin_code` mới (khớp với `MA_CHECKIN` mới bên Brevo), **nhưng KHÔNG đụng** `checked_in / checked_in_at / checked_in_source` (tránh xoá trạng thái đã check-in).
- **`checked_in_at` là `timestamptz`** (lưu theo UTC). Auto-fill khi tick = `now()`. Hiển thị/nhập tay quy ước theo **giờ VN (Asia/Ho_Chi_Minh)**: input `datetime-local` mang giờ VN → khi lưu diễn giải là giờ VN → đổi sang UTC; khi hiển thị đổi UTC → giờ VN.
- **`checked_in_source`**: `'qr'` (tự check-in) hoặc `'admin'` (admin tick).

RLS: bảng chỉ được truy cập server-side bằng **service role key** → không bật RLS cho client. (Nếu sau này cần client truy cập, mới thêm RLS.)

## 5. Luồng đăng ký (sửa đổi `POST /api/dang-ky`)

Thứ tự mới, giữ đúng triết lý brief ("Brevo là nguồn sự thật; kho phụ lỗi không được làm hỏng đăng ký"):

1. Validate + reCAPTCHA (không đổi).
2. Honeypot (không đổi).
3. Sinh `checkinCode` (chỉ khi là đăng ký sự kiện).
4. **Brevo `upsertContact` — BẮT BUỘC.** Lỗi → trả 502, không giả thành công.
5. **Supabase `insertRegistration` — KHÔNG bắt buộc.** Lỗi → `console.error` to + thêm `warnings.push("supabase")`, không làm hỏng đăng ký. (Mẹ vẫn nằm ở Brevo; ops back-fill trước sự kiện.)
6. Gửi email sự kiện (không bắt buộc, như hiện tại) — QR nay là URL.
7. Trả `{ ok: true, code, warnings }`.

> **Hệ quả đã biết:** check-in phụ thuộc dòng Supabase tồn tại. Nếu bước 5 lỗi, mẹ đó tạm thời không check-in được qua `/check-in` lẫn `/admin` cho tới khi back-fill. Chấp nhận được ở quy mô 500 và với độ tin cậy của Supabase; log to để phát hiện.

## 6. Luồng 1 — Trang tự check-in `/check-in/[code]`

**Nguyên tắc an toàn prefetch:** *mở trang = chỉ ĐỌC*; *bấm nút = mới GHI (POST)*. Trình quét link/prefetch của email client chỉ kích hoạt GET nên không bao giờ vô tình check-in.

| Thành phần | Vai trò |
|---|---|
| `src/app/check-in/[code]/page.tsx` | **Server component.** Query Supabase theo `checkin_code`. Render theo trạng thái (đọc, không ghi). |
| `src/components/CheckinConfirm.tsx` | **Client component.** Nút "Xác nhận check-in" → gọi API → hiển thị kết quả. |
| `src/app/api/check-in/route.ts` | **POST**, ghi check-in, idempotent. |

**Trạng thái hiển thị:**

| Tình huống | Hiển thị |
|---|---|
| Mã sai định dạng / không có trong DB | "Mã không hợp lệ hoặc không tìm thấy" |
| Hợp lệ, chưa check-in | Tên mẹ + nút "Xác nhận check-in" |
| Vừa check-in xong | ✓ "Check-in thành công lúc HH:MM — Chào chị [Tên]" |
| Đã check-in trước đó | "Mẹ đã check-in lúc HH:MM rồi" (giờ gốc, không ghi đè) |
| Supabase lỗi | "Hệ thống check-in tạm lỗi, vui lòng báo nhân viên" (không giả thành công) |

**`POST /api/check-in` (công khai; mã đóng vai trò "vé"):**
- Kiểm định dạng mã (`^MO-[2-9A-HJ-NP-Z]{6}$`). Sai → 400.
- Ghi nguyên tử, chống trùng ở DB:
  ```sql
  update registrations
     set checked_in = true, checked_in_at = now(), checked_in_source = 'qr'
   where checkin_code = $1 and checked_in = false
  returning checked_in_at, ho_ten;
  ```
  - Có dòng trả về → check-in mới thành công → `{ ok, alreadyCheckedIn: false, time, name }`.
  - Không có dòng → `select` phân biệt: tồn tại nhưng `checked_in=true` → `{ ok, alreadyCheckedIn: true, time gốc, name }`; không tồn tại → 404.
- Không cổng thời gian (theo quyết định #5).

## 7. Luồng 2 — Trang Admin `/admin`

### 7.1 Đăng nhập (env-cred + cookie)

- Thông tin đăng nhập đọc từ **biến môi trường** `ADMIN_EMAIL` / `ADMIN_PASSWORD` (giá trị do khách cung cấp riêng, đặt trong `.env.local` — gitignored), **không hardcode vào source, không ghi vào tài liệu commit**.
- `src/lib/admin-auth.ts`:
  - `verifyCredentials(email, password)` — so khớp **timing-safe** với env.
  - `signSession()` / `verifySession(token)` — token HMAC (`ADMIN_SESSION_SECRET`) kèm hạn dùng (~12h, đủ trọn ngày sự kiện).
  - `requireAdmin(request)` — guard dùng chung cho API admin.
- `src/middleware.ts` — chặn `/admin/**` (trừ `/admin/login`) và `/api/admin/**` (trừ `/api/admin/login`): thiếu/hỏng cookie → redirect `/admin/login` (trang) hoặc 401 (API).
  - *Lưu ý triển khai:* đọc `node_modules/next/dist/docs/` để dùng đúng API middleware của phiên bản Next trong repo (theo `AGENTS.md`).
- `POST /api/admin/login` → verify creds → set cookie httpOnly, `secure`, `sameSite=lax` → `{ ok }`. Sai → 401.
- `POST /api/admin/logout` → xoá cookie.
- `src/app/admin/login/page.tsx` + `src/components/AdminLogin.tsx` — form đăng nhập.

### 7.2 Bảng điều khiển

| Route/Component | Vai trò |
|---|---|
| `src/app/admin/page.tsx` | Server: (middleware đã chặn) fetch danh sách từ Supabase → render dashboard. |
| `src/components/AdminDashboard.tsx` | Client: bảng + tìm kiếm + tick + sửa giờ + làm mới. |
| `src/app/api/admin/registrations/route.ts` | **GET** (guarded) — danh sách từ Supabase. |
| `src/app/api/admin/checkin/route.ts` | **POST** (guarded) — cập nhật check-in/giờ 1 dòng. |

**Giao diện (tối giản, "nhanh & đơn giản"):**
- Bảng cột: Họ tên · SĐT · Tỉnh/thành · Tình trạng (mang thai / đã sinh + số tháng) · Đi cùng chồng · **Check-in?** · **Giờ check-in**.
- Ô **tìm kiếm** (lọc client theo tên/SĐT/mã).
- Dòng tổng: **"Đã check-in: X / Y"**.
- Mỗi dòng: **toggle check-in**. Khi bật → ô **giờ (`datetime-local`) tự fill giờ VN hiện tại, admin sửa tuỳ ý** → lưu. Cho phép **bỏ tick** (đặt `checked_in=false`, xoá giờ). Sửa giờ do admin → `checked_in_source='admin'`.
- Nút **"Làm mới"** → refetch (để thấy các ca tự check-in qua QR).

**`POST /api/admin/checkin`** nhận `{ id, checked_in, checked_in_at? }`:
- `checked_in=true`: set `checked_in=true`, `checked_in_at` = giờ admin gửi (hoặc `now()` nếu trống), `checked_in_source='admin'`.
- `checked_in=false`: set `checked_in=false`, `checked_in_at=null`, `checked_in_source=null`.

## 8. Thay đổi email/QR (`src/lib/brevo.ts`)

- Base URL: `process.env.NEXT_PUBLIC_SITE_URL ?? SITE.url` (mặc định `https://mamaoi.vn`).
- `checkinUrl = ${base}/check-in/${code}`.
- QR **encode `checkinUrl`** (thay vì chuỗi mã) → quét bằng camera là mở trang.
- Thêm **nút/đường dẫn "Check-in tại sự kiện"** (`checkinUrl`) trong thân email.
- **Giữ** mã dạng chữ + QR đính kèm (đề phòng máy quét lỗi, gõ tay / admin tra).

## 9. Gỡ bỏ Google Sheets

- **Xoá** `src/lib/sheets.ts`.
- Gỡ import + lời gọi Sheets trong `src/app/api/dang-ky/route.ts` (thay bằng Supabase ở mục 5).
- Gỡ env Google (`GOOGLE_SHEET_ID`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`) khỏi `.env.example`.
- Gỡ dependency `google-auth-library` khỏi `package.json`.

## 10. Biến môi trường

**Thêm:**
```
SUPABASE_URL=https://ynebuselhjttlvbfpklb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=       # service role (chỉ dùng server-side)
ADMIN_EMAIL=                     # email admin (khách cung cấp)
ADMIN_PASSWORD=                  # mật khẩu admin (khách cung cấp — chỉ đặt ở .env.local)
ADMIN_SESSION_SECRET=            # chuỗi ngẫu nhiên đủ dài để ký cookie
NEXT_PUBLIC_SITE_URL=https://mamaoi.vn   # base cho URL/QR check-in (tuỳ chọn, mặc định = SITE.url)
```
**Xoá:** `GOOGLE_SHEET_ID`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`.

**Dependency mới:** `@supabase/supabase-js`.

## 11. Xử lý lỗi & edge cases

- **Đăng ký 2 lần cùng email:** upsert → 1 dòng, cập nhật mã mới, giữ trạng thái check-in.
- **Quét cùng mã 2 lần:** update-có-điều-kiện ở DB đảm bảo chỉ 1 lần ghi giờ; lần sau trả giờ gốc.
- **Mã không tồn tại (Supabase insert từng lỗi):** `/check-in` báo "không tìm thấy"; admin tự tick tay ở `/admin` sau khi back-fill.
- **Supabase down khi đăng ký:** không làm hỏng đăng ký (mẹ vẫn ở Brevo); log to; `warnings`.
- **Supabase down khi check-in:** báo lỗi thật, không giả thành công.
- **Không cổng thời gian:** mẹ có thể tự check-in sớm từ nhà — chấp nhận theo quyết định #5; đường quét-tại-cửa của NV và trang admin vẫn là đường tin cậy; admin sửa/bỏ tick được.

## 12. Bảo mật

- Service role key **chỉ ở server** (API routes, server components); không lộ ra client.
- Mật khẩu admin trong env, so khớp timing-safe; cookie phiên **httpOnly + signed (HMAC) + hạn dùng**.
- `/admin/**` và `/api/admin/**` chặn ở middleware.
- `POST /api/check-in` công khai nhưng yêu cầu mã đúng định dạng; không gian mã ~1 tỷ tổ hợp nên dò mã bất khả thi. (Có thể thêm rate-limit nhẹ sau nếu cần — ngoài phạm vi.)
- Không log dữ liệu cá nhân (tên/email/SĐT) ra console ngoài mức cần cho back-fill.

## 13. Kiểm thử / verify

Repo hiện chưa có test runner. Ưu tiên:
- **Unit (nếu dựng nhanh được):** `generateCheckinCode` đúng định dạng; `signSession/verifySession` (ký + hết hạn + chống giả mạo); logic phân biệt "mới / đã check-in / không tồn tại".
- **E2E thủ công (skill `verify`/`run`):**
  1. Đăng ký thử → nhận email → QR mở đúng `/check-in/<code>`.
  2. Bấm "Xác nhận" → thấy giờ; tải lại → thấy "đã check-in lúc…"; không đổi giờ.
  3. `/admin`: sai mật khẩu → chặn; đúng → thấy danh sách; tick + sửa giờ → lưu; "Làm mới" thấy ca QR; bỏ tick hoạt động.
  4. Kiểm tra `warnings`/log khi tắt cấu hình Supabase.

## 14. Danh sách file

**Thêm mới**
- `src/lib/supabase.ts` — client service-role + `insertRegistration`, `findByCode`, `checkinByCode`, `listRegistrations`, `adminUpdateCheckin`.
- `src/lib/admin-auth.ts` — verify creds, ký/kiểm cookie, `requireAdmin`.
- `src/middleware.ts` — chặn `/admin/**` + `/api/admin/**`.
- `src/app/check-in/[code]/page.tsx`, `src/components/CheckinConfirm.tsx`, `src/app/api/check-in/route.ts`.
- `src/app/admin/page.tsx`, `src/app/admin/login/page.tsx`, `src/components/AdminDashboard.tsx`, `src/components/AdminLogin.tsx`.
- `src/app/api/admin/login/route.ts`, `src/app/api/admin/logout/route.ts`, `src/app/api/admin/registrations/route.ts`, `src/app/api/admin/checkin/route.ts`.

**Sửa**
- `src/lib/brevo.ts` — QR = URL + nút đường dẫn trong email.
- `src/app/api/dang-ky/route.ts` — bỏ Sheets, thêm Supabase.
- `.env.example`, `package.json`.

**Xoá**
- `src/lib/sheets.ts`.

**Ngoài repo (thao tác 1 lần)**
- Tạo bảng `registrations` trên Supabase (SQL mục 4) — làm qua Supabase MCP khi triển khai.
- Điền các env mới trên Vercel + `.env.local`.

## 15. Ngoài phạm vi

- Đồng bộ trạng thái "đã tham dự" ngược về Brevo (segmentation sau sự kiện).
- Realtime dashboard (dùng nút "Làm mới" là đủ).
- Rate-limit `/api/check-in`.
- Đa tài khoản admin / phân quyền.
- Xuất CSV từ admin.
