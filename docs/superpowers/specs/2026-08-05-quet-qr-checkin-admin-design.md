# Thiết kế: Admin quét QR check-in hộ các mẹ

- **Ngày:** 2026-08-05
- **Trạng thái:** Đã chốt thiết kế, chờ review spec trước khi lập kế hoạch code
- **Phạm vi:** Trang `/admin/quet-qr` cho nhân viên quầy quét mã QR của mẹ để check-in hộ; ghi nhãn nguồn check-in vào Excel, Google Sheet và bảng `/admin`; nối luồng admin vào mirror Google Sheet (lỗ hổng hiện có).
- **Hạn:** Phải chạy được trước ngày sự kiện **30/08/2026**.

---

## 1. Bối cảnh & khoảng trống

Yêu cầu gốc: admin (đã đăng nhập `/admin`) quét QR của mẹ để check-in hộ. Mẹ đã check-in trước đó thì nút đổi thành **"Check-in lại"** và ghi nhận thông tin mới. Lượt check-in do admin làm phải mang note **"(Admin CheckIn)"** ở cột cuối file Excel và hiện trong danh sách ở trang admin.

**Phần lớn hạ tầng đã có sẵn trong repo — không làm lại:**

| Đã có | Ở đâu |
|---|---|
| `checked_in_source: "qr" \| "admin" \| null` trong schema | `src/lib/supabase.ts:46` |
| `adminUpdateCheckin` đã ghi `"admin"` khi tick tay | `src/lib/supabase.ts:226` |
| Cột **"Nguồn check-in"** là cột cuối (thứ 22) của Excel và Google Sheet | `src/lib/export-rows.ts:15,44` |
| `checkinCells()` — một phép định dạng dùng chung cho Excel lẫn Sheet | `src/lib/export-rows.ts:57` |
| `markCheckedInInSheet(code, at, source)` **đã nhận sẵn `"qr" \| "admin"`** | `src/lib/sheets.ts:438-441` |
| `findByCode(code)` tra dòng theo mã | `src/lib/supabase.ts:164` |
| `isValidCheckinCode`, `generateCheckinCode` (`MO-XXXXXX`, bỏ I/O/0/1) | `src/lib/validation.ts` |
| `checkinUrl(code)` — nội dung QR, dùng chung giữa email và admin | `src/lib/checkin-url.ts:8` |
| Gác đăng nhập `isAdmin()` + cookie HMAC 12 giờ | `src/lib/admin-auth.ts`, `src/app/api/admin/login/route.ts:28` |

**Bốn khoảng trống thật sự cần lấp:**

1. **Không có máy quét.** `qrcode` trong `package.json` chỉ *tạo* mã, không giải mã. Chưa có thư viện đọc QR.
2. **Admin check-in không mirror sang Google Sheet.** Chỉ luồng mẹ tự quét mới gọi `markCheckedInInSheet` (`src/app/api/check-in/route.ts:56`). Nếu ngày 30/08 phần lớn check-in đi qua đường admin, cột check-in trong Google Sheet của ops sẽ gần như trắng.
3. **Nhãn nguồn đang là chuỗi kỹ thuật.** `checkinCells` ghi thẳng `source ?? ""`, nên Excel và Sheet đang in ra chữ `admin` / `qr`. Bảng `/admin` không hiện nguồn; modal chi tiết in chữ trần (`src/components/AdminDetailModal.tsx:122`).
4. **Bỏ tick không xoá được Sheet.** `markCheckedInInSheet` chỉ biết đánh dấu TRUE, không có đường ghi lại trạng thái trống.

## 2. Quyết định đã chốt

