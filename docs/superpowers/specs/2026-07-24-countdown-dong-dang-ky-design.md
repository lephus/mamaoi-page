# Countdown ở hero + đóng đăng ký sau 30/08/2026

**Ngày:** 24/07/2026
**Trạng thái:** đã chốt với khách nội bộ (Phú), copy chưa được khách cuối duyệt

## Vấn đề

Hero trang chủ đang treo badge tĩnh `Miễn phí · Giới hạn 500 mẹ bỉm`. Nó nói
một sự thật không đổi, nên không tạo được sức ép thời gian — mà đăng ký chỉ mở
từ 25/07 tới 30/08/2026, đúng 37 ngày.

Sau khi sự kiện xong, mọi nút đăng ký vẫn bấm được và form vẫn nhận mẹ mới. Mẹ
đăng ký lúc đó nhận email xác nhận kèm mã QR cho một sự kiện đã diễn ra.

## Mốc thời gian

Hạn đóng đăng ký: **HẾT ngày 30/08/2026 giờ VN** = `2026-08-31T00:00:00+07:00`
= `2026-08-30T17:00:00.000Z`.

Lưu dạng UTC có `Z` trong `EVENT.dongDangKyISO`. KHÔNG viết
`"2026-08-30T23:59"`: server Vercel chạy UTC, chuỗi không mang múi giờ bị đọc
là 23:59 UTC = 06:59 sáng 31/08 giờ VN — server đóng trễ 7 tiếng và lệch hẳn
với đồng hồ trên máy mẹ.

Đây là hạn cuối ngày sự kiện, không phải giờ sự kiện bắt đầu: khách muốn nhận
đăng ký tại chỗ suốt ngày 30/08.

## Kiến trúc

Ba đơn vị, mỗi đơn vị một việc:

| Đơn vị | Việc | Phụ thuộc |
|---|---|---|
| `src/lib/countdown.ts` | Thuần toán, không React: `conLai(nowMs)` → `{ngay,gio,phut,giay}` hoặc `null` khi hết hạn | `EVENT` |
| `src/components/Countdown.tsx` (`"use client"`) | Widget 4 ô + hai hook: `useConLai()` (tick mỗi giây) và `useDaDongDangKy()` (boolean) | `countdown.ts` |
| `src/components/NutDangKy.tsx` (`"use client"`) | Bọc `AnchorButton`, tự chuyển trạng thái inert khi hết hạn | `Countdown.tsx` |

### Vì sao hai hook riêng

Ba nút CTA chỉ cần biết *đã đóng chưa* — một boolean lật đúng một lần. Cho
chúng dùng chung hook tick-mỗi-giây là bốn timer vẽ lại hero liên tục để trả
lời một câu hỏi yes/no. `useDaDongDangKy` đặt MỘT `setTimeout` đúng bằng số ms
còn lại, không tick.

**Bẫy `setTimeout`:** delay vượt `2^31-1` ms (~24,8 ngày) bị tràn và bắn NGAY
lập tức. Hạn còn 37 ngày tính từ hôm nay, nên `setTimeout(fn, conLai)` không
canh gì cả mà đóng đăng ký ngay khi mẹ mở trang. Quá hạn ngưỡng đó thì không
đặt timer — không ai mở một tab liên tục 25 ngày.

### Hydration

`/` là trang tĩnh (không dùng API động nào) → HTML sinh lúc **build**, có thể
cách thời điểm mẹ mở trang hàng tuần. Nên:

- Server KHÔNG render số. Bốn ô hiện `--` cho tới khi mount.
- Cả hai hook trả `undefined` trước khi mount, nghĩa là "chưa biết giờ máy mẹ".
- Nút giữ nguyên trạng thái bấm được khi `undefined`: đoán sai theo hướng chặn
  nhầm mẹ tệ hơn nhiều so với hiện thừa một nút trong một nhịp.

Render số lúc build vừa sai vừa gây hydration mismatch.

## Thay đổi theo file

| File | Thay đổi |
|---|---|
| `src/lib/constants.ts` | Thêm `EVENT.dongDangKyISO`; thêm cụm copy `DA_DONG` |
| `src/app/page.tsx:237` | Badge → `<Countdown />` |
| `src/app/page.tsx:266,634` | `AnchorButton` → `NutDangKy` |
| `src/components/Header.tsx` | CTA `#dang-ky` dùng `useDaDongDangKy()` |
| `src/components/ui/Button.tsx` | `AnchorButton` nhận `disabled` |
| `src/components/RegistrationForm.tsx` | Nhánh `daDong` trước nhánh `hetCho` |
| `src/app/api/dang-ky/route.ts` | Cổng chặn theo hạn, đứng trước cổng 500 chỗ |

## Trạng thái sau hạn

- **Widget:** bốn ô → một viên thuốc `Mama Ơi Day đã kết thúc`. Giữ chỗ trong
  bố cục nên hero không sụt xuống.
- **Ba nút CTA:** chuyển sang dáng inert (nền trắng, viền xám, chữ `ink-faded`,
  `cursor-not-allowed`), đổi chữ thành `Đã đóng đăng ký`, không cuộn đi đâu.
  Render `<span aria-disabled>` chứ không `<a>` bỏ `href` — anchor không href
  vẫn nhận focus ở vài trình duyệt và trình đọc màn hình vẫn đọc là link.
- **Form:** thay nút submit bằng khối thông báo đóng, dùng lại đúng khuôn của
  màn hình hết chỗ đã có.
- **Form nhận tin ứng dụng ở `/ung-dung`:** KHÔNG đụng tới. Đó là waitlist app,
  không phải đăng ký sự kiện, và chính là chỗ khối thông báo đóng trỏ mẹ tới.

## Chặn ở server

Chặn phía client là chặn *cái nút*, không phải *việc đăng ký*: một tab mở sẵn
từ hôm trước, hoặc một cú `curl`, vẫn gửi được sau hạn.

`POST /api/dang-ky` kiểm tra hạn NGAY TRƯỚC cổng chặn 500 chỗ (cùng lý do: phải
đứng trước Brevo, đặt sau thì mẹ đã nhận email xác nhận kèm mã QR rồi mới bị
báo là muộn). Quá hạn → 409 kèm `closed: true`.

Form đọc `closed` và hiện khối đóng kể cả khi đồng hồ máy mẹ chạy chậm — server
là trọng tài, client chỉ là lớp hiển thị đoán trước.

Chỉ áp cho `isRegistration(data)`; waitlist app không có hạn.

## Test

- `countdown.test.ts` — phép chia ngày/giờ/phút/giây, mốc hết hạn (`<= 0` → `null`),
  và khẳng định `dongDangKyISO` đúng là 23:59:59.999 ngày 30/08 giờ VN.
- `route.test.ts` — quá hạn trả 409 `closed`, không chạm Brevo; trước hạn đi
  bình thường; waitlist không dính. Dùng `vi.setSystemTime`.
- Playwright — countdown chạy thật trên trang, ba nút xám sau hạn, form hiện
  khối đóng.

## Chưa chốt

Toàn bộ copy trong `DA_DONG` là chữ tôi viết, **chưa được khách duyệt** — giống
`HET_CHO`. Khách sửa chữ thì sửa ở `constants.ts`, không đụng logic.
