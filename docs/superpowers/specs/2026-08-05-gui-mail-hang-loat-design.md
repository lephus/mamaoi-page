# Thiết kế: Gửi email hàng loạt cho mẹ đăng ký sự kiện

- **Ngày:** 2026-08-05
- **Trạng thái:** Đã chốt thiết kế, chờ review spec trước khi lập kế hoạch code
- **Phạm vi:** Trang `/admin/gui-mail-hang-loat` cho admin tự gõ tiêu đề + nội dung, tick chọn mẹ nhận, xem trước, gửi thử, rồi gửi thật qua API giao dịch của Brevo.
- **Hạn:** Nên chạy được trước ngày sự kiện **30/08/2026** — công dụng chính là báo tin gấp cho 500 mẹ đã đăng ký.

---

## 1. Bối cảnh & khoảng trống

Yêu cầu gốc: cho admin **tự gõ nội dung** subject + content rồi gửi hàng loạt cho người dùng trong hệ thống, dùng Brevo đã cấu hình sẵn.

**Cái đã có, dùng lại được:**

| Đã có | Ở đâu |
|---|---|
| `BREVO_API_KEY` + hàm `brevo(path, body)` gọi REST API | `src/lib/brevo.ts:8-29` |
| `shell(inner, footnote, kyTen)` — khung email thương hiệu | `src/lib/brevo.ts:193` (private, sẽ export) |
| `escapeHtml(s)` | `src/lib/brevo.ts:177` (private, sẽ export) |
| Hằng `P`, `KY_TEN_BTC`, `FOOTNOTE_BTC` | `src/lib/brevo.ts:272-275` (private, sẽ export) |
| `listRegistrations()` | `src/lib/supabase.ts:207` |
| Gác đăng nhập `isAdmin()`, cookie 12 giờ | `src/lib/admin-auth.ts` |
| `boDau()` cho ô tìm kiếm bỏ dấu | `src/lib/text.ts` |

**Cái KHÔNG dùng lại được — và đây là lý do tính năng này cần đường gửi mới:**

Hàm `send()` hiện tại (`brevo.ts:209`) gửi qua **SMTP relay của nodemailer**, mỗi lần một email, tuần tự. Với 500 mẹ đó là 500 lượt bắt tay SMTP — không sống nổi trong giới hạn thời gian một hàm trên Vercel. Tính năng này chuyển sang **API giao dịch của Brevo với `messageVersions`**: một lượt gọi HTTP mang tối đa 1000 bản riêng.

**`/admin/gui-mail` hiện có là tính năng KHÁC.** Nó gửi **mẫu cố định đã duyệt câu chữ** cho **một** mẹ theo mã, kèm QR đính kèm. Trang mới gửi **nội dung gõ tay** cho **hàng trăm** mẹ, không kèm QR. Hai mức rủi ro khác hẳn nhau — gộp chung một màn hình là sớm muộn có người bấm nhầm nút.

## 2. Quyết định đã chốt

| # | Quyết định | Lựa chọn | Lý do |
|---|---|---|---|
| 1 | Đối tượng | **Chỉ mẹ đăng ký sự kiện** (bảng `registrations`) | Waitlist app là nhóm khác hẳn, cần nội dung khác. Ngoài phạm vi. |
| 2 | Chọn người nhận | **Checkbox từng dòng**, có "Chọn tất cả đang hiện" | Admin quyết từng người, không có luật ngầm nào. Khớp tiền lệ nút "Xuất Excel" ở `/admin` (xuất đúng dòng đang hiển thị). |
| 3 | Mặc định tick | **Không tick sẵn ai** | Gửi luôn là hành động có chủ ý, không bao giờ là mặc định. |
| 4 | Cờ `dong_y_nhan_tin` | **Hiện thành một cột**, không tự động lọc | Admin thấy được lúc đang quyết. Xem §8. |
| 5 | Ô nội dung | **Chữ thường**, tự bọc `shell()`, có `{{ten}}` và `{{ma}}` | HTML thô sai một thẻ là 500 email vỡ layout, và không gì đảm bảo chân trang còn ở đó. |
| 6 | Đường gửi | **`POST /v3/smtp/email` + `messageVersions`** | Một lượt gọi cho 500 mẹ, mỗi mẹ một bản riêng. |
| 7 | Chắn trước khi gửi | **Xem trước + gửi thử + gõ số xác nhận** | Nội dung gõ tay không qua mắt ai trước khi tới 500 hộp thư là rủi ro không cần thiết. |
| 8 | Địa chỉ gửi thử | **Admin gõ tự do**, điền sẵn `ADMIN_EMAIL` | Xem §7 — có đánh đổi bảo mật, đã cân nhắc. |
| 9 | Lịch sử đã gửi | **Không lưu vào DB** | Brevo đã có nhật ký gửi. Bảng lịch sử là tính năng riêng. |

