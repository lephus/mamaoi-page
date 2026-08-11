# Thiết kế: Đính kèm file + gửi thử nhiều địa chỉ cho email hàng loạt

- **Ngày:** 2026-08-11
- **Trạng thái:** Đã chốt thiết kế, chờ review spec trước khi lập kế hoạch code
- **Phạm vi:** Mở rộng `/admin/gui-mail-hang-loat` — cho admin đính kèm hình ảnh/file vào email gửi hàng loạt, và cho ô "Gửi thử tới" nhận nhiều địa chỉ.
- **Nền:** [Thiết kế gốc 2026-08-05](./2026-08-05-gui-mail-hang-loat-design.md). Spec này chỉ ghi phần THÊM và phần ĐỔI; mọi quyết định không nhắc tới ở đây vẫn giữ nguyên như spec gốc.

---

## 1. Yêu cầu

Nguyên văn: *"tính năng gửi email hàng loạt nên có thêm tính năng đính kèm hình ảnh, hoặc file và Gửi thử tới cho phép nhập nhiều email"*.

Hai việc độc lập nhau, gộp một spec vì cùng chạm đúng ba file và cùng đi qua một đường gửi.

## 2. Quyết định đã chốt

| # | Quyết định | Chọn | Lý do |
|---|---|---|---|
| 1 | Ảnh hiện ở đâu | **Chỉ đính kèm để tải về**, không hiện trong thân email | Không cần hạ tầng lưu trữ mới. Và đúng tiền lệ đã ghi ở `brevo.ts:239`: QR được đính kèm chứ không hot-link, *vì phần lớn email client chặn ảnh từ xa theo mặc định*. Ảnh chèn `<img src="https://…">` là ảnh nhiều mẹ sẽ thấy thành ô trống. |
| 2 | Số file & dung lượng | **Nhiều file, tổng ≤ 3MB** | Xem §4 — 3MB là trần cứng do nền tảng, không phải con số tuỳ chọn. |
| 3 | Đính kèm chung hay riêng từng mẹ | **Chung cho cả lô** | Bắt buộc: `messageVersions` của Brevo không cho đính kèm khác nhau theo từng bản. Spec gốc §11 đã loại "đính kèm riêng từng mẹ"; spec này KHÔNG mở lại điều đó. |
| 4 | Số địa chỉ gửi thử | **Không giới hạn** | Khách chọn, sau khi đã thấy rõ đánh đổi. Xem §6. |
| 5 | Đính kèm trong bản nháp cứu-401 | **Không cứu** | Xem §7. |
| 6 | Đính kèm và dải băng "bản xem trước đã CŨ" | **Không tính vào phép so** | Xem §7. |

## 3. Kiến trúc

```
Client (GuiMailHangLoatTool.tsx)
   │  <input type="file" multiple>  →  FileReader  →  base64
   │  kiểm NGAY tại client: đuôi file, tổng byte      ← phản hồi tức thì
   ▼
POST /api/admin/gui-mail-hang-loat
   {  che_do, tieuDe, noiDung,
      dinhKem:   [{ name, content }],     ← MỚI, dùng ở cả ba chế độ
      toiEmails: string[]                 ← ĐỔI, trước là toiEmail: string
   }
   │  kiểm LẠI ở server — đây mới là nơi quyết định
   ▼
guiHangLoat(ban, dinhKem)
   │
   ▼
POST https://api.brevo.com/v3/smtp/email
   {  sender, subject, htmlContent,
      attachment:      [{ name, content }],   ← CẤP GỐC: áp cho mọi bản
      messageVersions: [...]                  ← mỗi người nhận một bản riêng
   }
```

## 4. Đính kèm

### 4.1 File mới `src/lib/dinh-kem.ts`

Thuần, không gọi mạng, không đọc DB. **Tuyệt đối không import `brevo.ts`** — client phải import được file này để kiểm ngay lúc admin chọn file, mà `brevo.ts` là server-only. Đây đúng vai trò `cho-dien.ts` đang giữ so với `mail-hang-loat.ts` (spec gốc §4), giữ nguyên ranh giới đó.

