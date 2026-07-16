# Trang admin: export Excel, popup chi tiết + QR, tự làm mới — Design

**Ngày:** 2026-07-16
**Trạng thái:** đã duyệt (user duyệt 2026-07-16)
**Nền tảng:** tiếp nối `2026-07-16-checkin-qr-admin-design.md` (Task 1-10 đã xong, đã merge `main`)

## Mục tiêu

Thêm ba tính năng cho `/admin` để dùng được thật ở quầy check-in ngày 30/08/2026:

1. Export danh sách đăng ký ra file `.xlsx`.
2. Bấm vào họ tên → popup đầy đủ thông tin + QR check-in.
3. Danh sách tự làm mới mỗi 5 giây.

## Ràng buộc kiến trúc (quyết định nền, không được vi phạm)

**Không một khoá Supabase nào được lọt vào client.** `src/lib/supabase.ts` ghi rõ: *"Accessed server-side only, with the service role key — clients never touch Supabase, so no RLS is needed."* RLS đang TẮT theo spec §4 (quyết định của user, đã ghi nhận). Hệ quả: bất kỳ khoá Supabase nào ở client đồng nghĩa toàn bộ bảng `registrations` — họ tên, email, SĐT, Facebook, tình trạng mang thai của 500 bà mẹ — thành công khai. Biến `NEXT_PUBLIC_*` bị nhúng vào bundle của **mọi** trang, không riêng `/admin`, nên rò rỉ sẽ ở phạm vi toàn site.

### Quyết định: KHÔNG dùng Supabase Realtime

User đề xuất "realtime thì càng tốt". **Đã bác bỏ**, vì Realtime yêu cầu trình duyệt nối thẳng tới Supabase bằng một khoá client — vi phạm trực tiếp ràng buộc trên. Ba phương án đã cân nhắc:

| Phương án | Vì sao loại |
|---|---|
| Realtime trực tiếp từ browser | Cần khoá ở client + RLS đang tắt → lộ toàn bộ PII. Muốn làm phải bật RLS + viết policy + Supabase Auth cho admin: đảo ngược spec §4, việc lớn, sai một bước là lộ hết. |
| Realtime qua SSE (server trung gian) | Giữ được khoá ở server, nhưng Vercel serverless giới hạn thời gian chạy hàm → kết nối dài bị ngắt. Phức tạp, dễ vỡ trong production. |
| **Poll 5s qua API sẵn có** | **ĐÃ CHỌN.** Khoá ở nguyên server, RLS không đổi, 0 dependency mới, tái dùng endpoint đã có và đã chặn 401. |

Độ trễ tối đa 5s là chấp nhận được cho quầy check-in. Tải: ~500 dòng mỗi 5s cho vài máy — không đáng kể.

## Tính năng 1 — Tự làm mới mỗi 5s

`useEffect` trong `AdminDashboard` đặt `setInterval` gọi `refresh()` (đã có sẵn) mỗi 5000ms.

**Bốn quy tắc bắt buộc:**

1. **Bỏ qua nhịp poll khi đang ghi** (`busy !== null`). Nếu không, phản hồi poll có thể ghi đè kết quả `update()` vừa xong → nút tick nhảy ngược về trạng thái cũ.
2. **Dừng khi tab ẩn** (`document.hidden`), chạy lại khi hiện. Máy tính bảng ở quầy không gọi API khi nằm trong túi.
3. **Gặp 401 → dừng interval và `router.replace("/admin/login")`.** Không có bước này, phiên hết hạn sẽ đẻ vòng lặp 401 vô tận mỗi 5s.
4. **Dọn interval khi unmount** (`clearInterval` trong hàm cleanup).

**Không làm hỏng thao tác đang gõ:** ô sửa giờ dùng `defaultValue` (uncontrolled) và `key={r.id}` giữ nguyên, nên re-render từ poll không reset giá trị đang gõ. **Phải kiểm chứng bằng thao tác thật trong trình duyệt**, không được kết luận từ lý thuyết.

