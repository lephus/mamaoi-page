-- Gỡ function giữ chỗ trong Postgres. TUỲ CHỌN, chạy tay khi nào ops rảnh.
--
-- Sức chứa 500 giờ đếm từ cột Email của tab "register" trong Google Sheet
-- (`docEmailDaDangKy` trong src/lib/sheets.ts) theo yêu cầu của khách: ops nhìn
-- Sheet nên con số chặn phải là đúng con số ops nhìn thấy. Không còn dòng code
-- nào gọi `giu_cho_dang_ky` nữa, nên function này nằm lại trong DB mà không ai
-- gọi — vô hại, chỉ là rác.
--
-- KHÔNG chạy file này nếu định quay lại cách đếm cũ: function này là toàn bộ
-- phần nguyên tử (đếm và ghi trong CÙNG một transaction sau pg_advisory_xact_lock)
-- mà cách đếm trên Sheet không có. Muốn dựng lại thì lấy nội dung ở commit
-- d9a7b6f, file supabase/2026-07-24-suc-chua.sql.
--
-- Không đụng bảng/dữ liệu. Chạy lại nhiều lần vẫn an toàn.

drop function if exists giu_cho_dang_ky(jsonb, int);