```ts
/** Một file đính kèm. `content` là base64 THUẦN — đã bỏ tiền tố `data:…;base64,`. */
export type DinhKem = { name: string; content: string };

/** Đuôi file Brevo chấp nhận, thu hẹp về tập dùng thật. */
export const DUOI_CHO_PHEP: readonly string[];

export const TOI_DA_TONG_BYTE = 3 * 1024 * 1024;

/** Số byte THẬT của một chuỗi base64 (trừ ký tự đệm `=`). */
export function byteCuaBase64(content: string): number;

/** Kiểm cả danh sách. Trả câu lỗi tiếng Việt, hoặc null nếu sạch. */
export function loiDinhKem(ds: DinhKem[]): string | null;
```

### 4.2 Vì sao trần là 3MB

Trần cứng do nền tảng, không phải con số ai đó chọn cho đẹp:

- Vercel giới hạn body của một request tới serverless function ở **4.5MB**;
- base64 làm dữ liệu phồng **1.37 lần**;
- 3MB file thật ≈ 4.1MB base64, còn chừa chỗ cho tiêu đề, nội dung và danh sách id.

Vượt 3MB là request bị nền tảng chặn **trước khi** code của ta chạy — admin sẽ thấy một lỗi mạng vô nghĩa thay vì câu giải thích. Nên phải chặn ở client và ở route, cả hai đều **trước** ngưỡng đó.

### 4.3 Đuôi file — cái bẫy thật

Brevo từ chối đuôi lạ **ở thời điểm gửi**. Với chế độ "gửi thật" đó là lúc tệ nhất để phát hiện: admin đã gõ số xác nhận, đã bấm nút, và nhận về một lỗi 502.

Hai đuôi rất dễ gặp mà Brevo **không** nhận:

- **`.heic`** — định dạng ảnh mặc định của iPhone. Admin chụp poster bằng điện thoại rồi AirDrop sang máy là dính ngay.
- **`.webp`** — định dạng ảnh mặc định khi bấm "lưu ảnh" từ nhiều trang web.

Nên `DUOI_CHO_PHEP` khởi đầu bằng tập chắc chắn an toàn:

```
png · jpg · jpeg · gif · pdf · docx · xlsx · pptx · txt · zip
```

**Việc phải làm lúc code:** đối chiếu lại với danh sách đuôi chính thức trong tài liệu Brevo trước khi chốt hằng này. Danh sách trên là tập con thận trọng, không phải bản sao đầy đủ.

Câu lỗi phải nêu **đúng tên file và đuôi sai** — "Không gửi được `poster.webp`: đuôi .webp không được hỗ trợ. Dùng .png hoặc .jpg." — chứ không phải "File không hợp lệ".

### 4.4 Thay đổi ở `guiHangLoat`

```ts
export async function guiHangLoat(ban: BanGuiMot[], dinhKem?: DinhKem[]): Promise<number>
```

Khi `dinhKem` có phần tử, thêm `attachment: dinhKem` vào **cấp gốc** payload, cùng cấp với `messageVersions`. Tham số tuỳ chọn nên nơi gọi cũ không phải đổi — mà `guiHangLoat` hiện chỉ có **đúng một** nơi gọi (route gửi hàng loạt), nên đây là mở rộng gọn.

**Không đụng `send()`** (`brevo.ts:214`) và không đụng ba mẫu cố định. Email xác nhận đang chạy production không được nhúc nhích.

## 5. Chế độ nào mang đính kèm

| `che_do` | Mang `dinhKem`? |
|---|---|
| `"xem"` | **Không gửi gì**, nên đính kèm không đi đâu cả. Route vẫn kiểm hợp lệ để admin biết file sai **trước** khi bấm gửi thử. |
| `"thu"` | **Có** — gửi thử mà không có file đính kèm thì không kiểm được thứ cần kiểm. |
| `"that"` | **Có.** |

## 6. Gửi thử nhiều địa chỉ

### 6.1 File mới `src/lib/nhieu-email.ts`

