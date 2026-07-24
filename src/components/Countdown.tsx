"use client";

import { useSyncExternalStore } from "react";
import { DA_DONG } from "@/lib/constants";
import {
  CHUA_BIET,
  daDongDangKy,
  giayConLai,
  HAN_DANG_KY,
  tachGiay,
  type ConLai,
} from "@/lib/countdown";

/**
 * Đồng hồ đếm ngược tới hạn đóng đăng ký + hook cho phần còn lại của trang.
 *
 * `useSyncExternalStore` chứ không useState+useEffect: đồng hồ hệ thống là nguồn
 * dữ liệu NGOÀI React, và hook này có sẵn `getServerSnapshot` riêng cho lúc
 * render ở server — đúng thứ cần ở đây.
 *
 * VÌ SAO CẦN ẢNH CHỤP RIÊNG CHO SERVER: `/` là trang tĩnh, HTML sinh lúc BUILD.
 * Số đếm ngược nướng vào HTML lúc build có thể già hàng tuần so với lúc mẹ mở
 * trang. Nên ảnh chụp phía server nói thẳng là "chưa biết", số thật chỉ xuất
 * hiện sau khi hydrate xong.
 */

/** setTimeout tràn ở mốc này và bắn NGAY thay vì chờ. Xem `theoDoiHan`. */
const TIMEOUT_TOI_DA = 2 ** 31 - 1;

function theoDoiMoiGiay(doiThi: () => void): () => void {
  const id = setInterval(doiThi, 1_000);
  return () => clearInterval(id);
}

/**
 * Chỉ báo đúng MỘT lần, tại đúng thời điểm hạn.
 *
 * Ba nút CTA chỉ cần biết *đã đóng chưa* — một boolean lật đúng một lần. Cho
 * chúng dùng chung `theoDoiMoiGiay` là bốn timer vẽ lại hero liên tục để trả lời
 * một câu hỏi yes/no.
 *
 * Delay vượt 2^31-1 ms (~24,8 ngày) bị tràn và `setTimeout` bắn NGAY LẬP TỨC.
 * Hạn còn 37 ngày tính từ lúc mở đăng ký, nên không chặn chỗ này thì trang tự
 * đóng đăng ký ngay khi mẹ vừa mở. Quá ngưỡng thì khỏi hẹn giờ — không ai mở một
 * tab liên tục 25 ngày.
 */
function theoDoiHan(doiThi: () => void): () => void {
  const con = HAN_DANG_KY - Date.now();
  if (con <= 0 || con > TIMEOUT_TOI_DA) return () => {};
  const id = setTimeout(doiThi, con);
  return () => clearTimeout(id);
}

/** `undefined` = chưa hydrate xong, `null` = đã hết hạn. */
export function useConLai(): ConLai | null | undefined {
  const giay = useSyncExternalStore(
    theoDoiMoiGiay,
    () => giayConLai(Date.now()),
    () => CHUA_BIET,
  );

  if (giay === CHUA_BIET) return undefined;
  return giay < 0 ? null : tachGiay(giay);
}

/**
 * Đã đóng đăng ký chưa.
 *
 * Trước khi hydrate xong luôn trả `false`, tức nút VẪN bấm được. Đoán sai theo
 * hướng chặn nhầm mẹ trong lúc trang đang tải tệ hơn nhiều so với hiện thừa một
 * nút sống trong đúng một nhịp — nhất là ngày mở đăng ký, khi mẹ vừa bấm từ
 * Facebook sang.
 */
export function useDaDongDangKy(): boolean {
  return useSyncExternalStore(
    theoDoiHan,
    () => daDongDangKy(Date.now()),
    () => false,
  );
}

function O({ so, nhan }: { so: number | undefined; nhan: string }) {
  return (
    <div className="min-w-[3.75rem] rounded-xl bg-white px-2.5 py-1.5 text-center shadow-sm">
      <span className="block text-2xl leading-tight font-extrabold text-primary tabular-nums">
        {so === undefined ? "--" : String(so).padStart(2, "0")}
      </span>
      <span className="block text-[0.6875rem] font-bold text-ink-faded">{nhan}</span>
    </div>
  );
}

export function Countdown() {
  const con = useConLai();

  if (con === null) {
    return (
      <span className="inline-block rounded-full bg-white px-4 py-1.5 text-sm font-bold text-primary shadow-sm">
        {DA_DONG.badge}
      </span>
    );
  }

  return (
    <div>
      {/* Bốn ô ẩn khỏi trình đọc màn hình: một vùng nhảy số mỗi giây sẽ bị đọc
          lại liên tục, không ai nghe nổi. Câu tóm tắt bên dưới chỉ đổi mỗi ngày
          một lần nên đọc ra là vừa đủ. */}
      <div aria-hidden="true" className="flex justify-center gap-2 md:justify-start">
        <O so={con?.ngay} nhan="ngày" />
        <O so={con?.gio} nhan="giờ" />
        <O so={con?.phut} nhan="phút" />
        <O so={con?.giay} nhan="giây" />
      </div>
      <p className="sr-only">
        {con === undefined
          ? "Đang tính thời gian còn lại để đăng ký Mama Ơi Day"
          : `Còn ${con.ngay} ngày để đăng ký Mama Ơi Day`}
      </p>
    </div>
  );
}
