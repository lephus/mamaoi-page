"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";

/**
 * Băng chạy liên tục (marquee) — dùng chung cho hàng logo nhà tài trợ và hàng
 * card diễn giả.
 *
 * Render danh sách 2 lần rồi dịch track đúng -50% (= trọn một bản) nên điểm nối
 * trùng khít: chạy đều MỘT CHIỀU, lặp vô hạn, KHÔNG tua ngược, KHÔNG giật. Tốc độ
 * tuyến tính (~`secondsPerItem` giây cho mỗi mục trôi qua), đặt qua biến CSS
 * --marquee-duration. Hai mép mờ dần (mask trong globals.css).
 *
 * Rê chuột hoặc chạm/giữ (pointer enter) thì dừng — quan trọng với card diễn giả
 * bấm được, để người dùng nhắm trúng nút trên di động. Máy bật "giảm chuyển động":
 * tắt animation, ẩn bản nhân đôi, cuộn ngang bằng tay (globals.css).
 *
 * `items` nhận sẵn ReactNode (đã render ở server) + `key` để phân biệt — KHÔNG
 * truyền hàm render qua ranh giới server→client (hàm không serialize được). Mỗi
 * mục render 2 lần: instance của bản nhân đôi độc lập (card diễn giả có state
 * popup riêng), và được `aria-hidden` để trình đọc màn hình chỉ đọc một lần.
 *
 * Khoảng cách giữa mục dùng margin-right từng ô (KHÔNG phải flex gap): gap không
 * chèn sau ô cuối nên điểm nối -50% lệch; margin-right thì mỗi ô "gói" luôn khoảng
 * trống của mình → hai bản khít tuyệt đối.
 */
export function Marquee({
  items,
  ariaLabel,
  secondsPerItem = 3,
  itemClassName = "",
  gapClass = "mr-4",
  viewportClassName = "",
}: {
  items: readonly { key: string; content: ReactNode }[];
  ariaLabel: string;
  secondsPerItem?: number;
  itemClassName?: string;
  /** Khoảng cách giữa các ô (margin-right, đồng đều mọi ô để nối liền khít). */
  gapClass?: string;
  /**
   * Class thêm cho khung (viewport). `overflow-hidden` cắt cả chiều dọc nên card
   * có shadow tràn ra ngoài sẽ bị cụt — truyền padding dọc (vd `py-8`) để chừa chỗ.
   */
  viewportClassName?: string;
}) {
  const [paused, setPaused] = useState(false);
  const duration = items.length * secondsPerItem;

  return (
    <div
      className={`marquee-viewport overflow-hidden${
        viewportClassName ? ` ${viewportClassName}` : ""
      }`}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <ul
        aria-label={ariaLabel}
        className={`marquee${paused ? " is-paused" : ""}`}
        style={{ "--marquee-duration": `${duration}s` } as CSSProperties}
      >
        {[...items, ...items].map((item, i) => {
          const dup = i >= items.length;
          return (
            <li
              key={`${item.key}-${dup ? "b" : "a"}`}
              aria-hidden={dup}
              className={`${gapClass} flex shrink-0${itemClassName ? ` ${itemClassName}` : ""}${
                dup ? " marquee-dup" : ""
              }`}
            >
              {item.content}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
