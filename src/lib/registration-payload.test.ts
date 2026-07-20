import { describe, expect, it } from "vitest";
import { buildRegistrationPayload } from "./registration-payload";
import { registrationSchema } from "./validation";

/** Dựng FormData đúng như DOM trả về sau khi mẹ điền form. */
function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

const CHUNG = {
  hoTen: "Nguyễn Thị An",
  email: "an@example.com",
  sdt: "0912345678",
  facebook: "",
  tinhThanh: "TP. Hồ Chí Minh",
  nguonBietDen: "facebook",
  dongYNhanTin: "on",
};

describe("buildRegistrationPayload", () => {
  it("nhánh mang thai gửi thaiTuan và KHÔNG gửi field bé", () => {
    const p = buildRegistrationPayload(
      fd({ ...CHUNG, trangThai: "mang_thai", thaiTuan: "20" }),
      ["thai_ky"],
    );
    expect(p.thaiTuan).toBe("20");
    expect("tenBe" in p).toBe(false);
    expect("beNgaySinh" in p).toBe(false);
    expect("beGioiTinh" in p).toBe(false);
  });

  it("nhánh đã sinh gửi field bé và KHÔNG gửi thaiTuan", () => {
    const p = buildRegistrationPayload(
      fd({
        ...CHUNG,
        trangThai: "da_sinh",
        tenBe: "Bé Bơ",
        beNgaySinh: "2026-01-25",
        beGioiTinh: "nu",
      }),
      ["an_dam", "ngu"],
    );
    expect(p.tenBe).toBe("Bé Bơ");
    expect(p.beNgaySinh).toBe("2026-01-25");
    expect(p.beGioiTinh).toBe("nu");
    expect("thaiTuan" in p).toBe(false);
  });

  // Mẹ chọn "đã sinh", điền tên bé, rồi đổi ý sang "mang thai". Nếu input cũ
  // còn sót trong DOM thì FormData vẫn mang giá trị đó — payload không được
  // chuyển tiếp nó sang nhánh mới.
  it("giá trị thừa của nhánh kia bị loại, không rò sang", () => {
    const p = buildRegistrationPayload(
      fd({
        ...CHUNG,
        trangThai: "mang_thai",
        thaiTuan: "20",
        tenBe: "Bé Bơ",
        beGioiTinh: "nu",
      }),
      ["thai_ky"],
    );
    expect("tenBe" in p).toBe(false);
    expect("beGioiTinh" in p).toBe(false);
  });

  it("cả hai nhánh parse sạch qua registrationSchema", () => {
    const mangThai = buildRegistrationPayload(
      fd({ ...CHUNG, trangThai: "mang_thai", thaiTuan: "20" }),
      ["thai_ky"],
    );
    const daSinh = buildRegistrationPayload(
      fd({
        ...CHUNG,
        trangThai: "da_sinh",
        tenBe: "Bé Bơ",
        beNgaySinh: "2026-01-25",
        beGioiTinh: "nu",
      }),
      ["an_dam"],
    );
    expect(registrationSchema.safeParse(mangThai).success).toBe(true);
    expect(registrationSchema.safeParse(daSinh).success).toBe(true);
  });

  it("checkbox không tick thành false, có tick thành true", () => {
    const khong = buildRegistrationPayload(
      fd({ ...CHUNG, trangThai: "mang_thai", thaiTuan: "20" }),
      ["thai_ky"],
    );
    expect(khong.diCungChong).toBe(false);
    expect(khong.dongYNhanTin).toBe(true);

    const co = buildRegistrationPayload(
      fd({ ...CHUNG, trangThai: "mang_thai", thaiTuan: "20", diCungChong: "on" }),
      ["thai_ky"],
    );
    expect(co.diCungChong).toBe(true);
  });

  it("chuDe đi thẳng từ state, không qua FormData", () => {
    const p = buildRegistrationPayload(
      fd({ ...CHUNG, trangThai: "mang_thai", thaiTuan: "20" }),
      ["thai_ky", "ivf"],
    );
    expect(p.chuDeQuanTam).toEqual(["thai_ky", "ivf"]);
  });
});
