-- Ẩn khỏi /admin những đăng ký KHÔNG nằm trong danh sách khách mời đã chốt.
--
-- Danh sách khách mời là 518 mã check-in trong sheet `register` của file
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
    'MO-23F3J9', 'MO-23Q7SQ', 'MO-23QSHS', 'MO-256HLC', 'MO-25SU3R', 'MO-28XB9H',
    'MO-2927RR', 'MO-2BAHV3', 'MO-2F4C7K', 'MO-2JETVZ', 'MO-2LYP9U', 'MO-2N5RZS',
    'MO-2V6KAM', 'MO-2VNZYJ', 'MO-2XVFGB', 'MO-2Y36RX', 'MO-2Z4XQ7', 'MO-347JDH',
    'MO-37DUM3', 'MO-385F5V', 'MO-39KHTZ', 'MO-3C2NQ9', 'MO-3DDEC4', 'MO-3DVQ45',
    'MO-3EBEAQ', 'MO-3FCR5E', 'MO-3FRZ4Z', 'MO-3L9TWL', 'MO-3MPCHG', 'MO-3PAFFA',
    'MO-3PLTFY', 'MO-3QSZ5W', 'MO-3RH3UR', 'MO-3XFJQR', 'MO-44K9NZ', 'MO-464J7W',
    'MO-476XW9', 'MO-48YUMS', 'MO-4B667U', 'MO-4BBLG3', 'MO-4EXYP7', 'MO-4F5AEB',
    'MO-4FJD9H', 'MO-4GWSWU', 'MO-4JFMW2', 'MO-4KAB86', 'MO-4LG6LT', 'MO-4NJSF8',
    'MO-4NWEKV', 'MO-4UQ4BT', 'MO-4WY537', 'MO-4ZKGB7', 'MO-525XTQ', 'MO-529YJM',
    'MO-53Y2RC', 'MO-54PU64', 'MO-556EJR', 'MO-55WEPB', 'MO-56KX9J', 'MO-57K2NE',
    'MO-58A5J3', 'MO-58XC8B', 'MO-599KK2', 'MO-59BKYD', 'MO-5A4SB3', 'MO-5A4XRR',
    'MO-5APMF8', 'MO-5FXGP2', 'MO-5JMJPF', 'MO-5MPQ8Q', 'MO-5NHCR2', 'MO-5P8X8J',
    'MO-5QBUQP', 'MO-5RPPDB', 'MO-5RUYM3', 'MO-5VRPUC', 'MO-5W3DUS', 'MO-5XULBA',
    'MO-65QN7H', 'MO-66B2CW', 'MO-66RJBT', 'MO-678Y98', 'MO-6A98UM', 'MO-6DJJV5',
    'MO-6LVZJE', 'MO-6MMJEP', 'MO-6MUKZH', 'MO-6SKRFF', 'MO-6Z4UH5', 'MO-6ZHSN8',
    'MO-72PNWA', 'MO-76ECAM', 'MO-79YP3H', 'MO-7CKQ9K', 'MO-7FMWST', 'MO-7G34SQ',
    'MO-7GCWBF', 'MO-7K4Y5Y', 'MO-7KSTLE', 'MO-7MPKZV', 'MO-7R6ZRB', 'MO-7USGGL',
    'MO-7VFJMP', 'MO-857V2M', 'MO-86GHY9', 'MO-899UJ8', 'MO-8DD9LA', 'MO-8DQNKU',
    'MO-8EEWDE', 'MO-8EU9J2', 'MO-8EZNQM', 'MO-8GXAGL', 'MO-8K393V', 'MO-8K63ED',
    'MO-8KVP4C', 'MO-8MF5SF', 'MO-8QWJLG', 'MO-8R2YU9', 'MO-8TLH6K', 'MO-8U4WXJ',
    'MO-8U7PRP', 'MO-8X84MZ', 'MO-8X9YQ2', 'MO-8YA8ME', 'MO-92P8VF', 'MO-94YVUG',
    'MO-98KRAP', 'MO-98W5HZ', 'MO-999CZ2', 'MO-9ABQ87', 'MO-9BC6F6', 'MO-9CP3VT',
    'MO-9D97NC', 'MO-9DPCEK', 'MO-9FFUAZ', 'MO-9GVHFM', 'MO-9LX4PN', 'MO-9M8SDA',
    'MO-9QEF2A', 'MO-9R4HZ6', 'MO-9R7RHK', 'MO-9RBDEA', 'MO-9S2N3R', 'MO-9U58V8',
    'MO-9XGKK3', 'MO-A52857', 'MO-A5RRCU', 'MO-A8M5JE', 'MO-A9F9W2', 'MO-A9V9BQ',
    'MO-AA8DYD', 'MO-AGY3L9', 'MO-AKX57H', 'MO-ALBB9A', 'MO-AQ63UX', 'MO-AR9MFZ',
    'MO-ARLKP7', 'MO-ASLZTN', 'MO-AUNMJP', 'MO-AWK2PN', 'MO-AWTJK2', 'MO-AX6H9M',
    'MO-AY5RUY', 'MO-AZNHK6', 'MO-B3M9JH', 'MO-B5MG56', 'MO-B7DGCR', 'MO-B8FF67',
    'MO-B8RMP6', 'MO-BANY73', 'MO-BDA258', 'MO-BHN28M', 'MO-BJC6BJ', 'MO-BJUWWG',
    'MO-BRTTST', 'MO-BTNTVT', 'MO-BXHX33', 'MO-BXMQV6', 'MO-BY2JEU', 'MO-BZPJ3X',
    'MO-C2MZWG', 'MO-C376P5', 'MO-C3MLQZ', 'MO-C66AYB', 'MO-C6CF9S', 'MO-C8GLRW',
    'MO-CAMFLP', 'MO-CAMLWV', 'MO-CCEA47', 'MO-CF22NL', 'MO-CF782A', 'MO-CJ9QZJ',
    'MO-CLP68G', 'MO-CMHHZ5', 'MO-CN2WHF', 'MO-CTEE3X', 'MO-D438YH', 'MO-D6QUW8',
    'MO-D7GLKF', 'MO-DABN5V', 'MO-DCQRWH', 'MO-DCUTC8', 'MO-DCYTBW', 'MO-DD9DE8',
    'MO-DGDGE8', 'MO-DGYPEP', 'MO-DHCTFL', 'MO-DHDUPK', 'MO-DJ5H2R', 'MO-DKT26F',
    'MO-DN9LE9', 'MO-DNZK3X', 'MO-DP5U2V', 'MO-DQBBU8', 'MO-DQNWQT', 'MO-DR23LC',
    'MO-DTY8YH', 'MO-DX3CLS', 'MO-E632D6', 'MO-E6RZQG', 'MO-EAXXCL', 'MO-EDX577',
    'MO-EHFZBZ', 'MO-EHRAG2', 'MO-ELJZAG', 'MO-EMKNFE', 'MO-ENPAMZ', 'MO-EQVXXR',
    'MO-ET8TNM', 'MO-ETKDF5', 'MO-EW8FT6', 'MO-EXZ8MJ', 'MO-EZR5M4', 'MO-F22NWG',
    'MO-F4FEKL', 'MO-F4XN85', 'MO-F7CMVB', 'MO-F8A3DM', 'MO-F8K7MR', 'MO-FAU4D3',
    'MO-FBLMNK', 'MO-FEEVJL', 'MO-FJJU4X', 'MO-FMRTZY', 'MO-FPZ3GS', 'MO-FRVMUT',
    'MO-FS49F8', 'MO-FTNWL9', 'MO-FWHLEY', 'MO-FWVQUX', 'MO-G4MR8X', 'MO-G4W4FE',
    'MO-G5WT5F', 'MO-G7AW63', 'MO-G9K5DT', 'MO-G9ZHUV', 'MO-GA98DH', 'MO-GC68C8',
    'MO-GDWL3A', 'MO-GJSVHF', 'MO-GKQKRA', 'MO-GM2VKT', 'MO-GPL9Z2', 'MO-GS5JX2',
    'MO-GSJPMP', 'MO-GXYZ7M', 'MO-GYVRJQ', 'MO-H2S4FL', 'MO-H3QW5T', 'MO-H4P3RJ',
    'MO-H5P3LN', 'MO-H6NVSD', 'MO-H76H88', 'MO-H9X95R', 'MO-HC5245', 'MO-HDCT6L',
    'MO-HDECZW', 'MO-HG96GR', 'MO-HHW7LE', 'MO-HJUQD3', 'MO-HQLV5W', 'MO-HQYQRQ',
    'MO-HRMU7K', 'MO-HSDFR2', 'MO-HVGPF7', 'MO-HW9BDS', 'MO-J34EP2', 'MO-J45Y6C',
    'MO-J4QQXC', 'MO-JCM6QW', 'MO-JDNYAJ', 'MO-JDYWSV', 'MO-JEM69U', 'MO-JFMWS7',
    'MO-JGFMBX', 'MO-JKGG3L', 'MO-JL8GHF', 'MO-JLQCWS', 'MO-JQ7956', 'MO-JQB9MB',
    'MO-JVHGLY', 'MO-K2DUFB', 'MO-K3UPTA', 'MO-K86MAP', 'MO-K8QTC4', 'MO-KDYSLX',
    'MO-KHYW2N', 'MO-KKCW5D', 'MO-L3BADF', 'MO-L6GG2R', 'MO-L852VG', 'MO-LAEZXA',
    'MO-LALUXA', 'MO-LCPST6', 'MO-LEPDYJ', 'MO-LHQ5XV', 'MO-LJEL6M', 'MO-LLTZSC',
    'MO-LNCSSS', 'MO-LP6APV', 'MO-LWFHHW', 'MO-LYQFLX', 'MO-M2BTUC', 'MO-M8FF3X',
    'MO-MC5XKP', 'MO-MD4SGZ', 'MO-MEKQXX', 'MO-MKWWRT', 'MO-MLLGEB', 'MO-MNWZRY',
    'MO-MQ9CZU', 'MO-MV55T3', 'MO-N325AM', 'MO-N8DFMG', 'MO-NECP3K', 'MO-NGPB2W',
    'MO-NHS8RM', 'MO-NKEQEC', 'MO-NMB6K9', 'MO-NMCJ7Q', 'MO-NRC85H', 'MO-NSMR7H',
    'MO-NUL3X7', 'MO-NUTNFV', 'MO-NWU5G7', 'MO-NXCBXK', 'MO-NXTGJK', 'MO-NYE5JS',
    'MO-NZXMTX', 'MO-P3EDJN', 'MO-P4YT6N', 'MO-P55CDD', 'MO-P5CEAU', 'MO-P5PWK7',
    'MO-P5XEX5', 'MO-P6JJXE', 'MO-P6Z2KR', 'MO-P99MJS', 'MO-PEYL3B', 'MO-PGVEML',
    'MO-PJKMD5', 'MO-PMRQVB', 'MO-PRMTGY', 'MO-PTZJ32', 'MO-PUMMZL', 'MO-PWTQSW',
    'MO-PYAQX4', 'MO-PYZZU3', 'MO-Q5FCWX', 'MO-Q5WWAF', 'MO-Q66VNG', 'MO-QC42R2',
    'MO-QCV69P', 'MO-QLTBSF', 'MO-QME8NM', 'MO-QQKK3L', 'MO-QW6V7S', 'MO-QYUGYR',
    'MO-QZE9XP', 'MO-R27XU4', 'MO-R46W6S', 'MO-R4LKSP', 'MO-R6A2TN', 'MO-R8HEJ5',
    'MO-R8SN2E', 'MO-RBZGEF', 'MO-RDYVMB', 'MO-REX3F2', 'MO-REXK7E', 'MO-RFH5R7',
    'MO-RGB556', 'MO-RGYATD', 'MO-RK7HGV', 'MO-RLZ6CN', 'MO-RNEJ3A', 'MO-RSCFL2',
    'MO-RSNASJ', 'MO-RTRMNT', 'MO-RUA5MV', 'MO-RW7B85', 'MO-RYG2Y5', 'MO-RZ6E2F',
    'MO-S5YQXS', 'MO-S6NPBZ', 'MO-S8MHJ2', 'MO-SB8G72', 'MO-SEV59L', 'MO-SK22VA',
    'MO-SNQ245', 'MO-SQ3U6B', 'MO-SQVH8F', 'MO-SSFUF8', 'MO-SSRCLG', 'MO-SU22HV',
    'MO-SVU2X5', 'MO-T7JQM3', 'MO-T7N7CS', 'MO-T7TW4L', 'MO-T9TLYX', 'MO-TDJXMV',
    'MO-TDLML2', 'MO-TE8YDW', 'MO-TGTT6Q', 'MO-TJK2GU', 'MO-TK5GSR', 'MO-TMYYGD',
    'MO-TNWEZZ', 'MO-TQSZND', 'MO-TR7K4F', 'MO-TUV94E', 'MO-TW8779', 'MO-TYECN8',
    'MO-U9PJKY', 'MO-UAM7MV', 'MO-UFJJ9S', 'MO-UGEQXS', 'MO-UJTAWP', 'MO-UL4XR5',
    'MO-ULSSFJ', 'MO-UMAAR4', 'MO-UQPFVX', 'MO-UTE2Y3', 'MO-UWHC8K', 'MO-UXPQPE',
    'MO-UZQZG5', 'MO-V25KNY', 'MO-V2P787', 'MO-V38ATG', 'MO-V9H33D', 'MO-VHKKBU',
    'MO-VJMMX2', 'MO-VJYUBK', 'MO-VM237C', 'MO-VNNVS9', 'MO-VR6TZX', 'MO-VRQJZV',
    'MO-VSS8TW', 'MO-VTKUV9', 'MO-W3L9FC', 'MO-W4Q9PP', 'MO-W63PDF', 'MO-W6NKU7',
    'MO-W7U54R', 'MO-WCMMBQ', 'MO-WCSZYT', 'MO-WHK5C4', 'MO-WL6DHM', 'MO-WQFK3Z',
    'MO-WRTL8Y', 'MO-WSKP7J', 'MO-WVMZHF', 'MO-WXW3RR', 'MO-WYVHJR', 'MO-WZQ7SF',
    'MO-X2T9UN', 'MO-X6PEGE', 'MO-X7VCES', 'MO-X8JD5W', 'MO-X9VV9Z', 'MO-XBGEJ2',
    'MO-XC9G7M', 'MO-XEVLZB', 'MO-XGEYYV', 'MO-XKTZBG', 'MO-XNBN5N', 'MO-XRUHJD',
    'MO-XX7ZVM', 'MO-XXE6F7', 'MO-XY2FEP', 'MO-Y368CU', 'MO-Y5C96B', 'MO-Y6FYSA',
    'MO-Y86CQ9', 'MO-Y8TZY8', 'MO-YLNSL6', 'MO-YLQ474', 'MO-YND3A8', 'MO-YP2NYE',
    'MO-YQRQZH', 'MO-YRG9QQ', 'MO-Z49XC4', 'MO-Z6QA7D', 'MO-Z98HGF', 'MO-ZAMPND',
    'MO-ZDNGP4', 'MO-ZE7PBX', 'MO-ZEGZ4Y', 'MO-ZFNKWJ', 'MO-ZGFZYW', 'MO-ZH2FZM',
    'MO-ZPKA6L', 'MO-ZTGSWL', 'MO-ZTL592', 'MO-ZTVNW3', 'MO-ZU836W', 'MO-ZUYX7N',
    'MO-ZV8PGM', 'MO-ZZY4FF'
  );

-- Kỳ vọng sau khi chạy: 517 true, 486 false, 0 dòng false mà đã check-in.
-- select count(*) filter (where duoc_moi)      from registrations;  -- 517
-- select count(*) filter (where not duoc_moi)  from registrations;  -- 486
-- select count(*) from registrations where not duoc_moi and checked_in;  -- 0
