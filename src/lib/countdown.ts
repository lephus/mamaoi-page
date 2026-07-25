import { EVENT } from "./constants";

/**
 * Đếm ngược tới hạn đóng đăng ký Mama Ơi Day.
 *
 * Thuần toán, KHÔNG React: cùng một phép chia này chạy ở ba nơi — widget hero,
 * cổng chặn trong route, và test — nên nó phải test được mà không cần dựng DOM
 * hay đóng băng đồng hồ toàn cục.
 *
 * Mọi hàm ở đây nhận `nowMs` truyền vào chứ không tự gọi `Date.now()`: test
 * cần thử từng mốc mà không phải giả lập đồng hồ hệ thống.
 */

/** Hạn đóng đăng ký, dạng epoch ms. Xem `EVENT.dongDangKyISO` để biết vì sao UTC. */
export const HAN_DANG_KY = Date.parse(EVENT.dongDangKyISO);

export type ConLai = { ngay: number; gio: number; phut: number; giay: number };

/**
 * Ảnh chụp "chưa biết giờ trên máy mẹ" — giá trị `getServerSnapshot` của widget
 * trả về. Nằm ngoài dải mà `giayConLai` sinh ra (`-1` là hết hạn, `>= 0` là số
 * giây còn lại) nên không lẫn với trạng thái thật nào.
 *
 * Là SỐ NGUYÊN chứ không phải `NaN`: React dev bắt lỗi "getServerSnapshot should
 * be cached" với NaN vì phép so ảnh chụp của nó coi `NaN` khác chính `NaN`.
 */
export const CHUA_BIET = -2;

/**
 * Số giây còn lại, hoặc `-1` khi đã hết hạn.
 *
 * Tách riêng khỏi `conLai` vì widget dùng nó làm ảnh chụp cho
 * `useSyncExternalStore`: hook đó so ảnh chụp bằng `Object.is`, nên giá trị phải
 * là SỐ. Trả object mới mỗi lần đọc sẽ khiến React thấy "đổi" ở mọi lần render
 * và quay vòng vô hạn.
 *
 * Làm tròn XUỐNG: còn 1500ms thì hiện "1 giây", không phải "2 giây". Đồng hồ đếm
 * ngược mà nhảy tới số lớn hơn thực tế là nói dối mẹ về thời gian còn lại.
 */
export function giayConLai(nowMs: number, hanMs: number = HAN_DANG_KY): number {
  const con = hanMs - nowMs;
  return con <= 0 ? -1 : Math.floor(con / 1000);
}

/** Tách số giây thành ngày/giờ/phút/giây. Chia thuần, không biết gì về hạn. */
export function tachGiay(giay: number): ConLai {
  return {
    ngay: Math.floor(giay / 86_400),
    gio: Math.floor(giay / 3_600) % 24,
    phut: Math.floor(giay / 60) % 60,
    giay: giay % 60,
  };
}

/**
 * Thời gian còn lại, đã tách sẵn thành ngày/giờ/phút/giây. `null` = đã hết hạn.
 *
 * `null` chứ không phải `{0,0,0,0}`: bốn số 0 vẫn là một cái đồng hồ hợp lệ (còn
 * dưới một giây nhưng CHƯA hết hạn), và chỗ gọi sẽ phải tự đoán "bốn số 0 nghĩa
 * là hết hạn hay là chưa mount?". Kiểu riêng buộc chỗ gọi xử lý đúng một lần, ở
 * đúng một chỗ.
 */
export function conLai(nowMs: number, hanMs: number = HAN_DANG_KY): ConLai | null {
  const giay = giayConLai(nowMs, hanMs);
  return giay < 0 ? null : tachGiay(giay);
}

/** Đã quá hạn đăng ký chưa. Đúng ms hạn đã tính là ĐÓNG (khớp `conLai` trả null). */
export function daDongDangKy(nowMs: number, hanMs: number = HAN_DANG_KY): boolean {
  return nowMs >= hanMs;
}

/** Mốc mở check-in, dạng epoch ms. Xem `EVENT.moCheckinISO` để biết vì sao UTC. */
export const MO_CHECKIN = Date.parse(EVENT.moCheckinISO);

/**
 * Đã tới giờ cho mẹ tự check-in chưa.
 *
 * Đúng ms mốc đã tính là MỞ — đối xứng với `daDongDangKy`, và biên nào cũng phải
 * thuộc hẳn về một phía chứ không rơi vào khe giữa hai hàm.
 *
 * Chỉ áp cho self check-in bằng QR/link của mẹ. Nhân viên check-in hộ trong
 * `/admin` KHÔNG đi qua đây: khoá tay ops là khoá đúng người đang cứu tình huống.
 */
export function daMoCheckin(nowMs: number, mocMs: number = MO_CHECKIN): boolean {
  return nowMs >= mocMs;
}
