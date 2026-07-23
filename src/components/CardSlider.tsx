"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Slider ngang cho một hàng card — thiếu chỗ thì trượt/vuốt thay vì xuống hàng.
 *
 * Dùng scroll-snap gốc của trình duyệt (không transform) nên nuốt được card cao
 * thấp khác nhau và card có nội dung mở/đóng bên trong. Vuốt/trackpad chạy sẵn;
 * cặp mũi tên chỉ hiện khi hàng tràn khỏi khung, và tự mờ đi ở hai đầu.
 *
 * Tự cuộn 3s/lần khi hàng bị tràn, dừng lúc hover / focus / chạm và tới cuối thì
 * quay về đầu. Cuộn mượt + tự cuộn đều bị khử khi máy bật "giảm chuyển động".
 */
export function CardSlider({
  children,
  ariaLabel,
}: {
  children: ReactNode;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [paused, setPaused] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setOverflow(max > 1);
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  // Tự cuộn 3s/lần: nhích một card, tới cuối thì quay về đầu. Chỉ chạy khi hàng
  // bị tràn và không bị tạm dừng (hover / focus / chạm); tắt khi "giảm chuyển động".
  useEffect(() => {
    if (!overflow || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      const el = ref.current;
      if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      const card = el.firstElementChild as HTMLElement | null;
      const step = card ? card.getBoundingClientRect().width + 20 : el.clientWidth * 0.8;
      el.scrollTo({
        left: el.scrollLeft >= max - 1 ? 0 : el.scrollLeft + step,
        behavior: "smooth",
      });
    }, 3000);
    return () => clearInterval(id);
  }, [overflow, paused]);

  const scrollByCard = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    // gap-5 = 20px; nhảy trọn một card mỗi lần bấm.
    const step = card ? card.getBoundingClientRect().width + 20 : el.clientWidth * 0.8;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * step, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      {overflow && (
        <div className="mb-4 flex justify-end gap-2">
          <SliderButton
            label="Xem diễn giả trước"
            disabled={atStart}
            onClick={() => scrollByCard(-1)}
            path="M15.75 19.5 8.25 12l7.5-7.5"
          />
          <SliderButton
            label="Xem diễn giả tiếp theo"
            disabled={atEnd}
            onClick={() => scrollByCard(1)}
            path="m8.25 4.5 7.5 7.5-7.5 7.5"
          />
        </div>
      )}
      <ul
        ref={ref}
        aria-label={ariaLabel}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>
    </div>
  );
}

function SliderButton({
  label,
  disabled,
  onClick,
  path,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  path: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-sm ring-1 ring-line transition hover:bg-primary-faded disabled:pointer-events-none disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
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
        <path d={path} />
      </svg>
    </button>
  );
}
