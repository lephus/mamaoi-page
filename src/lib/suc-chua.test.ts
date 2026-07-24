import { describe, expect, it } from "vitest";
import { SUC_CHUA_MAC_DINH } from "./constants";
import { quyetDinhSucChua, sucChua } from "./suc-chua";

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
   * Env rác KHÔNG được rơi về NaN. `NaN >= p_gioi_han` trong Postgres trả null,
   * nhánh `if` không chạy, và cổng chặn im lặng không chặn gì — đúng thứ hỏng
   * mà không ai phát hiện cho tới khi sự kiện quá tải.
   */
  it("giá trị rác rơi về mặc định chứ không phải NaN", () => {
    for (const rac of ["abc", "0", "-5", "5.5", "1e3", "500 mẹ", " "]) {
      expect(sucChua(rac)).toBe(SUC_CHUA_MAC_DINH);
    }
  });
});

describe("quyetDinhSucChua — kết quả RPC thành hành động của route", () => {
  it("hết chỗ thì chặn", () => {
    expect(quyetDinhSucChua("het_cho")).toEqual({ chan: true });
  });

  it("chỗ mới: đi tiếp, KHÔNG ghi lại vì RPC đã insert", () => {
    expect(quyetDinhSucChua("moi")).toEqual({ chan: false, ghiLai: false });
  });

  it("email đã đăng ký: đi tiếp VÀ ghi lại để làm mới thông tin", () => {
    expect(quyetDinhSucChua("da_dang_ky")).toEqual({ chan: false, ghiLai: true });
  });

  it("Supabase lỗi: fail open, vẫn cố ghi lại", () => {
    expect(quyetDinhSucChua("loi")).toEqual({ chan: false, ghiLai: true });
  });

  it("chưa cấu hình Supabase: đi tiếp, không có gì để ghi", () => {
    expect(quyetDinhSucChua("khong_cau_hinh")).toEqual({ chan: false, ghiLai: false });
  });

  /**
   * Function trong DB sửa được độc lập với code này. Nếu ai đó thêm một giá trị
   * trả về mới, mặc định phải là CHO ĐI TIẾP — chặn nhầm mẹ thật vì một chuỗi lạ
   * tệ hơn nhiều so với nhận dư một chỗ ở sự kiện miễn phí.
   */
  it("chuỗi lạ từ DB thì fail open chứ không chặn", () => {
    expect(quyetDinhSucChua("gi_do_moi")).toEqual({ chan: false, ghiLai: true });
  });
});
