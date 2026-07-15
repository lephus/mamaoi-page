"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/**
 * Reveals its children once they scroll into view.
 *
 * Progressive enhancement: the content is in the server HTML from the start, so
 * crawlers and no-JS users always get it (a <noscript> rule in the layout
 * unhides it). JS only adds the fade-up. Motion-averse users skip the animation
 * entirely — the element shows immediately.
 *
 * `delay` staggers siblings; keep it to 30–50ms per item so a grid ripples in
 * rather than crawling.
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: ElementType;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reduced motion is handled entirely in CSS (a media query forces `.reveal`
    // to its final state), so no JS special-case is needed here — the observer
    // may still run; the fade is simply overridden.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect(); // reveal once; never re-hide on scroll-up
        }
      },
      // Fire a touch before the element's top edge reaches the fold.
      { threshold: 0.1, rootMargin: "0px 0px -8% 0px" },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal ${shown ? "in-view" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