## 3. Kiến trúc

```
/admin/gui-mail-hang-loat  (server component, gác isAdmin)
   │
   ├─ DANH SÁCH 500 mẹ: checkbox · ô tìm kiếm (bỏ dấu) · cột "Đồng ý nhận tin"
   │    không tick sẵn ai
   │    [Chọn tất cả đang hiện] [Bỏ chọn tất cả]
   │    "Đã chọn N / 500"  ← luôn là TỔNG THẬT, không phải số đang lọc
   │
   ├─ Ô Tiêu đề          (được dùng {{ten}} {{ma}})
   ├─ Ô Nội dung         (chữ thường, xuống dòng thành đoạn)
   │
   ├─ [Xem trước]        POST che_do:"xem" + idMau  → HTML thật, KHÔNG gửi
   ├─ [Gửi thử]          POST che_do:"thu" + toiEmail → đúng 1 email
   │                     ô địa chỉ điền sẵn ADMIN_EMAIL, sửa được
   │
   └─ [Gửi thật]  gõ đúng số người nhận
                  POST che_do:"that" + ids[] + xacNhanSoLuong
                       │
                       ├─ đọc lại email từ Supabase theo ids (KHÔNG lấy từ client)
                       ├─ dựng messageVersions, chia lô 1000
                       └─ POST https://api.brevo.com/v3/smtp/email
                            → "Đã gửi N email"  |  lỗi thật
```

## 4. File mới

| File | Trách nhiệm | Phụ thuộc |
|---|---|---|
| `src/app/admin/gui-mail-hang-loat/page.tsx` | Server component. Gác `isAdmin()`, redirect `/admin/login`. Nạp `listRegistrations()`. Truyền `ADMIN_EMAIL` xuống làm giá trị điền sẵn. | `admin-auth`, `supabase` |
| `src/components/GuiMailHangLoatTool.tsx` | `"use client"`. Danh sách checkbox, ô soạn, xem trước, gửi thử, cổng xác nhận, mọi thông báo lỗi. | `text` (boDau), `mail-hang-loat` (chỉ type + hàm kiểm chỗ điền) |
| `src/lib/mail-hang-loat.ts` | **Hàm thuần**: dựng tiêu đề + HTML từ chữ admin gõ và một dòng đăng ký; phát hiện chỗ điền lạ. | `brevo` (shell, escapeHtml, P, KY_TEN_BTC, FOOTNOTE_BTC) |
| `src/app/api/admin/gui-mail-hang-loat/route.ts` | `POST` ba chế độ. Gọi Brevo. | `admin-auth`, `supabase`, `mail-hang-loat`, `brevo` |
| `src/lib/mail-hang-loat.test.ts` | Test hàm thuần. | — |
| `src/app/api/admin/gui-mail-hang-loat/route.test.ts` | Test route, theo mẫu `gui-mail/route.test.ts`. | — |

**Vì sao `mail-hang-loat.ts` tách riêng:** nó chứa toàn bộ phần có thể sai âm thầm — escape HTML, thay chỗ điền, cắt đoạn. Thuần nên test được đủ ca. Component `.tsx` thì không: `vitest.config.ts` chạy `environment: "node"` và chỉ nhận `src/**/*.test.ts`, jsdom chưa cài. Cùng lý do `ma-tu-qr.ts` được tách ra ở tính năng quét QR.

## 5. Thay đổi trên file có sẵn

| File | Thay đổi |
|---|---|
| `src/lib/brevo.ts` | Export `shell`, `escapeHtml`, `P`, `KY_TEN_BTC`, `FOOTNOTE_BTC`. **Chỉ đổi từ khoá `export`, không đổi một dòng logic nào** — email xác nhận đang chạy production không được nhúc nhích. |
| `src/components/AdminDashboard.tsx` | Thêm `<Link href="/admin/gui-mail-hang-loat">` vào cụm nút đầu trang. |

