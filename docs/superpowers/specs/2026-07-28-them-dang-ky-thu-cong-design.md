# Tạo đăng ký thủ công từ /admin — Design

**Ngày:** 2026-07-28
**Trạng thái:** user đã duyệt
**Nền tảng:** tiếp nối `2026-07-16-checkin-qr-admin-design.md` (trang /admin) và tính năng `/admin/gui-mail` (gửi lại email QR, chưa commit lúc viết spec này)

## Mục tiêu

Ops cần thêm một mẹ vào danh sách sự kiện **khi trong tay chỉ có email và họ tên** — mẹ đăng ký qua kênh khác (điện thoại, Zalo, quầy offline), hoặc lượt đăng ký thật bị mất do sự cố. Hiện không có đường nào ngoài việc tự đi điền form công khai hộ mẹ, mà form đó bắt buộc SĐT hợp lệ, tỉnh/thành, tình trạng, chủ đề quan tâm, nguồn biết đến — ops phải **bịa** năm trường phân khúc để đi qua được validation.

Bịa dữ liệu là thứ spec này tồn tại để chặn. Yêu cầu của user: nhập đúng **email + họ tên**, mọi thứ còn lại là `--`.

## Hiện trạng (kiểm tra 2026-07-28)

`POST /api/dang-ky` — đường ghi DUY NHẤT vào `registrations` hiện nay:

| Bước | Thất bại thì sao |
|---|---|
| Zod `registrationSchema` + honeypot | 400 |
| `existingCheckinCode` (tra Brevo, tái dùng mã cũ) | nuốt lỗi, sinh mã mới |
| Cổng hết hạn (`daDongDangKy`) | 409 |
| Cổng sức chứa (đếm email khác nhau ở tab `register`) | 409 |
| Brevo `upsertContact` | **502 — đăng ký KHÔNG thành công** |
| Gửi email + QR | `warnings: ["email"]` |
| Supabase `insertRegistration` (upsert theo email) | `warnings: ["supabase"]` |
| Sheets `appendRegistration` | `warnings: ["sheets"]` |

Ràng buộc chặn đường "gọi lại route này với dữ liệu rỗng":

- `registrationSchema` là discriminated union theo `trangThai`, và **mọi nhánh** đều bắt buộc `sdt` khớp regex số VN, `tinhThanh` không rỗng, `chuDeQuanTam` tối thiểu một phần tử, `nguonBietDen` thuộc enum 5 giá trị, `dongYNhanTin === true`.
- Postgres: `ho_ten`/`sdt`/`tinh_thanh`/`checkin_code` là `NOT NULL`; `trang_thai` có CHECK `in ('chuan_bi_mang_thai','ivf','mang_thai','da_sinh')`; `nguon_biet_den` có CHECK `is null or in (5 giá trị)`.

Nên đường tạo thủ công phải là **đường riêng**, không đi qua `registrationSchema`.

## Quyết định 1 — `--` cho cột text, `null` cho cột có kiểu

| Cột | Giá trị | Vì sao |
|---|---|---|
| `ho_ten`, `email` | admin nhập | |
| `checkin_code` | mã cũ của email (tra Brevo) hoặc sinh mới | giữ luật "một email một mã" đang chạy — xem `existingCheckinCode` |
| `sdt` | admin nhập nếu có, bỏ trống thì `"--"` | **tuỳ chọn**: bắt buộc là đóng lại đúng ca gốc (chỉ có email + họ tên). Đã nhập thì phải khớp `VN_PHONE` — số sai còn tệ hơn ô trống, vì ops gọi vào số rác mà tưởng mình liên lạc được với mẹ. Dấu phân cách (`090 123 4567`, `0901.234.567`) được cắt trước khi kiểm |
| `tinh_thanh` | `"--"` | cột `NOT NULL`; buộc phải có giá trị, và `--` là thứ ops đọc ra ngay |
| `trang_thai`, `nguon_biet_den` | `null` | **Không** nhét `--` vào field phân khúc có kiểu. Chọn đại một giá trị thật (`mang_thai`…) là nói dối đúng cái mà phân khúc sinh ra để đo |
| `chu_de_quan_tam` | `[]` | mảng rỗng = chưa hỏi. `["--"]` sẽ lọt vào chuỗi nối bằng dấu phẩy khi xuất Sheet |
| `facebook`, `chu_de_khac`, `thai_tuan`, `ten_be`, `be_ngay_sinh`, `be_gioi_tinh`, `be_thang_tuoi` | `null` | |
| `di_cung_chong` | `false` | |
| `dong_y_nhan_tin` | theo ô tick, **mặc định tắt** | CLAUDE.md: consent là cổng chi phối mọi lượt dùng dữ liệu về sau. Tự bật hộ mẹ là tự cấp cho mình quyền mà mẹ chưa cho |
| `nguon` | `"su-kien"` | giữ hợp đồng `NGUON` (`su-kien` vs `app-waitlist`). Thêm giá trị thứ ba ở đây là âm thầm phá phân khúc Brevo; hai ô `--` đã đủ để nhận ra dòng tạo tay |