```ts
/** Tách chuỗi admin dán thành danh sách địa chỉ. Dùng chung client + server. */
export function tachEmail(s: string): { hopLe: string[]; sai: string[] };
```

- Tách bằng **phẩy, chấm phẩy, xuống dòng, hoặc khoảng trắng** — admin dán từ Excel, từ Zalo, từ ô "To" của Gmail, mỗi nguồn một kiểu dấu.
- **Bỏ trùng**, không phân biệt hoa thường.
- **Giữ nguyên thứ tự** admin gõ, để danh sách hiện lại trên màn hình khớp với thứ tự họ nhìn quen.
- Trả riêng `sai` để giao diện nêu **đúng địa chỉ hỏng**, không phải "có địa chỉ không hợp lệ".

### 6.2 Đổi ở route

`toiEmail: string` → `toiEmails: string[]`. Đây là đổi **phá vỡ tương thích** với client cũ, chấp nhận được: client duy nhất gọi route này nằm cùng repo và đổi cùng lượt.

Server dựng **một `BanGuiMot` cho mỗi địa chỉ**, tất cả cùng dựng từ **một mẹ làm mẫu** (`idMau`) như trước. Nghĩa là mỗi địa chỉ thành một `messageVersion` riêng — **tuyệt đối không nhét nhiều địa chỉ vào một trường `to`**, đúng nguyên tắc `guiHangLoat` đã ghi (`brevo.ts:428`): làm thế là lộ email của những người nhận cho nhau.

Ghi vết: `console.log` số lượng **và** danh sách địa chỉ, mỗi lượt gửi thử.

**"Không giới hạn" nghĩa là không đặt thêm trần nào**, không phải là có một trần ngầm ở đâu đó. Vòng chia lô 1000 sẵn có trong `guiHangLoat` tự lo mọi số lượng, nên không phải viết thêm gì. Trần thật duy nhất là 4.5MB body của Vercel — với địa chỉ email trung bình 30 ký tự thì chỗ đó chứa được hàng vạn địa chỉ, tức là xa hơn mọi ca dùng thật.

### 6.3 Đánh đổi có chủ ý — mở rộng §7 của spec gốc

Spec gốc chốt rõ chế độ `"thu"` chỉ nhận **đúng một** địa chỉ, kèm lý do nguyên văn: *"Không biến được thành đường gửi hàng loạt lách qua cổng xác nhận."*

**Quyết định #4 mở lại đúng cửa đó, có chủ ý.** Bỏ trần số lượng nghĩa là: một phiên admin bị chiếm có thể gửi email nội dung tuỳ ý, từ tên miền của sự kiện, tới bao nhiêu địa chỉ tuỳ thích, mà **không** phải đi qua cổng gõ-số-xác-nhận. Khách đã chọn phương án này sau khi đánh đổi được nêu rõ.

Những gì còn giữ nguyên làm lớp bù:

- Đường **gửi thật** vẫn tuyệt đối không nhận địa chỉ từ client — chỉ nhận `ids`, rồi tự đọc email từ Supabase.
- Cổng gõ-số-xác-nhận vẫn nguyên vẹn trên đường gửi thật.
- `console.log` ghi vết mọi lượt gửi thử, giờ có thêm số lượng.

Ghi vào spec để sau này ai đọc code cũng biết đây là chủ ý, không phải chỗ bị sót.

## 7. Giao diện

**Ô chọn file** đặt trong khối "Soạn", dưới ô Nội dung: `<input type="file" multiple accept="...">` + danh sách file đã chọn, mỗi dòng có tên, dung lượng, nút xoá. Có dòng tổng: *"2 file · 1.4 MB / 3 MB"*.

**Ô "Gửi thử tới"** đổi từ `<input>` thành `<textarea>`, vẫn điền sẵn `ADMIN_EMAIL`. Dưới ô hiện số địa chỉ hợp lệ đã nhận ra, và danh sách địa chỉ sai nếu có.

