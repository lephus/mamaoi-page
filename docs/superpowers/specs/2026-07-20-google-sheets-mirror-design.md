# Mirror đăng ký sự kiện sang Google Sheets — Design

**Ngày:** 2026-07-20
**Trạng thái:** chờ user duyệt
**Nền tảng:** tiếp nối `2026-07-16-checkin-qr-admin-design.md` và `2026-07-16-admin-export-popup-poll-design.md` (đã merge `main`)

## Mục tiêu

Mỗi lượt đăng ký `/su-kien` ("Giữ chỗ cho mẹ và bé") append thêm một dòng vào Google Sheet, **đồng thời** với việc ghi vào Supabase. Ops mở link Sheet là thấy dữ liệu mới nhất, không cần đăng nhập `/admin`.

`CLAUDE.md` đã mô tả luồng này ("Google Sheets — append a mirror row for the ops team") và `.env.local` đã có sẵn `GOOGLE_SHEET_ID` / `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY`, nhưng **code chưa từng được viết**. Spec này lấp đúng khoảng trống đó.

## Hiện trạng (đã kiểm tra 2026-07-20)

`POST /api/dang-ky` chạy đúng thứ tự sau, test suite 22/22 pass:

| Bước | Thất bại thì sao |
|---|---|
| Validate Zod + honeypot + reCAPTCHA | 400, kèm `fieldErrors` |
| Brevo upsert contact | **502 — đăng ký KHÔNG thành công** |
| Gửi email xác nhận + QR | `warnings: ["email"]` |
| Supabase upsert `registrations` (chỉ `su-kien`) | `warnings: ["supabase"]` |

`/admin` đã có nút "Xuất Excel (n)" → `POST /api/admin/export` → sinh `.xlsx` 15 cột bằng exceljs. **Chức năng này giữ nguyên, không đụng tới.**

## Phạm vi

**Trong phạm vi:** đăng ký sự kiện (`nguon: "su-kien"`).

**Ngoài phạm vi:** waitlist app (`nguon: "app-waitlist"`). Form đó chỉ có email + đồng ý nhận tin, hiện chỉ nằm ở Brevo, cấu trúc dữ liệu khác hẳn — nhét chung một sheet sẽ tạo ra hàng loạt cột rỗng. Nếu sau này cần, làm sheet riêng ở spec riêng.

## Quyết định 1 — Cơ chế ghi: append thuần túy

Supabase upsert theo `email` nên mỗi mẹ chỉ có **một** dòng. Google Sheet thì không có ràng buộc đó, phải chọn.

| Phương án | Kết luận |
|---|---|
| **Append thuần túy** | **ĐÃ CHỌN (user chọn 2026-07-20).** Mỗi submit thêm 1 dòng, không bao giờ sửa. Ít code nhất, ít rủi ro nhất, không cần đọc sheet trước khi ghi. |
| Append + nút "Đồng bộ Sheet" ở `/admin` | Loại. Dọn được trùng lặp và kéo được trạng thái check-in lên, nhưng thêm route + nút + logic ghi đè cho một nhu cầu mà `/admin` đã phục vụ. |
| Luôn ghi đè toàn bộ sheet | Loại. Sheet luôn khớp 100%, nhưng ngày 30/08/2026 có ~500 lượt check-in dồn trong vài tiếng, mỗi lượt ghi đè 500 dòng → nguy cơ chạm quota Google Sheets API đúng lúc đông người nhất. |

**Hai hệ quả phải chấp nhận, đã trao đổi với user:**

1. Mẹ submit hai lần → Sheet có hai dòng trùng, vĩnh viễn. Supabase vẫn đúng một dòng.
2. **Ba cột check-in trong Sheet luôn trống.** Sheet không bao giờ biết ai đã đến sự kiện.

Do đó: **Sheet là nhật ký thô để xem nhanh, không phải nguồn số liệu chính thức.** Muốn con số chính xác — số lượng thật, ai đã check-in — vào `/admin` bấm "Xuất Excel". Nội dung này phải được ghi ngay ở dòng đầu tiên của Sheet (xem "Dòng ghi chú" bên dưới) để ops không đếm nhầm.

## Quyết định 2 — Supabase và Sheets chạy độc lập

Hai nhánh mirror **không** phụ thuộc nhau: Sheets không chờ Supabase thành công mới ghi.

