import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  datLaiKho,
  datSauDangKy,
  datTuServer,
  docKho,
  theoDoiKho,
} from "./kho-cho-trong";

beforeEach(() => {
  datLaiKho();
});

describe("kho-cho-trong", () => {
  it("chưa biết gì thì rỗng", () => {
    expect(docKho()).toBeNull();
  });

  it("số đọc từ server vào kho", () => {
    datTuServer({ gioiHan: 500, conLai: 137 });
    expect(docKho()).toEqual({ gioiHan: 500, conLai: 137 });
  });

  it("báo cho mọi người đang nghe khi số đổi", () => {
    const nghe1 = vi.fn();
    const nghe2 = vi.fn();
    theoDoiKho(nghe1);
    theoDoiKho(nghe2);

    datSauDangKy({ gioiHan: 500, conLai: 136 });

    expect(nghe1).toHaveBeenCalledOnce();
    expect(nghe2).toHaveBeenCalledOnce();
  });

  it("huỷ nghe thì không nhận báo nữa", () => {
    const nghe = vi.fn();
    const huy = theoDoiKho(nghe);
    huy();

    datTuServer({ gioiHan: 500, conLai: 137 });

    expect(nghe).not.toHaveBeenCalled();
  });

  /**
   * ĐÂY LÀ LÝ DO KHO NÀY TỒN TẠI. Mẹ mở trang rồi submit ngay trên mạng chậm:
   * lượt đọc `/api/cho-trong` lúc mở trang có thể về SAU khi đăng ký xong. Không
   * chặn thì con số cũ đè lên con số vừa đăng ký, và widget nhảy ngược lên.
   */
  it("số từ server về MUỘN không đè lên số sau đăng ký", () => {
    datSauDangKy({ gioiHan: 500, conLai: 136 });
    datTuServer({ gioiHan: 500, conLai: 137 });

    expect(docKho()).toEqual({ gioiHan: 500, conLai: 136 });
  });

  /** Đăng ký lần nữa (tab khác, mẹ khác) vẫn phải cập nhật được. */
  it("số sau đăng ký luôn ghi đè, kể cả lần thứ hai", () => {
    datSauDangKy({ gioiHan: 500, conLai: 136 });
    datSauDangKy({ gioiHan: 500, conLai: 135 });

    expect(docKho()?.conLai).toBe(135);
  });

  /**
   * `useSyncExternalStore` gọi lại getSnapshot sau mỗi lần render và so sánh
   * bằng `Object.is`. Trả object mới mỗi lượt gọi là React render vô tận.
   */
  it("đọc hai lần liên tiếp trả về CÙNG một tham chiếu", () => {
    datTuServer({ gioiHan: 500, conLai: 137 });
    expect(docKho()).toBe(docKho());
  });
});
