import { describe, it, expect } from "vitest";
import { rowsToSheet } from "@/lib/export-rows";
import type { RegistrationRow } from "@/lib/supabase";

const base: RegistrationRow = {
  id: "uuid-1",
  created_at: "2026-07-20T03:00:00.000Z", // 10:00 20/07/2026 giờ VN
  checkin_code: "MO-23456A",
  ho_ten: "Nguyễn Thị Lan",
  email: "lan@example.com",
  sdt: "0901234567",
  facebook: null,
  tinh_thanh: "TP.HCM",
  trang_thai: "mang_thai",
  thai_tuan: 20,
  ten_be: null,
  be_ngay_sinh: null,
  be_gioi_tinh: null,
  be_thang_tuoi: null,
  chu_de_quan_tam: ["an_dam", "ngu"],
  nguon_biet_den: "facebook",
  di_cung_chong: true,
  dong_y_nhan_tin: true,
  nguon: "su-kien",
  checked_in: false,
  checked_in_at: null,
  checked_in_source: null,
};

describe("rowsToSheet", () => {
  it("có đúng 21 cột và không lộ id", () => {
    const { headers } = rowsToSheet([base]);
    expect(headers).toHaveLength(21);
    expect(headers).not.toContain("id");
    expect(headers[0]).toBe("Họ tên");
  });

  it("mỗi dòng dữ liệu khớp số cột của header", () => {
    const { headers, rows } = rowsToSheet([base]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(headers.length);
  });

  it("dịch trang_thai sang tiếng Việt", () => {
    expect(rowsToSheet([base]).rows[0]).toContain("Mang thai");
    expect(
      rowsToSheet([
        {
          ...base,
          trang_thai: "da_sinh",
          thai_tuan: null,
          ten_be: "Gạo",
          be_ngay_sinh: "2026-01-20",
          be_gioi_tinh: "nu",
          be_thang_tuoi: 6,
        },
      ]).rows[0],
    ).toContain("Đã sinh");
  });

  it("boolean thành Có / dấu gạch", () => {
    const r = rowsToSheet([{ ...base, di_cung_chong: false }]).rows[0];
    expect(r).toContain("—");
  });

  it("trường rỗng thành chuỗi rỗng, không phải null hay 'null'", () => {
    const r = rowsToSheet([base]).rows[0];
    expect(r).not.toContain(null);
    expect(r).not.toContain("null");
  });

  it("đổi giờ đăng ký sang giờ VN", () => {
    expect(rowsToSheet([base]).rows[0]).toContain("10:00 20/07/2026");
  });

  it("dòng chưa check-in để trống cột giờ check-in", () => {
    const { headers, rows } = rowsToSheet([base]);
    expect(rows[0][headers.indexOf("Giờ check-in")]).toBe("");
  });

  it("dòng đã check-in hiện giờ VN và nguồn", () => {
    const { headers, rows } = rowsToSheet([
      { ...base, checked_in: true, checked_in_at: "2026-08-30T02:30:00.000Z", checked_in_source: "qr" },
    ]);
    expect(rows[0][headers.indexOf("Giờ check-in")]).toBe("09:30 30/08/2026");
    expect(rows[0][headers.indexOf("Nguồn check-in")]).toBe("qr");
  });

  it("danh sách rỗng vẫn trả header", () => {
    const { headers, rows } = rowsToSheet([]);
    expect(headers).toHaveLength(21);
    expect(rows).toEqual([]);
  });

  it("chủ đề quan tâm xuất ra nhãn tiếng Việt nối bằng dấu phẩy", () => {
    const { headers, rows } = rowsToSheet([base]);
    expect(rows[0][headers.indexOf("Chủ đề quan tâm")]).toBe("Ăn dặm, Ngủ");
  });

  it("nguồn biết đến xuất ra nhãn tiếng Việt", () => {
    const { headers, rows } = rowsToSheet([{ ...base, nguon_biet_den: "ban_be" }]);
    expect(rows[0][headers.indexOf("Nguồn biết đến")]).toBe("Bạn bè");
  });

  it("mẹ mang thai để trống toàn bộ cột thông tin bé", () => {
    const { headers, rows } = rowsToSheet([base]);
    for (const cot of ["Tên bé", "Ngày sinh bé", "Giới tính bé", "Bé (tháng tuổi)"]) {
      expect(rows[0][headers.indexOf(cot)]).toBe("");
    }
    expect(rows[0][headers.indexOf("Thai (tuần)")]).toBe(20);
  });

  it("mẹ đã sinh để trống cột tuần thai", () => {
    const { headers, rows } = rowsToSheet([
      {
        ...base,
        trang_thai: "da_sinh",
        thai_tuan: null,
        ten_be: "Gạo",
        be_ngay_sinh: "2026-01-20",
        be_gioi_tinh: "nu",
        be_thang_tuoi: 6,
      },
    ]);
    expect(rows[0][headers.indexOf("Thai (tuần)")]).toBe("");
    expect(rows[0][headers.indexOf("Giới tính bé")]).toBe("Nữ");
    expect(rows[0][headers.indexOf("Ngày sinh bé")]).toBe("20/01/2026");
  });

  it("chủ đề rỗng thành chuỗi rỗng", () => {
    const { headers, rows } = rowsToSheet([{ ...base, chu_de_quan_tam: [] }]);
    expect(rows[0][headers.indexOf("Chủ đề quan tâm")]).toBe("");
  });
});