| # | Quyết định | Lựa chọn | Lý do |
|---|---|---|---|
| 1 | Thiết bị quét | Điện thoại cá nhân nhân viên, **trộn iPhone + Android** | Thực tế đội ops. Buộc phải dùng thư viện JS. |
| 2 | Cách giải mã | Thư viện **`qr-scanner`** (nimiq), ~15KB gzip, chạy trong Web Worker | `BarcodeDetector` của trình duyệt **không có trên Safari iOS**. Một đường code cho mọi máy, không rẽ nhánh theo trình duyệt. Nhẹ hơn `@zxing/browser` (~200KB), không áp UI như `html5-qrcode`. |
| 3 | Nơi đặt máy quét | **Trang riêng `/admin/quet-qr`** | `AdminDashboard.tsx` đã 432 dòng và chứa toàn bộ logic chống race của poll 5s (`writeGenRef`, `fetchSeqRef`, `appliedSeqRef`). Vòng đời camera nhét vào đó là làm file khó vào thêm khó; poll 5s còn tranh main thread với vòng giải mã gây giật. |
| 4 | Mirror Google Sheet | **Có, chạy nền** bằng `after()` của `next/server` | Màn hình báo xong ngay khi Supabase ghi xong, hàng không nghẽn; Sheet vẫn đủ. Chờ Sheet tốn thêm 1–3 giây mỗi lượt, wifi hội trường yếu là hàng đứng im. |
| 5 | Quét trúng mẹ đã check-in | Hiện giờ cũ + **nút phụ "Check-in lại"**, ghi đè. **Không lưu lịch sử.** | Ghi đè phải là hành động có chủ ý: quét trùng vô ý không được phép xoá mất giờ đúng. Bảng log riêng là thêm migration cho một ca hiếm. |
| 6 | Nhịp sau khi check-in xong | Báo thành công ~2 giây rồi **tự bật lại camera**, kèm nút "Quét tiếp ngay" | Nhân viên chỉ chạm 1 lần mỗi mẹ. |
| 7 | Nhãn nguồn | **`(Admin CheckIn)`** / **`(QR)`** / ô trống | Đúng nguyên văn chữ khách yêu cầu. |
| 8 | Tra mã | **Gọi API mỗi lượt quét**, không cache trước 500 dòng | Cache đẻ ra đúng bug cần tránh — xem §6. |

## 3. Kiến trúc

```
/admin  ──[nút "Quét QR"]──▶  /admin/quet-qr   (server component, gác isAdmin)
                                    │
                                    ▼
                            QuetQrTool  ("use client")
                                    │
                  [Bật camera]  ◀── một lần mỗi ca trực
                                    │
                            qr-scanner giải mã trong Web Worker
                                    │ text QR
                                    ▼
                            maTuQr(text) ──▶ null? bỏ qua im lặng, quét tiếp
                                    │ mã hợp lệ
                                    ▼
                       GET /api/admin/tra-ma?code=X   (tạm dừng giải mã)
                                    │
                                    ▼
                            THẺ XÁC NHẬN
                     tên · mã · tỉnh/thành · tình trạng · 👫 đi cùng chồng
                       ├─ chưa check-in → [✓ Xác nhận check-in]  (nút chính)
                       └─ đã check-in   → "Đã check-in 08:45 · (QR)"
                                          + [Check-in lại]        (nút phụ)
                                    │ bấm
                                    ▼
                       POST /api/admin/checkin   ◀── DÙNG CHUNG với nút tick tay ở /admin
                            ├─ adminUpdateCheckin(...)         → Supabase (bắt buộc)
                            └─ after(() => ghiCheckinVaoSheet)  → Sheet (chạy nền, non-fatal)
                                    │
                                    ▼
                       Màn xanh "✓ Chị {tên} đã check-in"  (2 giây)
                                    │
                                    ▼
                            Camera bật lại      [Quét tiếp ngay]
```

**Nguyên tắc giữ nguyên từ hệ thống hiện tại:** Supabase là nguồn chính thức của trạng thái check-in; Google Sheet là bản mirror cho ops và **hỏng thì chỉ log**, không bao giờ làm hỏng lượt check-in.

## 4. File mới

| File | Trách nhiệm | Phụ thuộc |
|---|---|---|
| `src/app/admin/quet-qr/page.tsx` | Server component. Gác `isAdmin()`, redirect `/admin/login` nếu chưa đăng nhập. Render `QuetQrTool`. | `admin-auth` |
| `src/components/QuetQrTool.tsx` | `"use client"`. Vòng đời camera, thẻ xác nhận, màn kết quả, ô nhập mã tay, mọi thông báo lỗi. | `qr-scanner`, `ma-tu-qr`, `time` |
| `src/lib/ma-tu-qr.ts` | **Hàm thuần**: text QR đọc được → mã check-in hoặc `null`. | `validation` |
| `src/app/api/admin/tra-ma/route.ts` | `GET` — tra một dòng theo mã, trả bản rút gọn. | `admin-auth`, `supabase`, `validation` |
| `src/lib/ma-tu-qr.test.ts` | Test hàm thuần. | — |
| `src/app/api/admin/tra-ma/route.test.ts` | Test route, theo mẫu `gui-mail/route.test.ts`. | — |
| `src/app/api/admin/checkin/route.test.ts` | Route này chưa có test nào; thêm mới cùng lúc với việc nối mirror Sheet. | — |

