import { describe, expect, it } from "vitest";
import { SUC_CHUA_MAC_DINH } from "./constants";
import { ketQuaSucChua, sucChua } from "./suc-chua";

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

describe("ketQuaSucChua — số DÒNG trong Sheet thành quyết định", () => {
  const soLieu = (soDong: number, ...e: string[]) => ({ soDong, emails: new Set(e) });

  it("còn chỗ thì cho đi tiếp", () => {
    expect(ketQuaSucChua(soLieu(2, "a@x.y", "b@x.y"), "moi@x.y", 500)).toBe("moi");
  });

  it("đủ số chỗ thì chặn", () => {
    expect(ketQuaSucChua(soLieu(2, "a@x.y", "b@x.y"), "moi@x.y", 2)).toBe("het_cho");
  });

  /** `>=` chứ không `>`: đủ 2 dòng là đã hết, mẹ tiếp theo là người thứ 3. */
  it("mốc cuối: còn thiếu đúng một chỗ thì vẫn nhận", () => {
    expect(ketQuaSucChua(soLieu(1, "a@x.y"), "moi@x.y", 2)).toBe("moi");
  });

  /**
   * ĐÂY LÀ LỖI ĐÃ GẶP THẬT: Sheet có 511 dòng nhưng chỉ 17 email khác nhau (dữ
   * liệu test dùng lại vài địa chỉ). Bản cũ đếm email nên thấy 17 < 500 và vẫn
   * nhận thêm mẹ, dù ops mở Sheet ra đã thấy quá 500 dòng từ lâu.
   */
  it("511 dòng / 17 email khác nhau → HẾT CHỖ, không phải còn chỗ", () => {
    const nhieuTrung = { soDong: 511, emails: new Set(["a@x.y", "b@x.y"]) };
    expect(ketQuaSucChua(nhieuTrung, "moi@x.y", 500)).toBe("het_cho");
  });

  /**
   * Mẹ đã có chỗ mà bị chặn thì hoá ra bị đuổi khỏi chỗ mình đang giữ, chỉ vì
   * gửi lại form để sửa số điện thoại.
   */
  it("email đã có trong Sheet vẫn qua được dù đang đầy", () => {
    expect(ketQuaSucChua(soLieu(2, "a@x.y", "b@x.y"), "a@x.y", 2)).toBe("da_dang_ky");
  });

  /**
   * Zod đã `.trim().toLowerCase()` email trước khi ghi, nhưng ô trong Sheet sửa
   * tay được — không chuẩn hoá thì mẹ viết hoa bị coi là người lạ và bị chặn
   * khỏi chỗ của chính mẹ khi sự kiện đã đầy.
   */
  it("so khớp bỏ hoa/thường và khoảng trắng thừa", () => {
    expect(ketQuaSucChua(soLieu(1, "mai@email.com"), "  MAI@Email.com ", 1)).toBe(
      "da_dang_ky",
    );
  });

  it("Sheet trống thì mẹ đầu tiên là chỗ mới", () => {
    expect(ketQuaSucChua(soLieu(0), "mai@x.y", 500)).toBe("moi");
  });
});
