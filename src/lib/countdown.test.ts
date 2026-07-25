import { describe, expect, it } from "vitest";
import { EVENT } from "./constants";
import {
  CHUA_BIET,
  conLai,
  daDongDangKy,
  daMoCheckin,
  giayConLai,
  HAN_DANG_KY,
  MO_CHECKIN,
} from "./countdown";

const GIAY = 1_000;
const PHUT = 60 * GIAY;
const GIO = 60 * PHUT;
const NGAY = 24 * GIO;

describe("HAN_DANG_KY — đúng cuối ngày 30/08/2026 giờ VN", () => {
  /**
   * Đây là bài test giữ cho cả tính năng khỏi lệch 7 tiếng. Nếu ai đó sửa
   * `dongDangKyISO` thành "2026-08-30T23:59" (không có Z), server Vercel chạy UTC
   * sẽ đọc thành 06:59 sáng 31/08 giờ VN và đăng ký mở thêm gần một buổi.
   */
  it("mốc hạn chính là 00:00 ngày 31/08/2026 giờ VN", () => {
    expect(HAN_DANG_KY).toBe(Date.parse("2026-08-31T00:00:00+07:00"));
  });

  it("23:59:59.999 ngày 30/08 giờ VN vẫn CÒN đăng ký được", () => {
    const cuoiNgay = Date.parse("2026-08-30T23:59:59.999+07:00");
    expect(daDongDangKy(cuoiNgay)).toBe(false);
    expect(conLai(cuoiNgay)).toEqual({ ngay: 0, gio: 0, phut: 0, giay: 0 });
  });

  it("00:00 ngày 31/08 giờ VN là đã đóng", () => {
    expect(daDongDangKy(Date.parse("2026-08-31T00:00:00+07:00"))).toBe(true);
  });

  /** Chuỗi trong constants phải giữ đuôi Z — không có nó là lệch múi giờ. */
  it("dongDangKyISO viết ở dạng UTC", () => {
    expect(EVENT.dongDangKyISO).toMatch(/Z$/);
  });
});

describe("MO_CHECKIN — đúng đầu ngày 30/08/2026 giờ VN", () => {
  /**
   * Cùng loại bẫy với `HAN_DANG_KY`: thiếu đuôi `Z` là server Vercel (chạy UTC)
   * đọc lệch 7 tiếng. Ở đây lệch theo hướng nguy hiểm nhất — mở check-in trễ tới
   * 7:00 sáng ngày sự kiện, đúng lúc mẹ đang xếp hàng ở cổng.
   */
  it("mốc mở chính là 00:00 ngày 30/08/2026 giờ VN", () => {
    expect(MO_CHECKIN).toBe(Date.parse("2026-08-30T00:00:00+07:00"));
  });

  it("23:59:59.999 ngày 29/08 giờ VN vẫn CHƯA mở", () => {
    expect(daMoCheckin(Date.parse("2026-08-29T23:59:59.999+07:00"))).toBe(false);
  });

  it("00:00 ngày 30/08 giờ VN là đã mở", () => {
    expect(daMoCheckin(Date.parse("2026-08-30T00:00:00+07:00"))).toBe(true);
  });

  /** Ngày mở đăng ký (25/07) — mẹ nhận QR hơn một tháng trước sự kiện. */
  it("lúc mẹ vừa nhận email xác nhận thì nút còn khoá", () => {
    expect(daMoCheckin(Date.parse("2026-07-25T10:00:00+07:00"))).toBe(false);
  });

  /** Giờ đón khách thật (8:00 ngày 30/08) và sau sự kiện đều phải check-in được. */
  it("trong ngày sự kiện và sau đó thì check-in bình thường", () => {
    expect(daMoCheckin(Date.parse("2026-08-30T08:00:00+07:00"))).toBe(true);
    expect(daMoCheckin(Date.parse("2026-08-30T15:00:00+07:00"))).toBe(true);
    expect(daMoCheckin(Date.parse("2026-09-05T09:00:00+07:00"))).toBe(true);
  });

  it("moCheckinISO viết ở dạng UTC", () => {
    expect(EVENT.moCheckinISO).toMatch(/Z$/);
  });

  /** Nhãn trên nút và mốc thật phải là cùng một ngày. */
  it("nhãn ngày khớp với mốc thật", () => {
    expect(EVENT.moCheckinLabel).toBe("30/08/2026");
  });
});