**Vì sao dùng lại `shell()` chứ không dựng khung mới:** email gửi hàng loạt phải trông **giống hệt** email mẹ đã nhận lúc đăng ký — cùng logo, cùng bo góc, cùng chân trang *"Bạn nhận được email này vì đã đăng ký tham dự Mama Ơi Day"*, cùng chữ ký BTC. Dựng khung thứ hai ở file mới là mầm mống hai email cùng thương hiệu mà trông khác nhau, và không ai phát hiện cho tới khi mẹ hỏi.

## 6. Dựng nội dung — thứ tự là vấn đề bảo mật

`src/lib/mail-hang-loat.ts` phơi ra ba thứ:

```ts
/** Các chỗ điền được phép. Khai một chỗ; UI và phần kiểm tra đều đọc từ đây. */
export const CHO_DIEN = ["ten", "ma"] as const;

/** Tìm chỗ điền KHÔNG hợp lệ trong chuỗi. Trả mảng token sai, rỗng nếu sạch. */
export function choDienLa(s: string): string[];

/** Chữ admin gõ + một dòng đăng ký → { tieuDe, html } đã sẵn sàng gửi. */
export function dungEmail(
  tieuDe: string,
  noiDung: string,
  row: Pick<RegistrationRow, "ho_ten" | "checkin_code">,
): { tieuDe: string; html: string };
```

**Thứ tự dựng HTML, sai thứ tự là lỗ hổng:**

1. **Escape chữ admin gõ TRƯỚC.** Quyết định #5 là không cho gõ HTML thô, nên `<b>đậm</b>` phải hiện ra đúng chữ đó chứ không thành chữ đậm — và `<script>` phải là chữ, không phải thẻ.
2. **Cắt đoạn.** Dòng trống ngăn đoạn → `<p ${P}>`, xuống dòng đơn → `<br>`. Dùng lại hằng `P` sẵn có nên cỡ chữ và giãn dòng khớp email đăng ký.
3. **Rồi mới thay chỗ điền**, bằng giá trị **đã escape**. `{{ten}}` không chứa ký tự đặc biệt nên nó sống sót nguyên vẹn qua bước 1; còn mẹ tên "Trần & Lê" thì dấu `&` được escape đúng.
4. Bọc kết quả vào `shell(inner, FOOTNOTE_BTC, KY_TEN_BTC)`.

**Tiêu đề đi đường khác:** cũng thay `{{ten}}` / `{{ma}}` nhưng **không escape**, vì tiêu đề email là chuỗi thường chứ không phải HTML. Escape ở đây sẽ làm mẹ nhận email tiêu đề "Chào chị Trần &amp; Lê".

**Chỗ điền lạ thì CHẶN, không gửi.** Gõ `{{name}}` thay vì `{{ten}}` bị từ chối kèm đúng tên token sai. Không chặn thì 500 mẹ nhận email mở đầu bằng *"Chào chị {{name}}"* — loại lỗi không ai sửa lại được sau khi email đã đi.

## 7. Hợp đồng của route

Một route, ba chế độ, phân biệt bằng **tham số bắt buộc khác nhau** chứ không chỉ bằng một cờ:

| `che_do` | Bắt buộc kèm | Làm gì |
|---|---|---|
| `"xem"` | `tieuDe`, `noiDung`, `idMau` | Dựng HTML từ một mẹ, **trả về, không gửi gì** |
| `"thu"` | `tieuDe`, `noiDung`, `toiEmail` | Gửi **đúng 1** email tới địa chỉ đó |
| `"that"` | `tieuDe`, `noiDung`, `ids[]`, `xacNhanSoLuong` | Gửi thật |

**Server từ chối nếu `xacNhanSoLuong !== ids.length`.** Nghĩa là một lượt `"thu"` không thể vô tình biến thành lượt bắn 500 email — muốn thế nó phải mang theo đủ 500 `ids` **và** đúng con số. Đó không còn là lỗi gõ nhầm một ký tự nữa.

