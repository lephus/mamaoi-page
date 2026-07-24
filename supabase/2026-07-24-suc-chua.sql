-- Giới hạn sức chứa sự kiện: giữ chỗ nguyên tử cho một lượt đăng ký.
-- CHẠY TAY trong Supabase SQL editor TRƯỚC KHI deploy code mới.
-- Chỉ tạo function, KHÔNG đụng bảng/dữ liệu. Chạy lại nhiều lần vẫn an toàn.
-- Kiểm tra sau khi chạy:  select giu_cho_dang_ky('{"email":"probe@x.y"}'::jsonb, 0);
--                          -- phải trả 'het_cho' (giới hạn 0), và KHÔNG ghi dòng nào.
--
-- Vì sao phải là function trong DB chứ không phải đếm rồi ghi ở route:
-- đếm ở route rồi mới insert để hở một khoảng giữa hai lệnh. Ngày mở đăng ký
-- (25/07) traffic dồn từ Facebook, hai request cùng đọc count = 499 trong cùng
-- mili-giây thì cả hai đều đi tiếp và ghi -> 501 mẹ. Ở đây đếm và ghi nằm
-- trong CÙNG một transaction, sau một khoá, nên không thể lọt.

create or replace function giu_cho_dang_ky(p_row jsonb, p_gioi_han int)
returns text
language plpgsql
as $$
declare
  v_email text := p_row->>'email';
  v_dem   int;
begin
  -- Khoá theo transaction: các lượt submit đồng thời xếp hàng qua đây, nên
  -- count() bên dưới không bao giờ đọc phải số cũ của một transaction khác
  -- đang ghi dở. Tự nhả khi transaction kết thúc — không có đường quên unlock.
  perform pg_advisory_xact_lock(hashtext('mamaoi_suc_chua'));

  -- Email đã có chỗ thì LUÔN đi tiếp, kể cả khi đã đủ 500. Mẹ này không chiếm
  -- thêm ghế nào — chặn ở đây là đuổi mẹ khỏi chỗ mẹ đang giữ, chỉ vì mẹ bấm
  -- gửi lại form để sửa số điện thoại. Route sẽ upsert làm mới thông tin.
  if exists (select 1 from registrations where email = v_email) then
    return 'da_dang_ky';
  end if;

  select count(*) into v_dem from registrations;
  if v_dem >= p_gioi_han then
    return 'het_cho';
  end if;

  -- jsonb_populate_record thay vì liệt kê tên cột: danh sách cột chỉ được phép
  -- tồn tại MỘT chỗ là registrationToRow() trong src/lib/supabase.ts. Chép lại
  -- 20 tên cột vào đây nghĩa là lần sau thêm field phải nhớ sửa cả hai nơi, và
  -- quên một bên thì dữ liệu mất âm thầm chứ không báo lỗi.
  --
  -- jsonb_build_object(...) đứng TRƯỚC rồi mới `|| p_row`: populate_record với
  -- null::registrations đặt NULL cho mọi cột vắng mặt (KHÔNG lấy DEFAULT của
  -- bảng), nên thiếu ba giá trị này thì id NULL và vi phạm primary key.
  insert into registrations
    select * from jsonb_populate_record(
      null::registrations,
      jsonb_build_object(
        'id',         gen_random_uuid(),
        'created_at', now(),
        'checked_in', false
      ) || p_row
    );
  return 'moi';
end $$;