### 4.1 `ma-tu-qr.ts` — vì sao tách riêng

QR trong email chứa **cả URL** `https://mamaoi.vn/check-in/MO-ABC234` (`checkin-url.ts:10`), không phải mã trần. Hàm này:

- rút đoạn cuối đường dẫn của một URL hợp lệ trỏ tới `/check-in/<mã>`;
- chấp nhận luôn chuỗi chỉ chứa mã trần (phòng QR do nơi khác sinh);
- chuẩn hoá chữ hoa + cắt khoảng trắng, rồi kiểm qua `isValidCheckinCode`;
- trả `null` cho mọi thứ còn lại.

Tách khỏi component vì đây là **lớp chặn rác**: chĩa camera vào QR wifi hay QR Momo phải trả `null` chứ không bắn request. Và vì nó thuần, nó test được đầy đủ mà không cần camera.

## 5. Thay đổi trên file có sẵn

| File | Thay đổi |
|---|---|
| `src/lib/constants.ts` | Thêm bảng nhãn `NGUON_CHECKIN_NHAN: Record<"qr" \| "admin", string>` = `{ qr: "(QR)", admin: "(Admin CheckIn)" }` và hàm `nguonCheckinLabel(source)` trả `""` khi `null`. **Một chỗ khai** cho cả bốn nơi hiển thị. |
| `src/lib/export-rows.ts` | `checkinCells` đổi ô thứ ba từ `source ?? ""` sang `nguonCheckinLabel(source)`. Ảnh hưởng đồng thời Excel **và** Google Sheet vì cả hai đều đi qua hàm này. |
| `src/lib/sheets.ts` | `markCheckedInInSheet` → đổi tên **`ghiCheckinVaoSheet`**, chữ ký `(code, checkedInAt: string \| null, source: "qr" \| "admin" \| null)`. `checkedInAt === null` ⇒ ghi `checkinCells(false, null, null)` = `["—", "", ""]`, **đúng y hệt dòng vừa append** (`sheets.ts:113-117`). `buildCheckinUpdate` nới tham số tương ứng. |
| `src/app/api/check-in/route.ts` | Đổi tên hàm gọi. Hành vi không đổi. |
| `src/app/api/admin/checkin/route.ts` | Thêm mirror Sheet chạy nền qua `after()` — xem §5.1. |
| `src/components/AdminDashboard.tsx` | (a) Thêm `<Link href="/admin/quet-qr">Quét QR</Link>` vào cụm nút đầu trang. (b) Trong ô "Giờ check-in", thêm dòng chữ nhỏ dưới `<input>` hiện `nguonCheckinLabel(r.checked_in_source)`. |
| `src/components/AdminDetailModal.tsx:122` | Đổi `row.checked_in_source ?? ""` sang `nguonCheckinLabel(row.checked_in_source)`. |
| `package.json` | Thêm `qr-scanner`. |

**Vì sao đổi tên `markCheckedInInSheet`:** sau khi tổng quát, hàm vừa đánh dấu vừa xoá. Giữ tên `markCheckedIn...` là để lại một cái tên nói sai việc — đúng loại lỗi mà repo này vốn rất kỹ chuyện tránh (xem doc `checkinCells`, `checkinUrl`).

**Vì sao nhãn nguồn nằm dưới ô giờ chứ không thành cột thứ 8:** bảng đang `min-w-[760px]` và đã phải cuộn ngang trên điện thoại. Đặt dưới ô `datetime-local` còn đọc đúng nghĩa hơn — nó chú thích *giờ này do ai ghi*, chính là câu hỏi người đọc đang có khi nhìn ô đó.

**Vé của mẹ (`CheckinPass.tsx`) không hiện nguồn.** Mẹ không cần biết ai bấm nút. Cùng lý do file đó đã cố ý ẩn các ô `--` khỏi mắt mẹ (`CheckinPass.tsx:179-184`).

