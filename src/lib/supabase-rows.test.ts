import { describe, it, expect } from "vitest";
import { adminCheckinPayload, registrationToRow } from "@/lib/supabase";
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

  it("chuDeKhac rỗng thành null, có nội dung thì giữ nguyên", () => {
    const rong = registrationToRow(
      { ...mangThai, chuDeKhac: "" } as Registration,
      "MO-ABC234",
      MOC,
    );
    expect(rong.chu_de_khac).toBeNull();

    const co = registrationToRow(
      { ...mangThai, chuDeKhac: "Trầm cảm sau sinh" } as Registration,
      "MO-ABC234",
      MOC,
    );
    expect(co.chu_de_khac).toBe("Trầm cảm sau sinh");
  });

  it("chuDeKhac vắng mặt cũng thành null", () => {
    const r = registrationToRow(mangThai, "MO-ABC234", MOC);
    expect(r.chu_de_khac).toBeNull();
  });

  /**
   * Cột `duoc_moi` do DB quyết định bằng `default true`, KHÔNG do code. Gửi kèm
   * nó trong payload là phá hai thứ cùng lúc: dòng ops tạo tay hết mặc định
   * hiện, và `insertRegistration` (upsert) sẽ bật lại thành hiện một mẹ mà ops
   * đã cố tình ẩn. `Omit<>` chặn ở tầng kiểu; test này chặn ở tầng chạy thật.
   */
  it("KHÔNG gửi duoc_moi lên DB — cột đó do default của Postgres quyết định", () => {
    expect(registrationToRow(mangThai, "MO-23456A", MOC)).not.toHaveProperty("duoc_moi");
    expect(registrationToRow(daSinh, "MO-23456A", MOC)).not.toHaveProperty("duoc_moi");
  });
});

/**
 * Ops bấm "Check In" ở /admin/quet-qr cho một mẹ ngoài danh sách (duoc_moi =
 * false): mẹ đã đứng ở cửa và được cho vào, thì phải HIỆN trên /admin như mọi
 * người khác — không thì "Đã check-in: N / …" đếm thiếu chính người vừa vào.
 */
describe("adminCheckinPayload", () => {
  it("check-in: bật duoc_moi = true cùng lúc ghi ba cột check-in", () => {
    expect(adminCheckinPayload(true, "2026-08-30T02:30:00.000Z")).toEqual({
      checked_in: true,
      checked_in_at: "2026-08-30T02:30:00.000Z",
      checked_in_source: "admin",
      duoc_moi: true,
    });
  });

  it("check-in không kèm giờ: lấy giờ hiện tại, vẫn bật duoc_moi", () => {
    const p = adminCheckinPayload(true, null);
    expect(p.duoc_moi).toBe(true);
    expect(p.checked_in).toBe(true);
    expect(typeof p.checked_in_at).toBe("string");
  });

  it("bỏ tick: xoá ba cột check-in, KHÔNG đụng duoc_moi", () => {
    expect(adminCheckinPayload(false, null)).toEqual({
      checked_in: false,
      checked_in_at: null,
      checked_in_source: null,
    });
    expect(adminCheckinPayload(false, null)).not.toHaveProperty("duoc_moi");
  });
});
