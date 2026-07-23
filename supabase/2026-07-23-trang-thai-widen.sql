-- Nới CHECK constraint của cột `trang_thai` cho khớp form v2.
--
-- Bản v2 (2026-07-20) thêm HAI nhánh mới ở form + validation:
-- `chuan_bi_mang_thai` (Chuẩn bị mang thai) và `ivf` (IVF) — nhưng KHÔNG nới
-- constraint của `trang_thai`, vốn vẫn chỉ cho ('mang_thai','da_sinh').
--
-- Hệ quả: mẹ đăng ký với `chuan_bi_mang_thai` / `ivf` làm INSERT Supabase vi
-- phạm constraint và fail. Vì ghi Supabase là non-fatal (Brevo mới là nguồn sự
-- thật), lỗi bị nuốt: mẹ vẫn nhận email + mã check-in, nhưng KHÔNG có dòng nào
-- trong `registrations`. Khi mẹ bấm "Mở trang check-in", `findByCode` trả null
-- → trang báo "Không tìm thấy mã".
--
-- CHẠY TAY trong Supabase SQL editor. Chỉ NỚI (thêm giá trị hợp lệ), không đụng
-- dữ liệu cũ (mọi dòng hiện có đều là 'mang_thai'/'da_sinh', vẫn hợp lệ), an
-- toàn chạy lại nhiều lần.
alter table registrations
  drop constraint if exists registrations_trang_thai_check,
  add  constraint registrations_trang_thai_check
       check (trang_thai in ('chuan_bi_mang_thai','ivf','mang_thai','da_sinh'));
