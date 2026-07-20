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
