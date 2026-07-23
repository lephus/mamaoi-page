"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export type GiftSlide = {
  src: string;
  /** Ảnh thay thế cho màn hình nhỏ — dùng khi bản desktop quá chi tiết để đọc
      khi co lại (vd Passport bản trải hai trang → dùng bìa trên mobile). */
  srcMobile?: string;
  alt: string;
  title: string;
  caption: string;
};

/**
 * Carousel ảnh quà tặng — tự viết, không thêm thư viện (đồng bộ với <Reveal>).
 *
 * - Tự chạy 5s/slide; dừng khi hover / focus / chạm; mỗi lần đổi slide (tay hay
 *   tự động) hẹn giờ đặt lại từ đầu. Máy bật "giảm chuyển động" thì không tự chạy
 *   (đọc qua matchMedia) — phần trượt cũng bị CSS reduced-motion khử animation.
 * - Điều hướng: mũi tên ◄►, chấm bấm tay, và vuốt trái/phải trên mobile.
 * - Khung tỉ lệ cố định + object-contain nên ảnh khác tỉ lệ vẫn nằm gọn, không
 *   gây nhảy layout giữa các slide.
 */
export function GiftCarousel({ slides }: { slides: readonly GiftSlide[] }) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  const goTo = (i: number) => setIndex(((i % count) + count) % count);

  // Tự chạy. Phụ thuộc `index` để mỗi lần đổi slide, đồng hồ 5s bắt đầu lại —
  // bấm tay xong mẹ vẫn có trọn 5s trước khi nó tự trôi tiếp.
  useEffect(() => {
    if (paused || count <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), 5000);
    return () => clearInterval(id);
  }, [index, paused, count]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) goTo(index + (dx < 0 ? 1 : -1));
    touchX.current = null;
  };

  const active = slides[index];

  return (
    <div
      className="mx-auto w-full max-w-2xl"
      role="group"
      aria-roledescription="carousel"
      aria-label="Ảnh quà tặng Mama Ơi Day"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Viewport — cắt phần slide nằm ngoài khung. */}
      <div
        className="relative overflow-hidden rounded-3xl bg-primary-faded shadow-[var(--shadow-card)] ring-1 ring-primary-border"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((s, i) => (
            <div
              key={s.src}
              className="w-full shrink-0"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}: ${s.title}`}
              aria-hidden={i !== index}
            >
              <div className="relative aspect-[4/3]">
                {s.srcMobile ? (
                  <>
                    <Image
                      src={s.srcMobile}
                      alt={s.alt}
                      fill
                      sizes="100vw"
                      className="object-contain p-4 sm:hidden"
                    />
                    <Image
                      src={s.src}
                      alt=""
                      fill
                      sizes="(max-width: 672px) 100vw, 672px"
                      className="hidden object-contain p-4 sm:block"
                    />
                  </>
                ) : (
                  <Image
                    src={s.src}
                    alt={s.alt}
                    fill
                    sizes="(max-width: 672px) 100vw, 672px"
                    className="object-contain"
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              aria-label="Ảnh trước"
              className="absolute top-1/2 left-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-ink shadow-md backdrop-blur-sm transition hover:bg-white focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label="Ảnh sau"
              className="absolute top-1/2 right-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-ink shadow-md backdrop-blur-sm transition hover:bg-white focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Caption — đổi theo slide đang mở. aria-live nhẹ để trình đọc màn hình
          thông báo khi ảnh chuyển. */}
      <div className="mt-5 text-center" aria-live="polite">
        <h3 className="text-lg font-bold text-ink">{active.title}</h3>
        <p className="mt-1 text-base leading-6 text-ink-faded">
          {active.caption}
        </p>
      </div>

      {count > 1 && (
        <div className="mt-4 flex justify-center gap-2.5">
          {slides.map((s, i) => (
            <button
              key={s.src}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Xem ảnh ${i + 1}: ${s.title}`}
              aria-current={i === index}
              className={`h-2.5 rounded-full transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none ${
                i === index
                  ? "w-6 bg-primary"
                  : "w-2.5 bg-primary-border hover:bg-primary/60"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