describe("conLai — tách ms còn lại thành ngày/giờ/phút/giây", () => {
  const han = Date.parse("2026-08-31T00:00:00+07:00");
  const luc = (truoc: number) => conLai(han - truoc, han);

  it("chia đúng từng đơn vị", () => {
    expect(luc(37 * NGAY + 5 * GIO + 22 * PHUT + 10 * GIAY)).toEqual({
      ngay: 37,
      gio: 5,
      phut: 22,
      giay: 10,
    });
  });

  it("giờ/phút/giây không tràn quá 23/59/59", () => {
    expect(luc(2 * NGAY - GIAY)).toEqual({ ngay: 1, gio: 23, phut: 59, giay: 59 });
  });

  it("dưới một ngày thì ngày = 0", () => {
    expect(luc(90 * PHUT)).toEqual({ ngay: 0, gio: 1, phut: 30, giay: 0 });
  });

  /**
   * Làm tròn XUỐNG. Còn 1500ms mà hiện "2 giây" là đồng hồ nói dối theo hướng
   * rộng rãi hơn thực tế — mẹ tin còn kịp thì mẹ mất chỗ.
   */
  it("phần lẻ ms bị cắt xuống, không làm tròn lên", () => {
    expect(luc(1_500)).toEqual({ ngay: 0, gio: 0, phut: 0, giay: 1 });
  });

  it("đúng mốc hạn → null", () => {
    expect(conLai(han, han)).toBeNull();
  });

  it("quá hạn → null", () => {
    expect(conLai(han + GIAY, han)).toBeNull();
    expect(conLai(han + 400 * NGAY, han)).toBeNull();
  });

  /**
   * `null` chứ không `{0,0,0,0}`: bốn số 0 vẫn là đồng hồ hợp lệ (còn đúng 0 giây
   * nhưng CHƯA hết hạn — xem test 23:59:59.999 ở trên), nên nếu hết hạn cũng trả
   * bốn số 0 thì hai trạng thái khác hẳn nhau trở thành không phân biệt được.
   */
  it("còn 0 giây KHÁC với đã hết hạn", () => {
    expect(conLai(han - 1, han)).toEqual({ ngay: 0, gio: 0, phut: 0, giay: 0 });
    expect(conLai(han, han)).toBeNull();
  });
});

describe("CHUA_BIET — giá trị canh cho getServerSnapshot", () => {
  /**
   * Phải nằm NGOÀI mọi giá trị `giayConLai` sinh ra, không thì widget đọc nhầm
   * một mốc thời gian thật thành "chưa hydrate xong" và đứng ở "--" mãi.
   */
  it("không đụng dải giá trị thật", () => {
    const han = Date.parse("2026-08-31T00:00:00+07:00");
    expect(giayConLai(han, han)).toBe(-1);
    expect(giayConLai(han + 999_999, han)).toBe(-1);
    expect(giayConLai(han - 1, han)).toBeGreaterThanOrEqual(0);
    expect(CHUA_BIET).toBeLessThan(-1);
  });

  /**
   * Là số nguyên chứ KHÔNG phải NaN: React dev bắt lỗi "getServerSnapshot should
   * be cached to avoid an infinite loop" với NaN, vì phép so ảnh chụp của nó coi
   * NaN khác chính NaN.
   */
  it("là số nguyên, không phải NaN", () => {
    expect(Number.isNaN(CHUA_BIET)).toBe(false);
    expect(Number.isInteger(CHUA_BIET)).toBe(true);
  });
});
