import { describe, it, expect } from "vitest";
import { registrationToRow } from "@/lib/supabase";
import type { Registration } from "@/lib/validation";

const MOC = new Date("2026-07-20T03:00:00.000Z");

const chung = {
  nguon: "su-kien" as const,
  hoTen: "Nguyễn Thị Lan",
  email: "lan@example.com",
  sdt: "0901234567",
  facebook: "",
  tinhThanh: "TP. Hồ Chí Minh",
  chuDeQuanTam: ["an_dam", "ngu"],
  nguonBietDen: "facebook",
  diCungChong: false,
  dongYNhanTin: true as const,
};

const mangThai = { ...chung, trangThai: "mang_thai", thaiTuan: 20 } as Registration;
const daSinh = {
  ...chung,
  trangThai: "da_sinh",
  tenBe: "Gạo",
  beNgaySinh: new Date("2026-01-20"),
  beGioiTinh: "nu",
} as Registration;

describe("registrationToRow", () => {
  it("mẹ mang thai: có thai_tuan, cột bé đều null", () => {
    const row = registrationToRow(mangThai, "MO-23456A", MOC);
    expect(row.thai_tuan).toBe(20);
    expect(row.ten_be).toBeNull();
    expect(row.be_ngay_sinh).toBeNull();
    expect(row.be_gioi_tinh).toBeNull();
    expect(row.be_thang_tuoi).toBeNull();
  });

  it("mẹ đã sinh: có thông tin bé, thai_tuan null", () => {
    const row = registrationToRow(daSinh, "MO-23456A", MOC);
    expect(row.thai_tuan).toBeNull();
    expect(row.ten_be).toBe("Gạo");
    expect(row.be_gioi_tinh).toBe("nu");
  });

  it("be_ngay_sinh lưu dạng YYYY-MM-DD, không phải ISO đầy đủ", () => {
    expect(registrationToRow(daSinh, "MO-23456A", MOC).be_ngay_sinh).toBe("2026-01-20");
  });

  it("be_thang_tuoi được SUY RA từ ngày sinh, không nhập tay", () => {
    expect(registrationToRow(daSinh, "MO-23456A", MOC).be_thang_tuoi).toBe(6);
  });

  it("facebook rỗng thành null, không phải chuỗi rỗng", () => {
    expect(registrationToRow(mangThai, "MO-23456A", MOC).facebook).toBeNull();
  });

  it("chu_de_quan_tam giữ nguyên mảng", () => {
    expect(registrationToRow(mangThai, "MO-23456A", MOC).chu_de_quan_tam).toEqual([
      "an_dam",
      "ngu",
    ]);
  });
});
