"use client";

import type { ReactNode } from "react";
import { DA_DONG } from "@/lib/constants";
import { AnchorButton } from "./ui/Button";
import { useDaDongDangKy } from "./Countdown";

/**
 * Nút "Đăng ký ngay" tự tắt sau hạn đăng ký.
 *
 * Tồn tại vì `page.tsx` là server component: nó không hỏi được đồng hồ trên máy
 * mẹ. Đây là mảnh client nhỏ nhất bọc quanh chỗ đó.
 *
 * Khi hook trả `undefined` (chưa mount) thì nút VẪN bấm được. Đoán sai theo
 * hướng chặn nhầm mẹ trong lúc trang đang tải tệ hơn nhiều so với hiện thừa một
 * nút sống trong đúng một nhịp — nhất là ngày mở đăng ký, khi mẹ vừa bấm từ
 * Facebook sang.
 */
export function NutDangKy({
  href = "#dang-ky",
  className,
  children,
}: {
  href?: string;
  className?: string;
  children: ReactNode;
}) {
  const daDong = useDaDongDangKy();

  return (
    <AnchorButton href={href} disabled={daDong} className={className}>
      {daDong ? DA_DONG.nut : children}
    </AnchorButton>
  );
}
