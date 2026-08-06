# Thiết kế: Ẩn khỏi admin những đăng ký ngoài danh sách khách mời

- **Ngày:** 2026-08-06
- **Trạng thái:** Đã chốt thiết kế, chờ review spec trước khi lập kế hoạch code
- **Phạm vi:** Thêm cột `duoc_moi` vào `registrations`, lọc `listRegistrations()` theo cột đó, nạp một lần danh sách 518 mã từ file Excel chốt khách mời.
- **Hạn:** Trước ngày sự kiện **30/08/2026**.

---

## 1. Bối cảnh

Supabase đang có **1003** dòng `registrations` (sau khi xoá 6 dòng `@yopmail.com` ngày 06/08). Nhưng danh sách khách mời thật đã được ops chốt thủ công trong file `MamaOi – Đăng ký.xlsx`, sheet `register`: 541 dòng, **518 mã check-in duy nhất**.

23 email trong đó xuất hiện hai lần — cùng email, cùng mã, nhưng **khác nội dung** (khác chủ đề quan tâm, khác ngày sinh bé, khác giờ đăng ký). Đó là dấu vết của việc một email gửi form hai lần: Google Sheet append cả hai lượt, còn Supabase `upsert` theo email nên chỉ giữ lượt cuối. Không ảnh hưởng phép lọc, vì lọc theo tập mã duy nhất. Xem §9 về một ca cần ops xử riêng.

Sức chứa sự kiện là 500 mẹ. 518 mã đó ≈ 503 mẹ đăng ký qua form + 15 mẹ ops tạo tay ngày 28/07.

Đối chiếu cho ra:

| | Số dòng |
|---|---:|
| Supabase | 1003 |
| Có mã trong Excel → **hiện** | **517** |
| Không có mã trong Excel → **ẩn** | **486** |

Mã Excel duy nhất không còn trên Supabase là `MO-9RBDEA` — dòng `minhthu12340ss@yopmail.com`, bản tạo nhầm của mẹ Minh Thu, đã xoá; mẹ này vẫn còn dưới `MO-A52857`.

**Không dòng nào trong 486 đang `checked_in = true`**, và tất cả đều `nguon = 'su-kien'`.

**Vì sao khoá đối chiếu là `checkin_code` chứ không phải email:** ops đã sửa email của 4 mẹ sau khi xuất file Excel (`meomeodat@gnail.com` → `@gmail.com`, `tuan8150@gmail.cm` → `.com`, v.v.). Đối chiếu bằng email thì 4 mẹ này bị ẩn oan. Mã check-in bất biến nên miễn nhiễm. Đã kiểm chứng: khớp bằng mã cho đúng 517/486, bằng email cho 513 — thiếu đúng 4 mẹ đó.

## 2. Quyết định đã chốt

| # | Quyết định | Lựa chọn | Lý do |
|---|---|---|---|
| 1 | Phạm vi ẩn | **Tất cả nơi liệt kê**: bảng `/admin`, poll 5s, xuất Excel, gửi mail hàng loạt, picker trang gửi lại QR | Nếu chỉ ẩn ở bảng thì một lượt gửi hàng loạt vẫn bắn tới 486 người không được mời. |
| 2 | Check-in QR của người bị ẩn | **Vẫn cho check-in bình thường** | Họ đã nhận email kèm mã; chặn ở quầy gây ùn tắc ngày sự kiện. |
| 3 | Đường xem lại dòng ẩn | **Không có** | Ops chốt: ẩn hẳn. Xem §7 để biết cái mất. |
| 4 | Đăng ký ops tạo tay sau này | **Luôn hiện** | Ops gõ tay tức là có chủ ý mời. Vừa thêm xong mà biến mất thì trông như lỗi. |
| 5 | Nơi lưu sự thật | **Cột boolean trong Supabase** | Xem §3 — so với danh sách hằng số trong repo và bảng riêng có join. |
| 6 | Khoá đối chiếu | **`checkin_code`** | Bất biến. Xem §1. |
| 7 | Tầng lọc | **SQL (`.eq`)**, không phải JS | `/api/admin/registrations` poll mỗi 5s; lọc ở JS là kéo thừa 486 dòng mỗi nhịp. |

**Hai hướng đã cân nhắc rồi loại:**

- *Danh sách 518 mã hardcode trong repo.* Đổi danh sách phải sửa code và deploy; và không phân biệt được đăng ký tạo tay sau này nếu không bịa thêm một điều kiện phụ mong manh theo `created_at`.
- *Bảng riêng `danh_sach_moi` rồi join.* PostgREST lọc theo join kiểu này rất vướng — phải thêm view hoặc hai truy vấn. Phức tạp hơn mà không được gì thêm.

