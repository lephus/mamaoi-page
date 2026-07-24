import { describe, expect, it } from "vitest";
import { boNhoTamTheoThoiGian } from "./bo-nho-tam";

/**
 * Đồng hồ giả: test không được `sleep` thật — 30 giây TTL mà chờ thật thì bộ
 * test đứng nửa phút cho mỗi lần chạy.
 */
function dongHoGia(batDau = 0) {
  let t = batDau;
  return { now: () => t, tien: (ms: number) => void (t += ms) };
}

describe("boNhoTamTheoThoiGian", () => {
  it("gọi lại trong hạn thì dùng lại kết quả, không nạp lần hai", async () => {
    let soLanNap = 0;
    const dong = dongHoGia();
    const doc = boNhoTamTheoThoiGian(
      async () => {
        soLanNap++;
        return "A";
      },
      30_000,
      dong.now,
    );

    expect(await doc()).toBe("A");
    dong.tien(29_999);
    expect(await doc()).toBe("A");
    expect(soLanNap).toBe(1);
  });

  it("quá hạn thì nạp lại", async () => {
    let soLanNap = 0;
    const dong = dongHoGia();
    const doc = boNhoTamTheoThoiGian(
      async () => `lần ${++soLanNap}`,
      30_000,
      dong.now,
    );

    expect(await doc()).toBe("lần 1");
    dong.tien(30_001);
    expect(await doc()).toBe("lần 2");
    expect(soLanNap).toBe(2);
  });

  /**
   * Ngày mở đăng ký, hàng trăm mẹ mở trang trong cùng một nhịp. Không gộp thì
   * mỗi lượt xem là một lần đọc Google Sheet — vừa chậm vừa đụng hạn ngạch API.
   */
  it("nhiều lời gọi cùng lúc chỉ nạp MỘT lần", async () => {
    let soLanNap = 0;
    let moKhoa: (v: string) => void = () => {};
    const doc = boNhoTamTheoThoiGian(
      () => {
        soLanNap++;
        return new Promise<string>((resolve) => {
          moKhoa = resolve;
        });
      },
      30_000,
      dongHoGia().now,
    );

    const ba = Promise.all([doc(), doc(), doc()]);
    moKhoa("A");

    expect(await ba).toEqual(["A", "A", "A"]);
    expect(soLanNap).toBe(1);
  });

  /**
   * Nhớ luôn cả thất bại thì một cú Google 503 nhất thời khoá con số suốt cả
   * cửa sổ TTL, dù lần thử sau đã gọi được.
   */
  it("nạp lỗi thì KHÔNG nhớ lỗi — lần sau thử lại", async () => {
    let soLanNap = 0;
    const doc = boNhoTamTheoThoiGian(
      async () => {
        soLanNap++;
        if (soLanNap === 1) throw new Error("Google 503");
        return "A";
      },
      30_000,
      dongHoGia().now,
    );

    await expect(doc()).rejects.toThrow("Google 503");
    expect(await doc()).toBe("A");
    expect(soLanNap).toBe(2);
  });
});