**Danh sách đính kèm hiện trực tiếp, luôn cập nhật — không đóng băng vào bản xem trước.** Khung `<iframe>` không hiện được đính kèm, nên nhét chúng vào phép so `xemCu` chỉ thêm một đường nữa để dải băng đỏ *"Bản xem trước đã CŨ"* bật lên, mà không cho admin thấy thêm được gì. Phép so `xemCu` giữ nguyên đúng ba thứ cũ: tiêu đề, nội dung, mẹ làm mẫu.

**Bản nháp cứu-401 KHÔNG cứu file đính kèm.** Base64 của 3MB là 4.1MB, vượt hạn mức `sessionStorage` (khoảng 5MB cho cả origin) — cố cứu file là làm hỏng luôn việc cứu tiêu đề và nội dung, tức là mất phần quan trọng hơn để giữ phần dễ làm lại hơn. Sau khi phục hồi nháp, hiện thêm một dòng nói rõ: *"Bản nháp đã được khôi phục. File đính kèm phải chọn lại."*

**Sau khi gửi thật thành công**, danh sách file đính kèm **giữ nguyên**, giống như tiêu đề và nội dung. Lớp chắn chống gửi lặp vẫn là việc bỏ tick toàn bộ người nhận, không đổi.

## 8. Xử lý lỗi

**Đính kèm hỏng thì tắt CẢ BA nút** — "Xem trước", "Gửi thử", "Gửi thật" — đúng cách cờ `sanSang` hiện có đang xử lý lỗi chỗ điền lạ. Một file sai đuôi làm hỏng lượt gửi thật, nên không có lý do gì để nút gửi thật còn bấm được. Cụ thể: thêm điều kiện "không có lỗi đính kèm" vào `sanSang`.

Ngược lại, **địa chỉ gửi thử sai chỉ tắt riêng nút "Gửi thử"**: ô đó không liên quan gì tới đường gửi thật.

| Ca | Cách xử |
|---|---|
| Đuôi file không được phép | Chặn ngay tại client, nêu đúng tên file + đuôi sai + gợi ý đuôi thay thế. Route chặn lại → 400 |
| Tổng vượt 3MB | Chặn tại client, hiện tổng hiện tại và trần. Route chặn lại → 400 |
| File 0 byte | Không thêm vào danh sách, báo tên file |
| `FileReader` đọc hỏng | Không thêm vào danh sách, báo tên file. Các file khác trong cùng lượt chọn vẫn được thêm |
| Ô gửi thử có địa chỉ sai định dạng | Nút "Gửi thử" tắt, liệt kê **đúng** những địa chỉ sai |
| Ô gửi thử không có địa chỉ hợp lệ nào | Nút "Gửi thử" tắt |
| Brevo từ chối đính kèm | 502 kèm **nguyên văn** phản hồi Brevo. Không nuốt thành câu chung chung, không báo thành công giả |
| Mất kết nối giữa lượt gửi thật | Giữ nguyên câu cảnh báo hiện có: *"KHÔNG chắc đã gửi hay chưa"* |

## 9. File đụng tới

| File | Thay đổi |
|---|---|
| `src/lib/dinh-kem.ts` | **Mới.** Thuần: kiểu `DinhKem`, `DUOI_CHO_PHEP`, `byteCuaBase64`, `loiDinhKem` |
| `src/lib/nhieu-email.ts` | **Mới.** Thuần: `tachEmail` |
| `src/lib/dinh-kem.test.ts` | **Mới** |
| `src/lib/nhieu-email.test.ts` | **Mới** |
| `src/lib/brevo.ts` | `guiHangLoat(ban, dinhKem?)` — thêm `attachment` vào cấp gốc payload. Không đụng `send()` hay ba mẫu cố định |
| `src/app/api/admin/gui-mail-hang-loat/route.ts` | Nhận và kiểm `dinhKem[]` ở cả ba chế độ; `toiEmail` → `toiEmails[]`; truyền `dinhKem` xuống `guiHangLoat` ở `"thu"` và `"that"` |
| `src/components/GuiMailHangLoatTool.tsx` | Ô chọn file + danh sách xoá được; `<textarea>` nhiều địa chỉ; dòng nhắc "đính kèm phải chọn lại" sau khi phục hồi nháp |
| `src/lib/brevo.test.ts` | Thêm ca vào khối `guiHangLoat` sẵn có |
| `src/app/api/admin/gui-mail-hang-loat/route.test.ts` | Sửa các ca dùng `toiEmail`; thêm ca mới |

