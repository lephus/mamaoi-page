"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

// useLayoutEffect warns during SSR; fall back to useEffect on the server.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Counts a number up from zero when it scrolls into view.
 *
 * The final value is rendered in the server HTML (and stays put for no-JS,
 * screen readers, and search engines). Only the client, only when the element
 * enters view, and only when the user hasn't asked for reduced motion, resets
 * it to zero and animates up — via direct textContent writes in a rAF loop, so
 * there is no per-frame React re-render. `tabular-nums` keeps every digit the
 * same width, so the surrounding layout never shifts as the count changes.
 */
export function CountUp({
  to,
  plus = false,
  duration = 1600,
  className = "",
}: {
  to: number;
  plus?: boolean;
  duration?: number;
  className?: string;
}) {
  const numRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef(0);

  useIsomorphicLayoutEffect(() => {
    const el = numRef.current;
    if (!el) return;

    // Reduced motion: leave the final value exactly as server-rendered.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Runs before paint, so the viewer sees "0" first — never a flash of the
    // final value dropping back to zero.
    el.textContent = "0";

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();

        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic — quick then settles
          el.textContent = Math.round(eased * to).toLocaleString("vi-VN");
          if (t < 1) rafRef.current = requestAnimationFrame(step);
        };
        rafRef.current = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );

    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [to, duration]);

  return (
    <span className={className}>
      <span ref={numRef} className="tabular-nums">
        {to.toLocaleString("vi-VN")}
      </span>
      {plus && "+"}
    </span>
  );
}
