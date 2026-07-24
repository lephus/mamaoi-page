"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  datTuServer,
  docKho,
  theoDoiKho,
  type SoCho,
} from "@/lib/kho-cho-trong";
import { useDaDongDangKy } from "./Countdown";

/**
 * "Còn N/500 chỗ" — đếm ngược số chỗ trống theo số mã QR đã gửi ra.
 *
 * Khách chốt hiện công khai trên landing (feedback 24/07/2026, mục 9). Con số
 * lấy từ `/api/cho-trong`, cùng nguồn với cổng chặn trong `/api/dang-ky` nên
 * trang không bao giờ mời đăng ký trong khi form đang từ chối.
 *
 * `/` là trang tĩnh (HTML sinh lúc build) nên con số KHÔNG được nướng vào HTML —
 * nó sẽ già hàng tuần. Vì thế đây là mảnh client, gọi API sau khi hydrate xong.
 *
 * Sau khi mẹ đăng ký xong, `RegistrationForm` đẩy con số mới vào kho (xem
 * `lib/kho-cho-trong.ts`) nên mọi widget trên trang đổi ngay, không cần tải lại.
 * Quan trọng vì form điều hướng sang `/cam-on` bằng router client-side: module
 * này vẫn sống, và mẹ bấm quay lại `/` sẽ thấy đúng con số mới.
 */

/**
 * Nhiều chỗ trên trang cùng hiện con số này, nhưng chỉ được gọi API MỘT lần cho
 * mỗi lượt mở trang — nhớ promise ở cấp module để mọi instance dùng chung.
 */
let dangDoc: Promise<void> | null = null;

function taiLanDau(): Promise<void> {
  dangDoc ??= fetch("/api/cho-trong")
    .then((res) => (res.ok ? (res.json() as Promise<SoCho>) : null))
    .then((so) => {
      // `datTuServer` tự nhường nếu đã có số mới hơn từ lượt đăng ký.
      if (so) datTuServer(so);
    })
    .catch(() => {});
  return dangDoc;
}

export function ChoConLai({ className = "" }: { className?: string }) {
  // Ảnh chụp phía server là `null`: `/` sinh HTML lúc build, không có con số nào
  // đúng để nướng vào đó.
  const so = useSyncExternalStore(theoDoiKho, docKho, () => null);
  const daDong = useDaDongDangKy();

  useEffect(() => {
    void taiLanDau();
  }, []);

  // Chưa có số, đọc hỏng, hoặc đã đóng đăng ký: không hiện gì. Chỗ này thà trống
  // còn hơn hiện một con số đoán bừa — và sau khi đóng đăng ký thì "còn N chỗ"
  // là lời mời vào một cánh cửa đã khoá.
  if (daDong || so?.conLai == null) return null;

  const het = so.conLai === 0;

  return (
    <p
      className={`inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-bold text-ink shadow-sm ${className}`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full ${het ? "bg-ink-faded" : "animate-pulse bg-primary"}`}
      />
      {/* Số chỗ đi theo `gioiHan` trả về chứ không gõ "500" vào câu chữ: ops
          nâng EVENT_CAPACITY lên 550 mà câu vẫn đọc 500 là nói sai trước mặt mẹ. */}
      {het ? (
        `Đã đủ ${so.gioiHan} mẹ đăng ký`
      ) : (
        <span>
          Còn <span className="text-primary tabular-nums">{so.conLai}</span>/
          <span className="tabular-nums">{so.gioiHan}</span> chỗ
        </span>
      )}
    </p>
  );
}