## 10. Kiểm thử

**`dinh-kem.test.ts`:**

- `byteCuaBase64` tính đúng, kể cả chuỗi có 1 và 2 ký tự đệm `=`;
- đuôi hợp lệ đi qua; `.webp` và `.heic` bị chặn kèm đúng tên file trong câu lỗi;
- đuôi viết HOA (`POSTER.PNG`) vẫn được nhận — admin không phải đổi tên file;
- file không có đuôi bị chặn;
- tổng đúng bằng trần thì qua, hơn một byte thì chặn;
- danh sách rỗng → `null` (không có đính kèm là hợp lệ).

**`nhieu-email.test.ts`:**

- tách đúng với cả bốn kiểu dấu, và với chuỗi trộn nhiều kiểu;
- bỏ trùng, không phân biệt hoa thường;
- giữ nguyên thứ tự;
- địa chỉ sai vào `sai`, hợp lệ vào `hopLe`, cùng một lượt gọi;
- chuỗi rỗng → hai mảng rỗng.

**`brevo.test.ts`** (thêm vào khối `guiHangLoat` sẵn có):

- có `dinhKem` → payload có `attachment` ở **cấp gốc**, không nằm trong `messageVersions`;
- không có `dinhKem` → payload **không có** khoá `attachment` (không gửi `undefined`);
- chia lô 1500 → **cả hai** lô đều mang đính kèm.

**`route.test.ts`:**

- `dinhKem` sai đuôi → 400 và **không** gọi Brevo;
- `dinhKem` vượt tổng → 400 và **không** gọi Brevo;
- `"thu"` với 3 địa chỉ → `guiHangLoat` nhận đúng 3 bản, **mỗi bản đúng một địa chỉ**;
- `"thu"` với danh sách có địa chỉ trùng → gửi đúng số bản sau khi bỏ trùng;
- `"thu"` có địa chỉ sai định dạng → 400 và **không** gọi Brevo;
- `dinhKem` được truyền xuống `guiHangLoat` ở cả `"thu"` lẫn `"that"`;
- `"xem"` có `dinhKem` → không gọi Brevo, và `dinhKem` sai vẫn bị chặn 400.

**Không unit test được:** giao diện `.tsx` (`vitest.config.ts` chạy `environment: "node"`, chỉ nhận `src/**/*.test.ts`, chưa cài jsdom).

### 10.1 Điểm chưa từng chạy — phải kiểm bằng tay

Payload Brevo mang **`attachment` cùng lúc với `messageVersions`** là thứ dự án này chưa từng gửi thật một lần nào. Theo tài liệu Brevo, `messageVersions` chỉ ghi đè `to` / `cc` / `bcc` / `replyTo` / `subject` / `htmlContent` / `textContent` / `params`, còn `attachment` ở cấp gốc áp cho mọi bản — nhưng **tài liệu không thay được một lượt gửi thật**.

Việc phải làm trước khi dùng cho 500 mẹ:

1. Gửi thử **có đính kèm** tới hộp thư thật. Chính chế độ "Gửi thử" đi qua đúng đường `guiHangLoat` + `messageVersions`, nên một lượt là kiểm được đầu-cuối.
2. Mở trên **Gmail máy tính và Gmail điện thoại**, xác nhận file tải về mở được, tên file không bị đổi.
3. Gửi thử tới **hai địa chỉ** một lượt, xác nhận **cả hai** đều nhận được đính kèm — đây mới là câu hỏi thật: đính kèm cấp gốc có áp cho mọi `messageVersion` không.

**Phương án dự phòng nếu Brevo từ chối:** đẩy file lên Supabase Storage rồi truyền `attachment: [{ url, name }]` thay cho `{ content, name }`. Đắt hơn hẳn — cần tạo bucket bằng tay, cần luồng dọn file cũ — nên chỉ làm khi bước 1 thất bại.