### 5.1 `POST /api/admin/checkin` sau khi sửa

```ts
const row = await adminUpdateCheckin(id, checkedIn, checkedIn ? (checkedInAt ?? null) : null);

// Mirror sang Google Sheet SAU KHI đã trả lời — hàng ở quầy không đứng chờ
// Google. Non-fatal y như luồng mẹ tự quét: Supabase đã ghi xong và nó là
// nguồn chính thức; Sheet lệch thì log để ops back-fill.
after(async () => {
  if (!sheetsConfigured()) return;
  try {
    await ghiCheckinVaoSheet(
      row.checkin_code,
      row.checked_in_at,
      row.checked_in ? "admin" : null,
    );
  } catch (err) {
    console.error("[admin/checkin] Sheets update failed:", row.checkin_code, err);
  }
});

return Response.json({ ok: true, row });
```

**Đây là điểm đắt giá nhất của thiết kế:** máy quét và nút tick tay ở `/admin` dùng **chung đúng một đường ghi**. Lỗ hổng "admin tick không mirror sang Sheet" (§1.2) đóng lại mà không phải viết dòng code nào riêng cho nó, và không bao giờ có chuyện hai đường ghi trôi lệch nhau.

`after()` được chọn thay vì promise thả trôi vì trên Vercel, hàm bị đóng ngay khi response trả xong — promise chưa xong sẽ chết giữa chừng. `after` là cơ chế Next 16 dựng riêng cho việc này (`node_modules/next/server.d.ts:21`).

**Một hành vi có sẵn cần nói rõ để không ai tưởng là bug:** `adminUpdateCheckin` đặt `checked_in_source = "admin"` mỗi khi `checkedIn` là `true` (`supabase.ts:226`). Nghĩa là mẹ tự quét lúc 08:45, rồi admin vào `/admin` **chỉ sửa lại giờ** cho đúng, thì nhãn đổi từ `(QR)` sang `(Admin CheckIn)`. Đây là hành vi đúng — giờ đang nằm đó là do admin ghi, nhãn phải nói đúng ai ghi giá trị hiện tại — và là hành vi đã có từ trước, thiết kế này không đổi nó.

### 5.2 `GET /api/admin/tra-ma?code=X`

Gác `isAdmin()` → `isValidCheckinCode` → `findByCode`. Trả **bản rút gọn**:

```
id, ho_ten, checkin_code, tinh_thanh, trang_thai, thai_tuan,
be_thang_tuoi, di_cung_chong, checked_in, checked_in_at, checked_in_source
```

**Cố tình bỏ `email`, `sdt`, `facebook`.** Thẻ xác nhận không cần chúng, và đây là **điện thoại cá nhân của nhân viên thời vụ**, không phải máy ops. Chỗ này khác `/api/admin/registrations` (trả full row cho bảng ops) một cách có chủ ý — lý do đó phải được ghi vào doc của route để người sau không "dọn cho nhất quán".

Trường `di_cung_chong` đứng trong thẻ xác nhận có chủ đích: nhân viên phát Welcome Kit cần biết ngay một suất hay hai, không phải mở màn hình khác để tra.

Thẻ xác nhận **hiện cả ô `--`** khi `trang_thai` là `null` (dòng ops tạo tay ở `/admin/them-dang-ky`). Ngược với vé của mẹ, nơi ô `--` bị ẩn: với ops, "chưa hỏi" là thông tin cần biết — xem lý do đã ghi ở `CheckinPass.tsx:179-184`.

## 6. Vì sao tra mã mỗi lượt quét, không cache trước 500 dòng

Cache toàn bộ danh sách khi mở trang nghe hấp dẫn vì wifi hội trường yếu. Nhưng nó đẻ ra đúng con bug mà quyết định #5 sinh ra để chặn:

> Quầy B check-in mẹ X lúc 08:45. Máy quầy A đang giữ bản cache từ 08:30, vẫn tin là mẹ X **chưa** check-in. Nhân viên quầy A quét mẹ X, thấy **nút chính** "Xác nhận check-in", bấm — và ghi đè giờ đúng bằng giờ sai. Nút "Check-in lại" không bao giờ hiện ra để ai kịp cảnh giác.

Tra theo từng lượt quét là cách duy nhất để trạng thái trên thẻ xác nhận nói đúng sự thật tại thời điểm bấm nút.