`trangThaiLabel` / `nguonBietDenLabel` nhận thêm `null` và trả `"--"`, nên bảng admin, modal chi tiết, vé check-in và file Excel cùng hiện `--` mà **không phải sửa từng nơi hiển thị** — cả bốn chỗ đều đã kết thúc bằng lời gọi hai hàm này.

### SQL chạy tay

`supabase/2026-07-28-dang-ky-thu-cong.sql`:

```sql
alter table registrations alter column trang_thai drop not null;
```

Một câu, idempotent. **Không** phải đụng CHECK constraint: CHECK chỉ chặn khi biểu thức trả FALSE, mà `null in (...)` trả NULL nên đi qua.

## Quyết định 2 — Route riêng, không tái dùng `/api/dang-ky`

`POST /api/admin/them-dang-ky`, gác `isAdmin`.

Không thêm cờ `?admin=1` vào `/api/dang-ky`: route đó là endpoint **công khai**, và một tham số làm nó bỏ qua validation lẫn cổng sức chứa là thứ chỉ cần lộ một lần là hỏng cả sự kiện.

### Thứ tự các bước — có chủ đích

| # | Bước | Thất bại thì sao |
|---|---|---|
| 1 | `isAdmin` | 401 |
| 2 | Zod: `hoTen` 2–80, `email` hợp lệ | 400 kèm `fieldErrors` |
| 3 | `findByEmail` — email đã có dòng | **409**, trả kèm mã cũ |
| 4 | `existingCheckinCode` → dùng lại / sinh mới | nuốt lỗi, sinh mã mới (giống `/api/dang-ky`) |
| 5 | Brevo `upsertContactThuCong` | **502** |
| 6 | Supabase `insert` | **502** |
| 7 | Gửi email + QR (nếu tick) | `warnings: ["email"]` |
| 8 | Sheets append | `warnings: ["sheets"]` |

**Bước 3 từ chối chứ không ghi đè.** `insertRegistration` hiện có upsert theo email; dùng nó ở đây thì một mẹ đã đăng ký đầy đủ sẽ bị ghi đè SĐT và tỉnh/thành thật thành `--` chỉ vì ops gõ trùng email. Mất dữ liệu im lặng, không có đường lấy lại. Bước 6 vì thế dùng `insert` thuần — unique index trên `email` là lưới cuối nếu có hai tab admin bấm cùng lúc.

**Bước 5 không đẩy `--` sang Brevo.** Chỉ gửi `HO_TEN`, `MA_CHECKIN`, `NGUON`, `DONG_Y_NHAN_TIN`, và `SDT` **khi ops có nhập**; các attribute còn lại **vắng mặt** thay vì mang giá trị `--`. Brevo dùng `updateEnabled: true`, nên `--` sẽ nằm đó đè lên dữ liệu thật khi mẹ tự đăng ký lại sau này. Đây đúng là lý lẽ đã ghi sẵn trong `brevo.ts` cho nhánh waitlist: bỏ trống tốt hơn ghi rác.

**Bước 5 bắt buộc thành công** vì Brevo giữ `MA_CHECKIN`. Không ghi được thì lần sau mẹ tự đăng ký bằng email đó sẽ được cấp **mã mới**, và tấm QR ta vừa gửi chết.