Phương án còn lại là nối tiếp — `insertRegistration` trả về `RegistrationRow` rồi đưa thẳng sang Sheets, được `id` và `created_at` thật từ DB. Nhưng như thế Supabase sập kéo theo mất luôn dòng Sheet, đúng lúc bản mirror thứ hai có giá trị nhất. Lý do tồn tại của mirror thứ hai là dự phòng; nối tiếp thì nó không còn dự phòng cho gì cả.

Cái giá: `created_at` trong Sheet là thời điểm server dựng dòng, lệch vài mili-giây so với `created_at` của Postgres. Không ai quan tâm.

## Quyết định 3 — Tự ký JWT, không cài `googleapis`

| Phương án | Kết luận |
|---|---|
| **Tự ký JWT RS256 bằng Web Crypto + `fetch`** | **ĐÃ CHỌN.** ~60 dòng, **0 dependency mới**. Codebase đang gọi Brevo REST và reCAPTCHA đúng theo kiểu này (`src/app/api/dang-ky/route.ts:18`, `src/lib/brevo.ts`). |
| Cài `googleapis` | Loại. ~80MB trong `node_modules`, kéo theo rất nhiều thứ, cho đúng một lần gọi API. |
| Cài `google-auth-library` | Loại. Nhẹ hơn `googleapis` nhưng vẫn là một dependency mới để thay thế 60 dòng code không có gì bí ẩn. |

Web Crypto (`crypto.subtle`) có sẵn toàn cục trên Node 18+ và trên Vercel. `validation.ts:104` đã dùng `crypto.getRandomValues` theo cùng cách.

## Module mới: `src/lib/sheets.ts`

Cùng khuôn với `src/lib/supabase.ts` đang có.

```ts
export function sheetsConfigured(): boolean
export function registrationToSheetRow(data: Registration, code: string): (string | number)[]
export async function appendRegistration(data: Registration, code: string): Promise<void>
```

### `registrationToSheetRow` — hàm thuần, là phần được test

Dựng một `RegistrationRow` từ `Registration` + mã check-in, rồi **gọi lại `rowsToSheet` của `export-rows.ts`** để lấy dòng ô.

Không tự viết mảng cột mới. Thứ tự cột phải tồn tại đúng **một** chỗ — `HEADERS` trong `export-rows.ts` — nếu không, Sheet và file `.xlsx` sẽ trôi lệch khỏi nhau ngay lần đầu ai đó thêm cột.

Các trường Sheet không thể biết được điền như sau:

| Trường | Giá trị | Vì sao |
|---|---|---|
| `id` | `""` | `rowsToSheet` không xuất `id`, giá trị này không bao giờ được đọc |
| `created_at` | `new Date().toISOString()` | Quyết định 2 |
| `checked_in` | `false` | Quyết định 1 — Sheet không theo dõi check-in |
| `checked_in_at` | `null` | như trên |
| `checked_in_source` | `null` | như trên |

### Xác thực

1. Đọc `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEET_ID`.
2. `GOOGLE_PRIVATE_KEY` phải `.replace(/\\n/g, "\n")` — biến môi trường trên Vercel lưu xuống dòng dưới dạng `\n` hai ký tự, không thay thế thì `importKey` ném lỗi.
3. Bóc PEM header/footer → base64 decode → `crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"])`.
4. Ký claim set: `iss` = client email, `scope` = `https://www.googleapis.com/auth/spreadsheets`, `aud` = `https://oauth2.googleapis.com/token`, `iat` = giờ hiện tại, `exp` = +3600s.
5. `POST https://oauth2.googleapis.com/token` với `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer` + `assertion=<JWT>`.
6. **Cache access token ở cấp module đến `exp - 60s`.** Không cache thì mỗi lượt đăng ký tốn hai request thay vì một.

### Gọi API append

```
POST https://sheets.googleapis.com/v4/spreadsheets/{GOOGLE_SHEET_ID}/values/A1:append
     ?valueInputOption=RAW&insertDataOption=INSERT_ROWS
body: { "values": [[ ...15 ô... ]] }
```

**`valueInputOption=RAW` là bắt buộc, không được đổi sang `USER_ENTERED`.** RAW lưu nguyên văn, không parse. Hai lý do:

1. **Chặn formula injection.** Mẹ nhập họ tên `=IMPORTXML(...)` — với `USER_ENTERED` Sheets sẽ chạy nó như công thức. Đây là ô nhập tự do từ internet công cộng, phải coi là dữ liệu thù địch.
2. **Giữ số 0 đầu số điện thoại.** `USER_ENTERED` biến `"0901234567"` thành số `901234567`.