## 7. Xử lý lỗi

| Ca | Cách xử |
|---|---|
| QR lạ (wifi, Momo, mã sự kiện khác) | `maTuQr` trả `null` → **bỏ qua im lặng**, camera quét tiếp. Không hiện lỗi đỏ: nó sẽ nhấp nháy mỗi khung hình. |
| Mã đúng dạng nhưng không có trong DB | "Không tìm thấy mã `MO-XXXXXX`" + nút Quét lại |
| Từ chối quyền camera / trình duyệt không hỗ trợ | Thông báo rõ + hướng dẫn bật lại trong Cài đặt + **ô nhập mã tay** |
| Mạng hỏng lúc tra mã | "Không kết nối được" + Thử lại, **giữ nguyên mã đã quét** (không bắt quét lại) |
| Mạng hỏng lúc ghi check-in | Báo lỗi thật + Thử lại. **Tuyệt đối không hiện màn xanh.** Đúng nguyên tắc `gui-mail/route.ts:94-95`: báo thành công khi chưa thành công là cách chắc chắn nhất để một mẹ tới cổng mà không có vé. |
| Google Sheet hỏng | Chỉ `console.error`. Supabase đã ghi xong — nguồn chính thức. |
| Phiên admin hết hạn giữa ca | 401 → redirect `/admin/login` |
| Hai quầy quét cùng một mẹ cùng lúc | **Chấp nhận**: hai lượt ghi cách nhau vài giây, giờ cuối thắng. Khoá phân tán cho một ca hiếm và hậu quả nhẹ là không đáng. |

**Ô nhập mã tay là bắt buộc, không phải phụ kiện.** Vé của mẹ đã tính sẵn ca hỏng QR: *"Không tạo được mã QR. Mẹ đọc mã MO-ABC234 cho nhân viên."* (`CheckinPass.tsx:145-148`). Cộng thêm màn hình vỡ, độ sáng thấp, ảnh chụp màn hình bị nén — ô nhập mã tay là đường thoát cho tất cả, và là đường **duy nhất** khi nhân viên lỡ từ chối quyền camera.

**Vì sao có nút "Bật camera" thay vì tự mở khi tải trang:** Safari trên iOS đòi `getUserMedia` nằm trong một cử chỉ người dùng thì mới đáng tin; tự xin quyền lúc tải trang dễ bị chặn im lặng và nhân viên chỉ thấy màn hình đen mà không hiểu vì sao. Bấm một lần đầu ca, sau đó camera chạy suốt.

## 8. Ràng buộc giữ nguyên

- **Cổng giờ `daMoCheckin` KHÔNG áp cho đường admin.** Code hiện tại đã chủ ý như vậy (`check-in/route.ts:38-39`) — ops phải mở check-in sớm được nếu khách tới trước giờ. Trang `/admin/quet-qr` và `/api/admin/checkin` đều không gọi cổng này.
- **Không nhận tên/email từ client.** Thẻ xác nhận dựng hoàn toàn từ dữ liệu server trả theo mã, đúng nguyên tắc `gui-mail/route.ts:10-13`.
- **HTTPS.** Camera chỉ chạy trong secure context. Vercel có sẵn; dev local `localhost` cũng được tính là secure context.

## 9. Kiểm thử

**Unit / integration (`npm test`):**

- `ma-tu-qr.test.ts` — URL đầy đủ; URL kèm query/hash; mã trần; chữ thường; khác domain; QR wifi; chuỗi rỗng; chuỗi có khoảng trắng thừa.
- `export-rows.test.ts` — sửa ca đang chốt `"qr"` (dòng 108) thành `"(QR)"`; thêm ca `admin` → `"(Admin CheckIn)"`; thêm ca `null` → `""`.
- `sheets.test.ts` — `buildCheckinUpdate` với `checkedInAt = null` phải ra đúng `["—", "", ""]`.
- `tra-ma/route.test.ts` — 401 khi chưa đăng nhập; 400 mã sai định dạng; 404 mã không tồn tại; 200 trả đúng bản rút gọn **và không chứa `email` / `sdt` / `facebook`**.
- `admin/checkin/route.test.ts` — ghi Supabase thành công vẫn trả `ok` khi Sheet ném lỗi.

**Thử tay bắt buộc trước 30/08 — không unit test được:**