**Câu hỏi mở thật ra là VỊ TRÍ, không phải HÌNH THỨC.** Phương án dự phòng ở trên chỉ đổi HÌNH THỨC của đính kèm — base64 nhúng thẳng (`{ content, name }`) thành đường dẫn (`{ url, name }`) — chứ không đổi VỊ TRÍ của nó trong payload: vẫn là `attachment` ở cấp gốc, đứng cạnh `messageVersions`. Nhưng câu hỏi thật đang bỏ ngỏ chính là VỊ TRÍ: liệu Brevo có tôn trọng `attachment` cấp gốc khi có `messageVersions` đi kèm hay không. Nếu Brevo lặng lẽ bỏ qua `attachment` cấp gốc trong tình huống này, đổi sang dạng URL sẽ thất bại Y HỆT — cùng vị trí, cùng bị bỏ qua — và công sức dựng Supabase Storage không mua được gì cả. Phương án dự phòng chỉ có tác dụng nếu nguyên nhân thất bại nằm ở kích thước payload nhúng thẳng hoặc lỗi mã hoá, KHÔNG PHẢI ở vị trí trong payload.

Phương án B thật sự cho một thất bại về VỊ TRÍ là bỏ `messageVersions` khi có đính kèm, gọi riêng một lượt API cho mỗi người nhận — nhưng đây chính là hướng spec gốc §1 đã loại vì lý do timeout trên Vercel (500 lượt gửi tuần tự không sống nổi trong giới hạn thời gian một hàm serverless). Phải nghĩ trước phương án này TRƯỚC lúc kiểm bằng tay, không phải đợi kiểm xong mới tính — nếu bước 1 thất bại và hoá ra là lỗi vị trí, đây mới là lối ra thật, không phải Supabase Storage.

**Bước 3, không phải bước 1, mới là bước MANG SỨC NẶNG của toàn bộ lượt kiểm.** Bước 1 chỉ xác nhận Brevo nhận payload mà không trả lỗi — không nói gì về việc CẢ HAI địa chỉ trong một lượt gửi có thật sự nhận được đính kèm hay không. Bước 3 (gửi thử tới hai địa chỉ, xác nhận CẢ HAI hộp thư đều nhận được file) mới trả lời đúng câu hỏi mở ở trên: đính kèm cấp gốc có áp cho MỌI `messageVersion`, hay chỉ bản đầu tiên trong lô.

**Phản hồi 200 KHÔNG PHẢI bằng chứng đã gửi đúng.** `guiHangLoat` (`brevo.ts:483`) cộng `lo.length` — số người nhận trong lô — vào `daGui` mỗi khi `res.ok`, không đọc lại nội dung Brevo thật sự đã gửi cho từng người. Nếu Brevo âm thầm bỏ đính kèm mà vẫn nhận và xử lý được phần còn lại của payload, toàn hệ thống — từ `guiHangLoat` tới route tới màn hình admin — sẽ báo *"Đã gửi N email"* mà không có bất kỳ lỗi nào nổi lên ở bất kỳ đâu. Mở hộp thư ra xem file đính kèm là oracle DUY NHẤT cho câu hỏi này; log, mã trạng thái HTTP, hay số đếm trên màn hình admin đều không thay được.

## 11. Ngoài phạm vi

- **Đính kèm khác nhau theo từng mẹ** — `messageVersions` không cho; spec gốc §11 đã loại và spec này không mở lại.
- **Ảnh hiện trong thân email** — cần host công khai, và phần lớn email client chặn ảnh từ xa (quyết định #1).
- **File lớn hơn 3MB** — cần Supabase Storage, xem §10.1.
- **Lưu file đã đính kèm để tái dùng ở lượt gửi sau** — mỗi lượt chọn lại từ máy.
- **Quét virus file đính kèm.**
- Mọi thứ spec gốc §11 đã loại vẫn nằm ngoài phạm vi.
