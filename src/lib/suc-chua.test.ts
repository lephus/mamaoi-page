import { describe, expect, it } from "vitest";
import { SUC_CHUA_MAC_DINH } from "./constants";
import { choConLai, ketQuaSucChua, sucChua } from "./suc-chua";

describe("sucChua — đọc giới hạn từ env", () => {
  it("không đặt env thì dùng mặc định", () => {
    expect(sucChua(undefined)).toBe(SUC_CHUA_MAC_DINH);
    expect(sucChua("")).toBe(SUC_CHUA_MAC_DINH);
  });

  it("số hợp lệ thì dùng đúng số đó", () => {
    expect(sucChua("550")).toBe(550);
    expect(sucChua(" 550 ")).toBe(550);
    expect(sucChua("1")).toBe(1);
  });

  /**
   * Env rác KHÔNG được rơi về NaN. Mọi so sánh với NaN đều false, nên
   * `emails.size >= NaN` không bao giờ đúng và cổng chặn im lặng không chặn gì —
   * đúng thứ hỏng mà không ai phát hiện cho tới khi sự kiện quá tải.
   */
  it("giá trị rác rơi về mặc định chứ không phải NaN", () => {
    for (const rac of ["abc", "0", "-5", "5.5", "1e3", "500 mẹ", " "]) {
      expect(sucChua(rac)).toBe(SUC_CHUA_MAC_DINH);
    }
  });
});

describe("ketQuaSucChua — số QR đã gửi (email duy nhất) thành quyết định", () => {
  const soLieu = (...e: string[]) => ({ emails: new Set(e) });

  it("còn chỗ thì cho đi tiếp", () => {
    expect(ketQuaSucChua(soLieu("a@x.y", "b@x.y"), "moi@x.y", 500)).toBe("moi");
  });

  it("đã gửi đủ số QR thì chặn", () => {
    expect(ketQuaSucChua(soLieu("a@x.y", "b@x.y"), "moi@x.y", 2)).toBe("het_cho");
  });

  /** `>=` chứ không `>`: gửi đủ 2 QR là đã hết, mẹ tiếp theo là người thứ 3. */
  it("mốc cuối: còn thiếu đúng một chỗ thì vẫn nhận", () => {
    expect(ketQuaSucChua(soLieu("a@x.y"), "moi@x.y", 2)).toBe("moi");
  });

  /**
   * Luật khách chốt 24/07/2026: "unique email => 1 QR", "ngưng nhận đơn khi đã
   * có 500 QR gửi ra". Sheet chỉ append nên một mẹ gửi lại form ba lần là ba
   * DÒNG — nhưng vẫn chỉ một mã QR, nên chỉ được ăn một chỗ trong 500.
   */
  it("mẹ gửi lại form nhiều lần chỉ chiếm MỘT chỗ", () => {
    // 3 dòng trong Sheet, 2 email khác nhau ⇒ mới gửi 2 QR, giới hạn 3 ⇒ còn chỗ.
    expect(ketQuaSucChua(soLieu("a@x.y", "b@x.y"), "moi@x.y", 3)).toBe("moi");
  });

  /**
   * Mẹ đã có chỗ mà bị chặn thì hoá ra bị đuổi khỏi chỗ mình đang giữ, chỉ vì
   * gửi lại form để sửa số điện thoại.
   */
  it("email đã có trong Sheet vẫn qua được dù đang đầy", () => {
    expect(ketQuaSucChua(soLieu("a@x.y", "b@x.y"), "a@x.y", 2)).toBe("da_dang_ky");
  });

  /**
   * Zod đã `.trim().toLowerCase()` email trước khi ghi, nhưng ô trong Sheet sửa
   * tay được — không chuẩn hoá thì mẹ viết hoa bị coi là người lạ và bị chặn
   * khỏi chỗ của chính mẹ khi sự kiện đã đầy.
   */
  it("so khớp bỏ hoa/thường và khoảng trắng thừa", () => {
    expect(ketQuaSucChua(soLieu("mai@email.com"), "  MAI@Email.com ", 1)).toBe(
      "da_dang_ky",
    );
  });

  it("Sheet trống thì mẹ đầu tiên là chỗ mới", () => {
    expect(ketQuaSucChua(soLieu(), "mai@x.y", 500)).toBe("moi");
  });
});

/**
 * Con số hiện công khai trên landing ("Còn N/500 chỗ") — khách chốt 24/07/2026
 * mục 9: "đếm ngược số lượng đơn đã xác nhận và gửi QR".
 */
describe("choConLai — số chỗ còn lại hiện trên trang", () => {
  const soLieu = (...e: string[]) => ({ emails: new Set(e) });

  it("còn lại = giới hạn trừ số QR đã gửi", () => {
    expect(choConLai(soLieu("a@x.y", "b@x.y"), 500)).toBe(498);
  });

  it("chưa ai đăng ký thì còn nguyên", () => {
    expect(choConLai(soLieu(), 500)).toBe(500);
  });

  it("vừa đủ thì còn 0", () => {
    expect(choConLai(soLieu("a@x.y", "b@x.y"), 2)).toBe(0);
  });

  /**
   * Cổng chặn KHÔNG nguyên tử (xem doc đầu file) nên số QR có thể vượt giới hạn
   * vài cái quanh mốc cuối. Trang phải hiện "Còn 0 chỗ", không bao giờ được hiện
   * số âm trước mặt mẹ.
   */
  it("lỡ vượt giới hạn thì kẹp về 0, không bao giờ âm", () => {
    expect(choConLai(soLieu("a@x.y", "b@x.y", "c@x.y"), 2)).toBe(0);
  });
});