**Bước 6 cũng bắt buộc** — khác `/api/dang-ky`, nơi Supabase chỉ là cảnh báo. Lý do: ở đây không có mẹ nào đang ngồi chờ trước màn hình để phải cứu lấy lượt submit, mà `findByCode` đọc từ Supabase — thiếu dòng là QR quét vào báo "không tìm thấy mã". Bấm lại an toàn: Brevo đã giữ mã nên lần thử sau dùng lại đúng mã đó.

**Bước 7 đứng SAU bước 6** để không bao giờ gửi QR trước khi mã sống được.

**Bước 8 có ghi Sheet**, nên mẹ tạo tay chiếm một chỗ trong 500 y như đăng ký thật — sức chứa đếm số email khác nhau ở tab `register`.

### Cổng chặn: bỏ qua

Không kiểm hết hạn, không kiểm sức chứa. Công cụ này sinh ra đúng để xử lý ngoại lệ — ops thêm mẹ thứ 501 hoặc thêm sau ngày đóng đăng ký là quyết định có chủ ý của ban tổ chức, không phải tai nạn cần chặn.

## Quyết định 3 — Trang riêng `/admin/them-dang-ky`

Đúng khuôn `/admin/gui-mail`: `page.tsx` server gác `isAdmin` rồi render component client.

Không làm modal trong `AdminDashboard`: file đó đã 427 dòng và mang toàn bộ phần khó nhất của trang admin (poll 5 giây, chống ghi đè bằng `writeGenRef`/`fetchSeqRef`). Nhét thêm state của một form nhiều bước vào đó là làm khó cả hai.

`ThemDangKyTool.tsx` gồm:

- Ba ô: Họ tên, Email, SĐT (gắn nhãn "không bắt buộc")
- Tick **"Gửi email xác nhận kèm mã QR"** — mặc định BẬT
- Tick **"Mẹ đã đồng ý nhận thông tin"** — mặc định TẮT
- Bảng liệt kê sẵn những trường sẽ thành `--`, để ops thấy trước cái mình đang tạo. "Số điện thoại" tự rời khỏi bảng ngay khi ops gõ vào ô SĐT
- Kết quả: mã check-in + ảnh QR (`/api/admin/qr`) + trạng thái **từng bước** (Brevo / Supabase / Email / Sheet)
- Nhật ký các mẹ đã tạo trong phiên, giống `GuiMailTool`

Trạng thái từng bước chứ không phải một chữ "Thành công": bước 7 và 8 chỉ cảnh báo, mà "email chưa gửi" là việc ops phải biết ngay để sang `/admin/gui-mail` gửi lại.

Nút **"+ Thêm đăng ký"** đặt cạnh "Gửi lại email QR" trên đầu `/admin`.

## Kiểm thử

| File | Khẳng định |
|---|---|
| `src/lib/dang-ky-thu-cong.test.ts` | schema nhận/từ chối đúng; bộ dựng row cho ra `--` ở `sdt`/`tinh_thanh`, `null` ở `trang_thai`/`nguon_biet_den`, `[]` ở `chu_de_quan_tam`, `dong_y_nhan_tin` bám theo đầu vào |
| `src/lib/export-rows.test.ts` | `trang_thai: null` và `nguon_biet_den: null` xuất ra `--` |
| `src/app/api/admin/them-dang-ky/route.test.ts` | 401 khi chưa đăng nhập và **không ghi gì**; 400 khi email/tên sai; 409 khi trùng email và **không ghi đè**; 502 khi Brevo hỏng; 502 khi Supabase hỏng và **không gửi email**; email hỏng chỉ ra `warnings`; không tick thì không gọi hàm gửi; mã cũ được tái dùng |

## Ngoài phạm vi

- Sửa/xoá đăng ký từ admin — spec này chỉ thêm.
- Nhập hàng loạt từ CSV.
- Bổ sung nốt thông tin còn thiếu của một dòng `--` sau này (mẹ tự đăng ký lại bằng cùng email sẽ tự làm việc đó qua `/api/dang-ky`, vốn upsert theo email).