## Tính năng 2 — Export `.xlsx`

Thêm dependency `exceljs`. (Không dùng `xlsx` của npm: bản npm đã lỗi thời và dính CVE; SheetJS đã chuyển sang tự phát hành.)

**Luồng:** nút "Xuất Excel" cạnh "Làm mới" → `POST /api/admin/export` với body `{ ids: string[] }` là id của **các dòng đang hiển thị sau khi lọc** → server đọc lại các dòng đó từ DB → trả `.xlsx`.

**Vì sao gửi `ids`:**
- *Không* gửi chuỗi tìm kiếm `q` để server tự lọc: logic lọc sẽ tồn tại ở hai nơi và trôi lệch nhau.
- *Không* gửi thẳng dữ liệu dòng: server sẽ phải tin dữ liệu client khai.
- Gửi `ids` giữ **một nguồn lọc duy nhất** (client) và **một nguồn dữ liệu duy nhất** (DB).

**Phạm vi export:** đúng danh sách đang hiển thị (WYSIWYG). Không lọc → xuất tất cả.

**Tách logic thuần để test:** `src/lib/export-rows.ts` xuất `rowsToSheet(rows: RegistrationRow[]): { headers: string[]; rows: (string|number|null)[][] }`. Đây là chỗ dễ sai nhất (map 15 cột — `RegistrationRow` trừ `id`; dịch `mang_thai`→"Mang thai", `da_sinh`→"Đã sinh"; giờ UTC→giờ VN). `exceljs` chỉ nhận kết quả và lo định dạng — không test `exceljs`.

**Tên file:** `mamaoi-day-checkin-YYYY-MM-DD.xlsx` (ngày giờ VN).

## Tính năng 3 — Popup chi tiết + QR

Component mới `src/components/AdminDetailModal.tsx`. **Không nhét vào `AdminDashboard`**: file đó đã ~160 dòng; cộng cả ba tính năng vào sẽ thành file không đọc nổi và khó sửa.

**Ranh giới:** `AdminDashboard` sở hữu toàn bộ state (rows, busy, filter) và truyền xuống `row: RegistrationRow | null` + các callback (`onClose`, `onToggle`, `onEditTime`). Modal không tự fetch dữ liệu, không tự giữ bản sao dòng — nó là hàm hiển thị thuần của `row`. Nhờ vậy tick trong modal và tick trên bảng đi qua đúng một đường code.

**Kích hoạt:** bấm vào ô họ tên (`<button>`, không phải `<div onClick>`, để dùng được bàn phím).

**Nội dung:** 15 trường — toàn bộ `RegistrationRow` (16) trừ `id` (khoá nội bộ, vô nghĩa với người dùng). Trình bày nhóm: thông tin mẹ (họ tên, email, SĐT, Facebook, tỉnh/thành) — tình trạng (mang thai / đã sinh + tháng tuổi, đi cùng chồng, đồng ý nhận tin) — đăng ký (mã, nguồn, thời điểm) — check-in (trạng thái, giờ, nguồn `qr`/`admin`).

**Hành động trong popup:** tick check-in + sửa giờ (dùng chung callback với bảng). Lý do: nhân viên mở popup để đối chiếu tên/SĐT rồi tick luôn, không phải đóng popup đi mò lại đúng dòng.

**QR:** `GET /api/admin/qr?code=MO-XXXXXX` trả PNG (`Content-Type: image/png`), có `isAdmin()` guard, 401 nếu chưa đăng nhập. Modal chỉ `<img src="/api/admin/qr?code=..." />`.
- Sinh ở server, không ở browser: tái dùng đúng `qrcode` server đã có, không phình bundle, không rủi ro bundle `qrcode` cho browser.
- QR hiển thị TO + mã chữ to bên dưới — mục đích là mẹ mất email thì admin tra tên, mở popup, chìa QR ra cho quét.
- Route phải validate `code` bằng `isValidCheckinCode` trước khi sinh (tránh sinh QR cho rác).