1. iPhone thật, Safari — quét QR hiển thị trên màn hình một điện thoại khác.
2. Android thật, Chrome — như trên.
3. Quét QR **in ra giấy** từ email.
4. Từ chối quyền camera → xác nhận ô nhập mã tay dùng được.
5. Quét một mẹ đã check-in → xác nhận thấy nút phụ "Check-in lại", không phải nút chính.
6. Sau khi quét, mở Google Sheet xác nhận ba ô check-in đã điền và cột cuối ghi `(Admin CheckIn)`.

## 10. Lưu ý vận hành

**Nhân viên phải đăng nhập `/admin` vào sáng ngày 30/08.** Cookie phiên sống 12 giờ (`login/route.ts:28`); ai đăng nhập từ tối hôm trước sẽ bị đá ra giữa lúc hàng đang dài, và mất luôn camera đang mở.

## 11. Trạng thái đã biết sau khi code xong (cập nhật 05/08/2026)

Đã triển khai xong trên nhánh `feat/quet-qr-checkin` (11 commit, 293 test xanh).
Review toàn nhánh đã chạy và các lỗi Critical/Important đã sửa. Dưới đây là những
gì **cố ý để lại**, ghi ra để không ai tưởng là bỏ sót.

**Ba chỗ SPEC/PLAN NÀY VIẾT SAI, code đã sửa khác đi.** Đừng chép lại từ plan:

1. **`QrScanner.hasCamera()` đã bị BỎ.** Nó gọi `enumerateDevices()` mà chưa xin
   quyền; WebKit giấu danh sách thiết bị trước khi có quyền, nên iPhone thật sẽ
   báo "Máy này không có camera dùng được" và khoá cả ca vào ô nhập tay. Để
   `start()` hỏng rồi báo lỗi thật thì đúng hơn.
2. **`setMan({loai:"quet"})` phải chạy TRƯỚC `await scanner.start()`.** Khung
   `<video>` nằm trong thẻ cha có `hidden`; `qr-scanner` có lớp bảo vệ cho Safari
   nhưng nó đọc `getComputedStyle` của **chính thẻ video**, không đọc thẻ cha —
   nên bị vô hiệu im lặng, overlay đo 0×0 và iOS nhiều khả năng dừng phát.
3. **`destroy()` KHÔNG đủ để tắt camera.** `start()` đặt `_active = false` trước
   khi ném lỗi, nên `destroy()` → `stop()` → `pause()` thoát sớm và không chạy
   đoạn tắt stream. Phải tự `getTracks().forEach(t => t.stop())` và `srcObject =
   null`, nếu không lượt "Bật camera" sau sẽ phát lại stream chết.

**Hai điểm chấp nhận sống chung**, đều hỏng theo hướng an toàn:

- `.start().catch()` trong `quetTiep` và hai chỗ `setMan` trong `batCamera` không
  nằm sau bộ chặn thứ tự phản hồi. Xấu nhất: thẻ của một mẹ bị màn báo lỗi camera
  đè lên và phải quét lại. **Không bao giờ** check-in nhầm mẹ, **không bao giờ**
  hiện màn xanh giả.
- `ghiCheckin` hết 15 giây sẽ báo "Chưa ghi được check-in" kể cả khi server đã ghi
  xong. Bấm "Thử lại" đọc lại DB và hiện đúng "Đã check-in lúc …".

**Chưa làm:** 13 mục thử tay trên máy thật ở §9 — iPhone thật, Android thật, QR in
giấy, bật chế độ máy bay. Đây là điều kiện bắt buộc trước 30/08 và không có test
tự động nào thay được: `vitest.config.ts` chạy `environment: "node"` và chỉ nhận
`src/**/*.test.ts`, nên toàn bộ component `.tsx` không có test — quyết định có chủ
đích, xem §9.

## 12. Ngoài phạm vi

- Bảng lịch sử check-in / audit log (quyết định #5).
- Chế độ offline hoặc hàng đợi ghi khi mất mạng.
- Phân quyền nhiều tài khoản admin — hệ thống hiện chỉ có một cặp env-cred.
- Thống kê thời gian thực trên trang quét (đã có `checkedInCount` ở `/admin`).
- Gửi email hàng loạt — **tính năng riêng, spec riêng**, brainstorm sau khi tính năng này xong.