Range `A1` (không kèm tên sheet) trỏ tới sheet đầu tiên — không phải encode tên sheet tiếng Việt trong URL.

### Dòng header + dòng ghi chú

Kiểm tra một lần cho mỗi tiến trình server: `GET .../values/A1`. Nếu rỗng, ghi trước hai dòng:

1. Dòng ghi chú (một ô, cột A): `⚠ Bản ghi thô, tự động — có thể có dòng trùng và KHÔNG có trạng thái check-in. Số liệu chính thức: /admin → Xuất Excel.`
2. Dòng header 15 cột, lấy từ `rowsToSheet([]).headers`.

Kết quả cache vào biến cấp module (`headerEnsured`), nên chỉ tốn thêm một request vào lần đăng ký đầu tiên sau mỗi lần cold start, không phải mỗi lượt.

### Timeout

Mọi `fetch` trong module dùng `AbortSignal.timeout(10_000)`. Mẹ đang chờ response — một cuộc gọi Google treo không được phép giữ hàm serverless đến hết hạn mức.

Non-2xx thì `throw new Error` kèm status và đoạn đầu body, để log của route có cái mà đọc.

## Đấu nối vào `POST /api/dang-ky`

Thêm một khối sau khối Supabase, **cùng khuôn**, và nằm sau bình luận sẵn có *"Past this point she IS registered. Nothing below may fail her request."*

```ts
if (isRegistration(data) && sheetsConfigured()) {
  try {
    await appendRegistration(data, checkinCode!);
  } catch (err) {
    console.error("[dang-ky] Sheets append failed:", data.email, err);
    warnings.push("sheets");
  }
}
```

**Không có nhánh nào ở đây được phép làm hỏng đăng ký của mẹ.** Brevo đã giữ contact; mất một dòng Sheet là chuyện của ops, không phải chuyện của người vừa điền form.

`sheetsConfigured()` sai → bỏ qua hoàn toàn, y hệt cách `supabaseConfigured()` đang hoạt động. Dev không có credentials Google vẫn chạy được `npm run dev`.

## Kiểm thử

**Unit test `src/lib/sheets.test.ts`** — chỉ test `registrationToSheetRow`, theo mẫu `export-rows.test.ts`:

- dòng có đúng 15 ô, khớp `rowsToSheet([]).headers.length`
- mẹ mang thai → `"Mang thai"`, cột tháng tuổi rỗng
- mẹ đã sinh 6 tháng → `"Đã sinh"`, cột tháng tuổi bằng `6`
- không có Facebook → `""`, không phải `null` hay chuỗi `"null"`
- `diCungChong: false` → `"—"`
- ba cột check-in rỗng (khẳng định Quyết định 1 bằng test, không chỉ bằng lời)
- mã check-in xuất hiện đúng cột `"Mã check-in"`

Phần ký JWT và gọi mạng giữ thật mỏng, **không test** — mock cả tầng HTTP của Google chỉ chứng minh được rằng mock hoạt động.

**Verify thật, bắt buộc trước khi coi là xong:** `npm run dev` → submit form trên `/su-kien` → dòng phải xuất hiện trong Sheet, số điện thoại giữ nguyên số 0 đầu.

## Cấu hình

`.env.example` hiện **thiếu** cả ba biến `GOOGLE_*` dù `.env.local` đã có. Bổ sung kèm ghi chú:

```
# --- Google Sheets (ban ghi tho cho ops; bo trong = bo qua) ---
GOOGLE_SHEET_ID=                # ID trong URL cua Sheet
GOOGLE_CLIENT_EMAIL=            # service account, vd: xxx@yyy.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=             # private key PEM, giu nguyen \n
```

**Việc thủ công của user:** share Google Sheet cho địa chỉ trong `GOOGLE_CLIENT_EMAIL` với quyền **Editor**. Không share thì mọi lần append trả 403 và log sẽ đầy `warnings: ["sheets"]`.

`.gitignore` đã chặn sẵn `mamaoi-*.json` và `service-account*.json`, không cần đổi.

## Những gì spec này KHÔNG làm

- Không đụng vào Brevo, email, QR, `/check-in`, `/admin`, nút "Xuất Excel"
- Không đưa waitlist app vào Sheet
- Không đưa trạng thái check-in vào Sheet
- Không dọn dòng trùng trong Sheet
- Không thêm dependency nào
