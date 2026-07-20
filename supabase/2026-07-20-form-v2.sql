-- Form đăng ký v2 + bảng waitlist.
-- CHẠY TAY trong Supabase SQL editor TRƯỚC KHI deploy code mới.
-- Chỉ thêm cột và constraint, KHÔNG drop gì. Chạy lại nhiều lần vẫn an toàn.
-- Kiểm tra lại trước khi chạy:  select count(*) from registrations;

alter table registrations
  add column if not exists thai_tuan       int,
  add column if not exists ten_be          text,
  add column if not exists be_ngay_sinh    date,
  add column if not exists be_gioi_tinh    text,
  add column if not exists chu_de_quan_tam text[] not null default '{}',
  add column if not exists chu_de_khac     text,
  add column if not exists nguon_biet_den  text;

alter table registrations
  drop constraint if exists registrations_thai_tuan_check,
  add  constraint registrations_thai_tuan_check
       check (thai_tuan is null or thai_tuan between 1 and 42);

alter table registrations
  drop constraint if exists registrations_be_gioi_tinh_check,
  add  constraint registrations_be_gioi_tinh_check
       check (be_gioi_tinh is null or be_gioi_tinh in ('nam','nu'));

-- Cố ý KHÔNG ràng buộc giá trị của chu_de_quan_tam: danh sách 9 chủ đề chưa
-- được khách chốt, và constraint ở đây sẽ phải sửa lockstep với constants.ts
-- mỗi lần danh sách đổi — quên một bên là đăng ký chết. Zod chặn ở đường ghi.
alter table registrations
  drop constraint if exists registrations_nguon_biet_den_check,
  add  constraint registrations_nguon_biet_den_check
       check (nguon_biet_den is null or nguon_biet_den in
              ('facebook','tiktok','instagram','ban_be','khac'));

-- Waitlist app: bảng riêng. KHÔNG gộp vào registrations — gộp thì phải nới
-- NOT NULL của ho_ten/sdt/tinh_thanh/checkin_code, tức gỡ lưới an toàn của
-- đăng ký sự kiện thật.
create table if not exists waitlist (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  email           text not null unique,
  dong_y_nhan_tin boolean not null default true
);