**Đóng modal:** phím Escape, bấm nền, nút X. `role="dialog"`, `aria-modal="true"`.

## Cải thiện đi kèm — `checkinUrl(code)` dùng chung

Hiện `brevo.ts:162-163` ghép URL check-in tay:
```ts
const base = process.env.NEXT_PUBLIC_SITE_URL ?? SITE.url;
const checkinUrl = `${base}/check-in/${checkinCode}`;
```
Route QR mới sẽ cần đúng URL đó. Ghép lại lần hai ở nơi khác là mầm mống lỗi: hai chỗ trôi lệch → **QR trong email và QR trên màn hình admin trỏ đi hai nơi khác nhau**, lỗi rất khó phát hiện vì cả hai đều "trông có vẻ đúng".

Tách `src/lib/checkin-url.ts`:
```ts
export function checkinUrl(code: string): string
```
`brevo.ts` và `api/admin/qr/route.ts` cùng gọi. Có test.

Đây là sửa đổi có chủ đích phục vụ việc đang làm, không phải refactor lan man.

## Xử lý lỗi

| Tình huống | Hành vi |
|---|---|
| Poll gặp 401 | Dừng interval, `router.replace("/admin/login")` |
| Poll lỗi mạng | Bỏ qua nhịp đó, giữ dữ liệu cũ, không hiện lỗi (poll là nền, không được làm phiền) |
| Export lỗi | Hiện thông báo lỗi cạnh nút, không làm hỏng bảng |
| Export khi danh sách rỗng | Vô hiệu hoá nút |
| QR: code sai định dạng | Route trả 400 |
| QR: chưa đăng nhập | Route trả 401 |
| Modal: dòng bị xoá khỏi rows sau poll | Đóng modal |

## Kiểm thử

**Unit test (vitest), chỉ cho logic thuần:**
- `checkinUrl()`: dùng `NEXT_PUBLIC_SITE_URL` khi có; fallback `SITE.url` khi không; ghép đúng `/check-in/<code>`.
- `rowsToSheet()`: đúng 15 header (không có `id`); dịch `mang_thai`/`da_sinh`; `be_thang_tuoi` null → rỗng; boolean → "Có"/"—"; giờ ISO → giờ VN; dòng chưa check-in → cột giờ rỗng.

**Không unit-test:** `exceljs`, poll, modal — verify bằng trình duyệt thật.

**Verify trình duyệt (bắt buộc, không được bỏ):**
- Poll: mở 2 tab, check-in ở tab A → tab B tự cập nhật trong ≤5s mà không bấm gì.
- Poll không phá thao tác: đang gõ sửa giờ → qua 5s chữ đang gõ còn nguyên.
- Poll dừng khi hết phiên: xoá cookie → bị đá về `/admin/login`, không lặp 401.
- Export: lọc theo tên → bấm xuất → file mở bằng Excel, **dấu tiếng Việt đúng**, chỉ chứa các dòng đã lọc.
- Popup: bấm tên → hiện đủ thông tin; QR quét được và ra đúng URL `/check-in/<mã>`; tick trong popup → bảng phía sau cập nhật theo; Escape đóng.

## Ngoài phạm vi (YAGNI)

- Sắp xếp / phân trang bảng.
- Export CSV (đã chọn `.xlsx`).
- Sửa các trường khác ngoài check-in.
- Xoá đăng ký.
- Nhiều tài khoản admin.

## File dự kiến

| Việc | File |
|---|---|
| Tạo | `src/components/AdminDetailModal.tsx` |
| Tạo | `src/app/api/admin/export/route.ts` |
| Tạo | `src/app/api/admin/qr/route.ts` |
| Tạo | `src/lib/checkin-url.ts` + `checkin-url.test.ts` |
| Tạo | `src/lib/export-rows.ts` + `export-rows.test.ts` |
| Sửa | `src/components/AdminDashboard.tsx` |
| Sửa | `src/lib/brevo.ts` |
| Sửa | `package.json` (+`exceljs`) |