## 3. Ranh giới: "tra theo mã" vs "liệt kê danh sách"

Đây là trục chính của thiết kế. Code đã có sẵn hai đường đọc `registrations`, và **chỉ một đường bị lọc**:

| Đường | Hàm | Nơi dùng | Xử lý |
|---|---|---|---|
| **Liệt kê** | `listRegistrations()` `src/lib/supabase.ts:207` | `/admin` (`page.tsx:17`), `/api/admin/registrations`, `/api/admin/export:38`, `/admin/gui-mail-hang-loat` (page + route:64), picker `/admin/gui-mail` | **Lọc → 517** |
| **Tra theo mã** | `findByCode()` `src/lib/supabase.ts:164` | `/check-in/[code]:77`, `/api/admin/tra-ma:31`, `/api/admin/gui-mail:53,80` | **Giữ nguyên** |

Ranh giới này thực thi đúng quyết định #2: check-in đi đường "tra theo mã" nên người bị ẩn quét QR vẫn vào được.

**Hệ quả đã biết:** ops gõ tay một mã ngoài danh sách vào trang "Gửi lại email QR" thì vẫn gửi được. Chấp nhận — người đó không xuất hiện trong picker nên không thể lỡ tay chọn, còn gõ đúng 8 ký tự mã là hành động có chủ ý.

`listWaitlist()` và bảng `waitlist` **không đụng tới** — ngoài phạm vi.

## 4. Cột `duoc_moi`

```sql
alter table registrations
  add column if not exists duoc_moi boolean not null default true;
```

`default true` là mấu chốt của cả thiết kế: **không đường ghi nào cần sửa logic**.

- `insertRegistrationThuCong` (ops tạo tay) → `true` → hiện ngay. Thoả quyết định #4 mà không viết thêm dòng nào.
- Form công khai (nếu mở lại) → `true`. Mẹ mới là mẹ thật, hiện là đúng.
- `insertRegistration` dùng `upsert`, mà upsert **chỉ update cột được gửi lên**. Payload không chứa `duoc_moi` nên một mẹ đã ẩn gửi lại form **không tự bật lại thành hiện**.

Không cần index: bảng 1003 dòng.

## 5. Thay đổi trên file có sẵn

| File | Thay đổi |
|---|---|
| `src/lib/supabase.ts` | Thêm `duoc_moi: boolean` vào `RegistrationRow`. Thêm `"duoc_moi"` vào danh sách `Omit<>` ở kiểu trả về của `registrationToRow` và ở tham số của `insertRegistrationThuCong`. Thêm `.eq("duoc_moi", true)` vào `listRegistrations()`. |
| `src/lib/dang-ky-thu-cong.ts` | Thêm `"duoc_moi"` vào `Omit<>` của kiểu trả về `thuCongToRow`. Không thêm giá trị vào object trả về. |
| `supabase/2026-08-06-duoc-moi.sql` | **File mới.** Xem §6. |

Đưa `duoc_moi` vào `Omit<>` (thay vì gán giá trị) là cố ý: TypeScript sẽ **chặn** bất kỳ ai về sau lỡ tay gửi cột này lên trong payload insert, giữ cho default của DB luôn là thứ quyết định.

Không file UI nào phải sửa. `AdminDashboard` đọc `rows.length` nên tab, dòng "Đã check-in: N / …" và nút "Xuất Excel (N)" tự đổi sang 517.

## 6. File nạp dữ liệu

`supabase/2026-08-06-duoc-moi.sql`, theo đúng nếp các file `supabase/*.sql` có sẵn: chạy tay trong Supabase SQL editor, chỉ nới/cập nhật, chạy lại nhiều lần vẫn an toàn.

```sql
alter table registrations
  add column if not exists duoc_moi boolean not null default true;

update registrations set duoc_moi = false
where created_at < '2026-08-06T00:00:00+07:00'
  and checkin_code not in ('MO-5QBUQP', 'MO-3MPCHG', … 518 mã …);
```

Danh sách 518 mã sinh ra từ cột "Mã check-in" của sheet `register`, đã khử trùng lặp và sắp xếp.

**Mệnh đề `created_at <` là lưới an toàn, không phải trang trí:** thiếu nó, chạy lại file này sau ngày 06/08 sẽ ẩn mất mọi đăng ký ops tạo tay về sau — phá thẳng quyết định #4.

## 7. Rủi ro đã biết và chấp nhận

486 mẹ ẩn **vẫn check-in được nhưng không hiện ở bất cứ đâu trong admin, kể cả sau khi đã check-in**. Không có nút gạt để xem lại. Muốn tra một người trong nhóm này phải vào thẳng Supabase dashboard, hoặc `update registrations set duoc_moi = true where checkin_code = '…'`.