**Địa chỉ người nhận thật đọc lại từ Supabase theo `ids`**, tuyệt đối không lấy từ client — cùng nguyên tắc `/api/admin/export` đang dùng (`AdminDashboard.tsx:216` gửi `ids`, server tự đọc lại).

**Chia lô 1000 mỗi lượt gọi Brevo.** Với sức chứa 500 hiện tại thì luôn đúng một lượt; vòng chia lô tồn tại chỉ để ngày nào đó `EVENT_CAPACITY` được nâng lên thì hệ thống **không âm thầm cắt bớt** người nhận.

**`export const maxDuration = 60;`** — một lượt gọi mang 500 bản riêng cần thời gian thật.

### Đánh đổi có chủ ý: địa chỉ gửi thử do admin gõ

`/admin/gui-mail` **cố tình không nhận email từ client**; doc của nó viết rõ lý do là *"nhận dữ liệu client khai là để client quyết định email bay đi đâu, và ở đây cái bay đi là một tấm vé vào cửa"* (`gui-mail/route.ts:10-13`). Chế độ `"thu"` ở đây mở lại đúng cửa đó: một phiên admin bị chiếm có thể gửi email bất kỳ, từ tên miền `mamaoi.vn`, tới địa chỉ bất kỳ.

Chấp nhận, vì đánh đổi khác hẳn: đây là **một** email, nội dung là thứ admin vừa gõ, và nó không phải vé vào cửa của ai. Đổi lại là thứ rất thật — mở email trong Gmail thật, trên điện thoại thật, hoặc gửi cho đồng nghiệp soát câu chữ trước khi 500 mẹ nhận.

Ba chốt chặn kèm theo:

- Ô nhập **điền sẵn `ADMIN_EMAIL`** nhưng sửa được — ca hay gặp nhất vẫn là một cú bấm.
- Chế độ `"thu"` chỉ nhận **đúng một** địa chỉ, không phải danh sách. Không biến được thành đường gửi hàng loạt lách qua cổng xác nhận.
- Server `console.log` địa chỉ mỗi lượt gửi thử, để có dấu vết nếu cần truy.
- Đường **gửi thật** vẫn tuyệt đối không nhận email từ client.

## 8. Giao diện danh sách

Cột: checkbox · Họ tên + mã · Email · Tỉnh/thành · **Đồng ý nhận tin**.

**Cờ `dong_y_nhan_tin` hiện thành cột, không tự động lọc.** Quyết định #2 là admin tự chọn từng người, nên cờ này không còn là bộ lọc. Nhưng nó vẫn là thông tin admin cần **nhìn thấy lúc đang quyết**, chứ không phải thứ bị giấu đi. CLAUDE.md nói cờ này chi phối mọi việc dùng dữ liệu về sau; thiết kế này để quyền quyết định ở người, và đặt thông tin ngay trước mắt người đó.

**Bẫy đếm số trong danh sách 500 dòng.** Lọc còn 10 mẹ rồi bấm "Chọn tất cả đang hiện" thì 10 mẹ đó được tick — nhưng những mẹ đã tick từ lượt lọc trước **vẫn còn tick**. Nên:

- nút ghi rõ chữ **"đang hiện"**;
- ô đếm luôn hiện **tổng thật** (`Đã chọn 137 / 500`), không phải số đang lọc;
- ô "gõ số để xác nhận" đối chiếu với đúng tổng thật đó.

**Xem trước dựng ở SERVER, không dựng lại ở client** — đúng nguyên tắc `/admin/gui-mail` đã ghi (`GuiMailTool.tsx:52-55`): dựng HTML ở hai nơi thì bản xem trước và bản gửi thật sẽ trôi lệch nhau, mà đó đúng là thứ ô xem trước sinh ra để chống.

**Xem trước dùng mẹ ĐẦU TIÊN đã chọn làm dữ liệu mẫu**, để `{{ten}}` hiện ra một cái tên thật chứ không phải chữ mẫu. Hệ quả: **chưa chọn ai thì nút "Xem trước" và "Gửi thử" đều tắt**, kèm dòng chữ nói rõ vì sao ("Chọn ít nhất một mẹ để xem trước"). Cố tình KHÔNG dùng dữ liệu bịa như `VI_DU` của `/admin/gui-mail`: ở đó bản mẫu tồn tại để đọc câu chữ của mẫu cố định khi chưa chọn ai, còn ở đây nội dung là do admin vừa gõ — cái admin cần thấy là email THẬT gửi cho một mẹ THẬT trong danh sách vừa tick, không phải một bản dựng bằng tên giả.

