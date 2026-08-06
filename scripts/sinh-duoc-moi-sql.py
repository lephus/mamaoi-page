"""Sinh supabase/2026-08-06-duoc-moi.sql từ sheet `register` của file Excel chốt
danh sách khách mời.

    python3 scripts/sinh-duoc-moi-sql.py "/duong/dan/MamaOi – Đăng ký.xlsx" [duong/dan/ra.sql]

File Excel nằm NGOÀI repo (chứa PII của 1003 người) nên đường dẫn BẮT BUỘC phải
truyền vào, không hardcode — thiếu tham số này thì dừng ngay bằng thông báo cách
dùng thay vì âm thầm đọc nhầm máy của người khác. Tham số thứ hai (đường dẫn file
SQL xuất ra) tuỳ chọn, mặc định `supabase/2026-08-06-duoc-moi.sql`.

Bộ sinh này được commit để lần nạp lại sau còn tái lập được chính xác cách 518
mã kia được chọn — và để mỗi lần Excel đổi, chạy lại script là đủ, không ai phải
tay sửa danh sách mã trong file SQL.
"""
import re, sys, openpyxl

if len(sys.argv) < 2:
    sys.exit(
        'Dùng: python3 scripts/sinh-duoc-moi-sql.py "/duong/dan/MamaOi – Đăng ký.xlsx" '
        "[duong/dan/ra.sql]"
    )

XLSX = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else 'supabase/2026-08-06-duoc-moi.sql'

ws = openpyxl.load_workbook(XLSX, data_only=True)['register']
hdr = [c for c in next(ws.iter_rows(values_only=True))]
i = hdr.index('Mã check-in')
codes = sorted({str(r[i]).strip() for r in ws.iter_rows(min_row=2, values_only=True) if r[i]})

# Hai cổng chặn. Một mã méo hoặc thiếu mã lọt vào danh sách là ẩn oan hoặc hiện
# oan một mẹ thật, mà file SQL 518 dòng thì không ai soi ra bằng mắt. Thà dừng
# còn hơn ghi.
bad = [c for c in codes if not re.fullmatch(r'MO-[A-Z0-9]{6}', c)]
if bad:
    sys.exit(f'Mã sai định dạng, dừng: {bad}')
if len(codes) != 518:
    sys.exit(f'Chờ 518 mã, đọc được {len(codes)}. Dừng để người kiểm lại.')


def render_codes(codes: list[str]) -> str:
    """6 mã một dòng, thụt 4 khoảng trắng. Cả hai mệnh đề update bên dưới gọi
    hàm này với CÙNG một `codes` — danh sách 518 mã chỉ được định dạng một lần,
    để soát bằng mắt (hoặc diff giữa hai lần sinh) không phải soát hai bản có
    thể trôi lệch nhau."""
    return ',\n'.join('    ' + ', '.join(f"'{c}'" for c in codes[k:k + 6]) for k in range(0, len(codes), 6))


lines = render_codes(codes)

with open(OUT, 'w', encoding='utf-8') as f:
    f.write(f'''-- Ẩn khỏi /admin những đăng ký KHÔNG nằm trong danh sách khách mời đã chốt.
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
-- thêm cột và cập nhật cờ, KHÔNG xoá dòng nào.
--
-- CHẠY LẠI NHIỀU LẦN VẪN AN TOÀN — nhưng "an toàn" ở đây nghĩa là: mỗi lần chạy,
-- file này đưa `duoc_moi` của MỌI dòng tạo trước 06/08 về ĐÚNG BẰNG danh sách
-- {len(codes)} mã dưới đây, không hơn không kém. Nếu giữa hai lần chạy có ai đó
-- chỉnh tay `duoc_moi` của một mã (kể cả theo đúng hướng dẫn khôi phục ở §7 của
-- spec, `update ... set duoc_moi = true where checkin_code = '…'`), lần chạy sau
-- sẽ GHI ĐÈ chỉnh tay đó — file không biết gì ngoài Excel. Muốn hiện lại VĨNH
-- VIỄN một mẹ: thêm mã của mẹ đó vào sheet `register` rồi sinh lại file này,
-- đừng chỉnh cờ tay rồi kỳ vọng nó sống sót qua lần chạy kế tiếp.
-- Kiểm trước khi chạy:  select count(*) from registrations;   -- kỳ vọng 1003

alter table registrations
  add column if not exists duoc_moi boolean not null default true;

-- `created_at <` là LƯỚI AN TOÀN, không phải trang trí: thiếu nó, cặp update
-- dưới đây sẽ động tới mọi đăng ký ops tạo tay về sau — đúng thứ mà default
-- `true` sinh ra để bảo vệ.
--
-- Cặp update ĐỐI XỨNG có chủ đích, nhánh `true` đi trước nhánh `false`, cả hai
-- cùng đọc một danh sách {len(codes)} mã: Excel là nguồn sự thật DUY NHẤT, theo
-- CẢ HAI CHIỀU. Nếu chỉ có nhánh `false` (ẩn), file trở thành một con dao một
-- chiều — ops thêm một mẹ vào Excel rồi sinh lại file thì `not in` chỉ đơn giản
-- thôi không còn khớp dòng của mẹ đó nữa, không có gì chủ động ĐẶT LẠI `true`
-- cho cô ấy, nên "chạy lại vẫn an toàn" sẽ chỉ đúng một nửa. Có cả hai nhánh thì
-- chạy lại luôn đưa hệ thống về đúng ảnh chụp Excel hiện tại, bất kể trạng thái
-- trước đó là gì.
update registrations set duoc_moi = true
where created_at < '2026-08-06T00:00:00+07:00'
  and checkin_code in (
{lines}
  );

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
