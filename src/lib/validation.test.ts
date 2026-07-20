import { describe, it, expect } from "vitest";
import {
  isValidCheckinCode,
  thangTuoiTuNgaySinh,
  registrationSchema,
} from "@/lib/validation";
import { CHU_DE_VALUES } from "./constants";

describe("isValidCheckinCode", () => {
  it("chấp nhận mã đúng định dạng", () => {
    expect(isValidCheckinCode("MO-23456A")).toBe(true);
    expect(isValidCheckinCode("MO-ABCDEF")).toBe(true);
  });
  it("từ chối ký tự cấm (I, O, 0, 1) và sai định dạng", () => {
    expect(isValidCheckinCode("MO-ABCDEI")).toBe(false); // I
    expect(isValidCheckinCode("MO-ABCDEO")).toBe(false); // O
    expect(isValidCheckinCode("MO-012345")).toBe(false); // 0,1
    expect(isValidCheckinCode("mo-23456a")).toBe(false); // thường
    expect(isValidCheckinCode("MO-2345")).toBe(false);   // ngắn
    expect(isValidCheckinCode("23456A")).toBe(false);    // thiếu tiền tố
  });
});

describe("thangTuoiTuNgaySinh", () => {
  it("tròn tháng", () => {
    expect(
      thangTuoiTuNgaySinh(new Date("2026-01-20"), new Date("2026-07-20")),
    ).toBe(6);
  });

  it("chưa tới ngày trong tháng thì chưa tính tháng đó", () => {
    expect(
      thangTuoiTuNgaySinh(new Date("2026-01-25"), new Date("2026-07-20")),
    ).toBe(5);
  });

  it("cùng tháng trả 0", () => {
    expect(
      thangTuoiTuNgaySinh(new Date("2026-07-01"), new Date("2026-07-20")),
    ).toBe(0);
  });

  it("qua năm", () => {
    expect(
      thangTuoiTuNgaySinh(new Date("2024-07-20"), new Date("2026-07-20")),
    ).toBe(24);
  });

  it("ngày sinh ở tương lai trả số âm (caller tự chặn)", () => {
    expect(
      thangTuoiTuNgaySinh(new Date("2026-08-20"), new Date("2026-07-20")),
    ).toBe(-1);
  });
});

const chung = {
  nguon: "su-kien" as const,
  hoTen: "Nguyễn Thị Lan",
  email: "lan@example.com",
  sdt: "0901234567",
  tinhThanh: "TP. Hồ Chí Minh",
  chuDeQuanTam: ["an_dam", "ngu"],
  nguonBietDen: "facebook",
  diCungChong: false,
  dongYNhanTin: true,
};

const mangThai = { ...chung, trangThai: "mang_thai" as const, thaiTuan: 20 };
const daSinh = {
  ...chung,
  trangThai: "da_sinh" as const,
  tenBe: "Gạo",
  beNgaySinh: "2026-01-20",
  beGioiTinh: "nu" as const,
};

describe("registrationSchema — nhánh mang_thai", () => {
  it("hợp lệ khi đủ thaiTuan", () => {
    expect(registrationSchema.safeParse(mangThai).success).toBe(true);
  });

  it("thiếu thaiTuan thì lỗi", () => {
    const { thaiTuan, ...thieu } = mangThai;
    expect(registrationSchema.safeParse(thieu).success).toBe(false);
  });

  it("thaiTuan 0 hoặc 43 đều lỗi", () => {
    expect(registrationSchema.safeParse({ ...mangThai, thaiTuan: 0 }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...mangThai, thaiTuan: 43 }).success).toBe(false);
  });

  it("gửi kèm thông tin bé thì bị CẮT BỎ, không lưu", () => {
    const r = registrationSchema.safeParse({ ...mangThai, tenBe: "Gạo" });
    expect(r.success).toBe(true);
    expect(r.data).not.toHaveProperty("tenBe");
  });
});

describe("registrationSchema — nhánh da_sinh", () => {
  it("hợp lệ khi đủ thông tin bé", () => {
    expect(registrationSchema.safeParse(daSinh).success).toBe(true);
  });

  it("thiếu beNgaySinh thì lỗi", () => {
    const { beNgaySinh, ...thieu } = daSinh;
    expect(registrationSchema.safeParse(thieu).success).toBe(false);
  });

  it("thiếu tenBe thì lỗi", () => {
    const { tenBe, ...thieu } = daSinh;
    expect(registrationSchema.safeParse(thieu).success).toBe(false);
  });

  it("giới tính lạ thì lỗi", () => {
    expect(
      registrationSchema.safeParse({ ...daSinh, beGioiTinh: "khac" }).success,
    ).toBe(false);
  });

  it("ngày sinh ở tương lai thì lỗi", () => {
    const mai = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect(registrationSchema.safeParse({ ...daSinh, beNgaySinh: mai }).success).toBe(false);
  });

  it("bé trên 36 tháng thì lỗi", () => {
    const qua = new Date();
    qua.setFullYear(qua.getFullYear() - 4);
    expect(
      registrationSchema.safeParse({ ...daSinh, beNgaySinh: qua.toISOString().slice(0, 10) })
        .success,
    ).toBe(false);
  });

  it("beNgaySinh parse ra Date", () => {
    const r = registrationSchema.safeParse(daSinh);
    expect(r.success && r.data.trangThai === "da_sinh" && r.data.beNgaySinh instanceof Date).toBe(true);
  });
});

describe("registrationSchema — field chung", () => {
  it("chuDeQuanTam rỗng thì lỗi", () => {
    expect(
      registrationSchema.safeParse({ ...mangThai, chuDeQuanTam: [] }).success,
    ).toBe(false);
  });

  it("chuDeQuanTam có giá trị lạ thì lỗi", () => {
    expect(
      registrationSchema.safeParse({ ...mangThai, chuDeQuanTam: ["bay_bong"] }).success,
    ).toBe(false);
  });

  it("nhận được cả 9 chủ đề", () => {
    expect(
      registrationSchema.safeParse({ ...mangThai, chuDeQuanTam: [...CHU_DE_VALUES] }).success,
    ).toBe(true);
  });

  it("nguonBietDen lạ thì lỗi", () => {
    expect(
      registrationSchema.safeParse({ ...mangThai, nguonBietDen: "bao_giay" }).success,
    ).toBe(false);
  });

  it("không đồng ý nhận tin thì lỗi", () => {
    expect(
      registrationSchema.safeParse({ ...mangThai, dongYNhanTin: false }).success,
    ).toBe(false);
  });

  it("thiếu thành phố báo đúng nguyên văn chuỗi khách duyệt", () => {
    const r = registrationSchema.safeParse({ ...mangThai, tinhThanh: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.find((i) => i.path[0] === "tinhThanh")?.message).toBe(
      "Vui lòng chọn thành phố",
    );
  });
});