## 9. Xử lý lỗi

| Ca | Cách xử |
|---|---|
| Chưa chọn ai | Cả ba nút "Xem trước" / "Gửi thử" / "Gửi thật" đều tắt, kèm chữ giải thích |
| Thiếu tiêu đề hoặc thiếu nội dung | Nút "Gửi thử" và "Gửi thật" tắt |
| Chỗ điền lạ `{{xyz}}` | Chặn, báo đúng token sai |
| Gõ số xác nhận không khớp | Nút gửi tắt, hiện "cần gõ đúng 137" |
| `idMau` không có trong DB (xem trước) | 404, báo rõ |
| Brevo trả lỗi | Hiện **lỗi thật của Brevo**, không nuốt thành câu chung chung |
| **Mạng hỏng giữa lượt gửi thật** | Báo *"Không chắc đã gửi hay chưa — kiểm tra Brevo trước khi gửi lại"*. Đây là sự thật: request bay đi rồi thì client không biết Brevo đã nhận chưa. Nói "chưa gửi" là dụ admin bấm lại và 500 mẹ nhận hai lần |
| Một lô hỏng giữa chừng | Báo rõ đã xong mấy lô, còn mấy lô chưa |
| Phiên hết hạn | 401 → `/admin/login` |

**Gửi hỏng phải nổi thành lỗi thật, không bao giờ báo thành công giả** — cùng nguyên tắc `gui-mail/route.ts:94-95` đã ghi. Với gửi hàng loạt còn nặng hơn: báo "đã gửi" khi chưa gửi được nghĩa là không ai gửi lại, và 500 mẹ không biết sự kiện đổi địa điểm.

## 10. Kiểm thử

**`mail-hang-loat.test.ts`** (hàm thuần, test được đủ):

- chữ admin gõ được escape — `<script>alert(1)</script>` ra chữ, không ra thẻ;
- `{{ten}}` ra tên thật; tên chứa `&` được escape thành `&amp;`;
- `{{ma}}` ra mã check-in;
- dòng trống thành đoạn `<p>` mới; xuống dòng đơn thành `<br>`;
- `choDienLa` bắt được `{{name}}`, `{{}}`, `{{ ten }}`; trả rỗng khi chỉ có `{{ten}}` / `{{ma}}`;
- tiêu đề thay chỗ điền nhưng **không** escape;
- không có chỗ điền thì nội dung ra nguyên văn.

**`route.test.ts`** (theo mẫu `gui-mail/route.test.ts`):

- 401 khi chưa đăng nhập, và **không gọi Brevo**;
- 400 cho từng ca thiếu tham số theo từng chế độ;
- **`xacNhanSoLuong` lệch `ids.length` → 400 và KHÔNG gọi Brevo**;
- `"thu"` chỉ gửi đúng 1 email, không đọc `ids`;
- `"that"` đọc email từ DB và **bỏ qua email client khai**;
- `"xem"` không gửi gì;
- chỗ điền lạ → 400, không gọi Brevo;
- Brevo hỏng → 502, không báo thành công giả;
- 1500 ids → đúng 2 lượt gọi Brevo.

**Không unit test được:** giao diện `.tsx`. Kiểm bằng `npm run build` + **gửi thử vào hộp thư thật** rồi mở trên cả máy tính lẫn điện thoại, xác nhận khung email khớp với email đăng ký.

## 11. Ngoài phạm vi

- Waitlist app (bảng `waitlist`) — nhóm khác, nội dung khác, spec riêng nếu cần.
- Bảng lịch sử đã gửi trong DB (quyết định #9).
- Đính kèm file / QR riêng cho từng mẹ — `messageVersions` không cho đính kèm khác nhau theo từng bản; đường gửi QR riêng đã có ở `/admin/gui-mail`.
- Lên lịch gửi, gửi theo đợt hẹn giờ.
- Thống kê mở / click, link huỷ đăng ký tự động — đó là Campaign API, đã cân nhắc và loại (xem §1).
- Lọc phân khúc theo tỉnh/thành, tình trạng, đã check-in.
