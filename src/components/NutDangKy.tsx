"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { DA_DONG, HET_CHO } from "@/lib/constants";
import { daHetCho, docKho, taiKhoLanDau, theoDoiKho } from "@/lib/kho-cho-trong";
import { AnchorButton } from "./ui/Button";
import { useDaDongDangKy } from "./Countdown";

/**
 * Nút "Đăng ký ngay" tự tắt sau hạn đăng ký, hoặc khi đã hết chỗ.
 *
 * Tồn tại vì `page.tsx` là server component: nó không hỏi được đồng hồ trên máy
 * mẹ, cũng không biết số chỗ còn lại lúc mẹ mở trang (trang `/` là HTML sinh lúc
 * build). Đây là mảnh client nhỏ nhất bọc quanh chỗ đó.
 *
 * Khi chưa biết gì (hook trả `undefined`, kho còn `null`) thì nút VẪN bấm được.
 * Đoán sai theo hướng chặn nhầm mẹ trong lúc trang đang tải tệ hơn nhiều so với
 * hiện thừa một nút sống trong đúng một nhịp — nhất là ngày mở đăng ký, khi mẹ
 * vừa bấm từ Facebook sang.
 *
 * Quá hạn xét TRƯỚC hết chỗ, cùng thứ tự với form: sự kiện đã qua thì "còn chỗ
 * hay không" không còn là câu hỏi nữa.
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
  const hetCho = daHetCho(useSyncExternalStore(theoDoiKho, docKho, () => null));

  useEffect(() => {
    void taiKhoLanDau();
  }, []);

  return (
    <AnchorButton href={href} disabled={daDong || hetCho !== null} className={className}>
      {daDong ? DA_DONG.nut : hetCho !== null ? HET_CHO.nutCta(hetCho) : children}
    </AnchorButton>
  );
}
