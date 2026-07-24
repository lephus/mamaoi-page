import { describe, expect, it } from "vitest";
import { PROVINCES } from "./constants";
import { boDau } from "./text";

describe("boDau — chuẩn hoá để tìm kiếm", () => {
  it("bỏ dấu thanh và dấu mũ", () => {
    expect(boDau("TP. Hồ Chí Minh")).toBe("tp. ho chi minh");
    expect(boDau("Thừa Thiên Huế")).toBe("thua thien hue");
    expect(boDau("Bà Rịa - Vũng Tàu")).toBe("ba ria - vung tau");
  });

  /** đ/Đ là code point riêng, NFD không tách — dễ quên nhất. */
  it("đ và Đ thành d", () => {
    expect(boDau("Đắk Lắk")).toBe("dak lak");
    expect(boDau("Đồng Nai")).toBe("dong nai");
    expect(boDau("Điện Biên")).toBe("dien bien");
  });

  it("chuỗi đã không dấu thì giữ nguyên", () => {
    expect(boDau("Can Tho")).toBe("can tho");
    expect(boDau("")).toBe("");
  });

  it("mọi tỉnh/thành đều ra chuỗi ASCII thuần", () => {
    for (const p of PROVINCES) {
      expect(boDau(p)).toMatch(/^[\x20-\x7e]*$/);
    }
  });

  /**
   * Đây mới là thứ mẹ thực sự làm: gõ không dấu, gõ một khúc giữa tên.
   * Test theo đúng cách component lọc (includes trên chuỗi đã bỏ dấu).
   */
  it("gõ không dấu tìm ra đúng tỉnh/thành", () => {
    const tim = (q: string) => PROVINCES.filter((p) => boDau(p).includes(boDau(q)));

    expect(tim("ho chi minh")).toEqual(["TP. Hồ Chí Minh"]);
    expect(tim("da nang")).toEqual(["Đà Nẵng"]);
    expect(tim("dak")).toEqual(["Đắk Lắk", "Đắk Nông"]);
    expect(tim("HA NOI")).toEqual(["Hà Nội"]);
    expect(tim("Huế")).toEqual(["Thừa Thiên Huế"]);
    expect(tim("xyz")).toEqual([]);
  });
});
