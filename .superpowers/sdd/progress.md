# SDD Progress — 2026-07-20-google-sheets-mirror

Branch: feat/google-sheets-mirror
Plan: docs/superpowers/plans/2026-07-20-google-sheets-mirror.md
Spec: docs/superpowers/specs/2026-07-20-google-sheets-mirror-design.md

STATUS: chưa bắt đầu.

## Tasks
- [ ] Task 1 — hàm thuần `registrationToSheetRow` + 7 unit test
- [ ] Task 2 — xác thực Google (JWT tự ký) + append + .env.example
- [ ] Task 3 — đấu nối `POST /api/dang-ky` + xác minh thật

## Pre-flight (2026-07-20)
- `src/lib/sheets.ts` ĐÃ TỪNG tồn tại, bị gỡ ở 50d2b34 cùng `google-auth-library`.
  Đó là quyết định THAY THẾ (Supabase thay Sheets), không phải Sheets hỏng.
  Nay user muốn cả hai → dựng lại là mở rộng, không mâu thuẫn. Spec đã ghi lại
  lịch sử này ở mục "Lịch sử: bản Sheets cũ đã bị gỡ".
- Bản cũ dùng USER_ENTERED + hack dấu `'` cho SĐT. Bản mới dùng RAW — vừa giữ
  số 0 vừa bịt formula injection. ĐỪNG quay lại USER_ENTERED.
- Google Sheet đích: 1OARjeV73t1OvUL7HvJTAG1Hbz_rvZs2q6AiWqgySuyE
  User xác nhận HOÀN TOÀN TRỐNG → không có header 12 cột cũ để đụng độ.
  GOOGLE_SHEET_ID trong .env.local đã khớp sheet này (verified).

## Kế thừa từ ledger cũ (2026-07-16-checkin-qr-admin) — ngoài phạm vi, không tự sửa
- Task 11 của plan CŨ chưa xong (.env.example + E2E). Task 2 của plan NÀY cũng
  sửa .env.example → nếu thấy khối GOOGLE_* đã có sẵn thì chỉ cần bổ sung phần thiếu.
- ADMIN_PASSWORD nằm clear-text trong 2 file .md đã push lên origin/main.
  User đã biết và chấp nhận ("lộ k sao, kệ"). KHÔNG nhắc lại, KHÔNG tự sửa.
- RLS đang TẮT theo lựa chọn của user. Guard rail: không bao giờ để key Supabase
  lọt ra client (không NEXT_PUBLIC_SUPABASE_*).

## Tiến độ
- Task 1: complete (commit 15dd6da..bac96b1, review clean — spec ✅, quality Approved)

## Minor findings tồn đọng (final review phân loại lại)
- [Task 1, đang xử lý ở Task 2] Typo comment `sheets.ts:17` "mảy cột" → "mảng cột".
- [Task 1, plan-mandated] `registrationToSheetRow` gọi `new Date()` bên trong nên
  không thuần đúng nghĩa, dù task đặt tên "hàm thuần". Là quyết định của spec
  (Quyết định 2: Sheets độc lập Supabase nên tự sinh timestamp). Không test nào
  assert cột "Thời điểm đăng ký" nên không che giấu lỗi. Để nguyên, chỉ ghi nhận.
- [Task 1, plan-mandated] `id: ""` là trường giả do tái dùng `RegistrationRow`.
  `rowsToSheet` không xuất id nên vô hại. Ghi nhận, không sửa.
- Task 2: complete (commits f61d896..912dd9a, review clean sau 1 vòng fix)
      Fix: race `ensureHeader` (bool → memoized promise), gỡ spread header vô nghĩa.

## Minor bổ sung sau review Task 2 (final review phân loại lại)
- `accessToken()` không dedup in-flight: N request đồng thời cùng ký JWT và cùng
  gọi TOKEN_URL. Không hỏng dữ liệu (token nào cũng hợp lệ, last-write-wins),
  chỉ tốn round-trip trong thời gian mẹ đang chờ. Sửa được bằng đúng pattern
  memoized promise của ensureHeader.
- `ensureHeader` chỉ đọc ô A1 → "đã có header" thực chất là "A1 khác rỗng".
  Nếu ops gõ chữ gì đó vào A1 thì header 15 cột sẽ không bao giờ được ghi.
- Cross-instance: mỗi Vercel instance lạnh đều có headerPromise = null, nên N
  instance cùng gặp Sheet rỗng vẫn có thể ghi header nhiều lần. Không giải được
  bằng bộ nhớ tiến trình. Sheet hiện trống nên chỉ đi qua trạng thái này một lần.

## RỦI RO CHƯA CHỨNG MINH — Task 3 phải kiểm
Google `values:append` neo ở range A1. Dòng ghi chú là 1 ô, dòng header là 15 ô.
Chưa rõ Google nhận diện "table" là A1:O2 hay chỉ cột A. Nếu nhận nhầm, dữ liệu
sẽ dồn vào cột A thay vì trải A3:O3. PHẢI nhìn Sheet thật mới biết.
Nếu lệch: bỏ dòng ghi chú, hoặc đổi neo sang A2, hoặc pad dòng ghi chú đủ 15 ô.
