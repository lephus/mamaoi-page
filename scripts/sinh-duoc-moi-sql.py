"""Sinh supabase/2026-08-06-duoc-moi.sql từ sheet `register` của file Excel chốt
danh sách khách mời.

    python3 scripts/sinh-duoc-moi-sql.py "/duong/dan/MamaOi – Đăng ký.xlsx"

File Excel nằm NGOÀI repo (chứa PII của 1003 người) nên đường dẫn truyền vào,
không hardcode. Bộ sinh này được commit để lần nạp lại sau còn tái lập được
chính xác cách 518 mã kia được chọn.
"""
import re, sys, openpyxl

XLSX = sys.argv[1] if len(sys.argv) > 1 else '/Users/lehuuphu/Downloads/MamaOi – Đăng ký.xlsx'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'supabase/2026-08-06-duoc-moi.sql'

ws = openpyxl.load_workbook(XLSX, data_only=True)['register']
hdr = [c for c in next(ws.iter_rows(values_only=True))]
i = hdr.index('Mã check-in')
codes = sorted({str(r[i]).strip() for r in ws.iter_rows(min_row=2, values_only=True) if r[i]})

# Hai cổng chặn. Một mã méo hoặc thiếu mã lọt vào `not in (...)` là ẩn nhầm mẹ
# thật, mà file SQL 518 dòng thì không ai soi ra bằng mắt. Thà dừng còn hơn ghi.
bad = [c for c in codes if not re.fullmatch(r'MO-[A-Z0-9]{6}', c)]
if bad:
    sys.exit(f'Mã sai định dạng, dừng: {bad}')
if len(codes) != 518:
    sys.exit(f'Chờ 518 mã, đọc được {len(codes)}. Dừng để người kiểm lại.')

lines = ',\n'.join('    ' + ', '.join(f"'{c}'" for c in codes[k:k + 6]) for k in range(0, len(codes), 6))
open(OUT, 'w', encoding='utf-8').write(f'''-- Ẩn khỏi /admin những đăng ký KHÔNG nằm trong danh sách khách mời đã chốt.
--
-- Danh sách khách mời là {len(codes)} mã check-in trong sheet `register` của file
-- "MamaOi – Đăng ký.xlsx" (bản 06/08/2026, ops chốt tay từ 1003 lượt đăng ký).
-- Sinh tự động bởi scripts/sinh-duoc-moi-sql.py — đừng sửa tay danh sách bên dưới.
--
-- Khoá đối chiếu là `checkin_code` chứ KHÔNG phải email: ops đã sửa email của 4
-- mẹ sau khi xuất file (meomeodat@gnail.com -> @gmail.com, tuan8150@gmail.cm ->
-- .com, ...). Đối chiếu bằng email là ẩn oan đúng 4 mẹ đó. Mã check-in bất biến.
--
-- CHẠY TAY trong Supabase SQL editor TRƯỚC KHI deploy code đọc cột này. Chỉ
-- thêm cột và cập nhật cờ, KHÔNG xoá dòng nào. Chạy lại nhiều lần vẫn an toàn.
-- Kiểm trước khi chạy:  select count(*) from registrations;   -- kỳ vọng 1003

alter table registrations
  add column if not exists duoc_moi boolean not null default true;

-- `created_at <` là LƯỚI AN TOÀN, không phải trang trí: thiếu nó, chạy lại file
-- này sau 06/08 sẽ ẩn mất mọi đăng ký ops tạo tay về sau — đúng thứ mà default
-- `true` sinh ra để bảo vệ.
update registrations set duoc_moi = false
where created_at < '2026-08-06T00:00:00+07:00'
  and checkin_code not in (
{lines}
  );

-- Kỳ vọng sau khi chạy: 517 true, 486 false, 0 dòng false mà đã check-in.
-- select count(*) filter (where duoc_moi)      from registrations;  -- 517
-- select count(*) filter (where not duoc_moi)  from registrations;  -- 486
-- select count(*) from registrations where not duoc_moi and checked_in;  -- 0
''')
print(f'Đã ghi {OUT}: {len(codes)} mã')
