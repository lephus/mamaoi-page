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
  be_thang_tuoi: null,
  di_cung_chong: true,
  dong_y_nhan_tin: true,
  nguon: "su-kien",
  checked_in: false,
  checked_in_at: null,
  checked_in_source: null,
};

describe("rowsToSheet", () => {
  it("có đúng 15 cột và không lộ id", () => {
    const { headers } = rowsToSheet([base]);
    expect(headers).toHaveLength(15);
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
      rowsToSheet([{ ...base, trang_thai: "da_sinh", be_thang_tuoi: 6 }]).rows[0],
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
    expect(headers).toHaveLength(15);
    expect(rows).toEqual([]);
  });
});