Đây là hệ quả trực tiếp của quyết định #2 (vẫn cho check-in) cộng #3 (ẩn hẳn), đã nêu rõ lúc chốt. Nếu về sau thấy vướng, cách gỡ rẻ nhất là thêm một nút gạt "Hiện cả ngoài danh sách" ở client — dữ liệu vẫn còn nguyên trong DB, chỉ là API không trả về.

Bản backup `~/Downloads/MAMAOI/supabase-backup-20260806-105631` chụp trước mọi thay đổi này, khôi phục được toàn bộ 1003 dòng nếu cần.

## 8. Kiểm thử

**Nói thẳng về khoảng trống:** mọi test route hiện tại đều `vi.mock("@/lib/supabase")`, nên mệnh đề `.eq("duoc_moi", true)` **không có test đơn vị nào phủ được**. Viết một mock cho chuỗi query builder của Supabase chỉ để khẳng định "có gọi `.eq`" là test viết lại chính dòng code — vô giá trị.

Cái làm được:

| Việc | Kiểm cái gì |
|---|---|
| Sửa `src/lib/supabase-rows.test.ts` | `registrationToRow(...)` trả về object **không có khoá `duoc_moi`** — nếu ai đó thêm vào, default DB mất tác dụng. |
| Sửa `src/lib/dang-ky-thu-cong.test.ts` | Tương tự cho `thuCongToRow`. |
| `npm run build` + `npm run lint` | Kiểu `RegistrationRow` đổi mà mọi nơi dùng vẫn biên dịch. |

**Xác minh thật sau khi chạy SQL** (không thay thế được bằng test):

1. `select count(*) from registrations where duoc_moi` → phải ra **517**.
2. `select count(*) from registrations where not duoc_moi` → phải ra **486**.
3. `select count(*) from registrations where not duoc_moi and checked_in` → phải ra **0**.
4. Mở `/admin`: tab "Sự kiện (517)", nút "Xuất Excel (517)".
5. Mở `/admin/gui-mail-hang-loat`: danh sách 517 dòng.
6. Quét/mở một mã thuộc nhóm ẩn trên `/check-in/[code]` → **vẫn check-in được** (quyết định #2).

## 9. Ngoài phạm vi

- Bảng `waitlist` — không lọc gì.
- Dọn 486 contact tương ứng bên **Brevo** và trên **Google Sheet**. Hai chỗ đó vẫn còn đủ dữ liệu; gửi mail *từ dashboard Brevo* vẫn chạm tới họ. Việc này cần quyết định riêng.
- Nút gạt "Hiện cả ngoài danh sách" — đã loại ở quyết định #3.
- Đếm sức chứa: `suc-chua.ts` đếm từ Google Sheet chứ không từ Supabase, nên không chịu ảnh hưởng.

**Bốn ca ops cần xử riêng, phát hiện lúc soát dữ liệu — không sửa trong phạm vi này.** Trong 23 email trùng ở §1, có 4 email mà hai lượt đăng ký là **hai người khác hẳn nhau** (khác cả tên lẫn số điện thoại). `upsert` theo email gộp họ thành một dòng, nên mỗi cặp đang **dùng chung một mã QR** — người vào cổng trước dùng mất mã, người thứ hai bị chặn:

| Email | Mã dùng chung | Hai người |
|---|---|---|
| `dothitrucmai193@gmail.com` | `MO-48YUMS` | Đỗ Thị Trúc Mai `+84901362958` / Tran dai ngoc `0785260817` |
| `nguyenthao.dung97@gmail.com` | `MO-EW8FT6` | Lò Dân Tấn Tài `0965492202` / Nguyễn Thảo Dung `0362015525` |
| `baouyen88@gmail.com` | `MO-8K63ED` | Ly Linh `0937167115` / Tran Uyen `0917220770` |
| `ytruong0506@gmail.com` | `MO-RSNASJ` | Trần Thị Thuý Hồng `0979605962` / Trương Trần Như Ý `0522997291` |

Thêm một ca chưa rõ: `buuphung2408@gmail.com` (`MO-PTZJ32`) — cùng tên "Phùng Bửu Bửu" nhưng hai số khác nhau, có thể là gõ nhầm. (`tramnguyen1503@yahoo.com` thì không phải vấn đề: `+84972635454` và `0972635454` là cùng một số.)

Cần ops liên hệ tách thành hai đăng ký riêng trước ngày sự kiện. Cả 4 mã trên đều nằm trong danh sách 517 nên **không bị ẩn** bởi thay đổi này.
