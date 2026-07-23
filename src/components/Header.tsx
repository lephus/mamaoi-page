"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnchorButton, ButtonLink } from "./ui/Button";

const NAV = [
  { href: "/", label: "Mama Ơi Day" },
  { href: "/ung-dung", label: "Ứng dụng" },
];

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The event page is now the root: its CTA points at its own form; every other
  // page sends you to the event. Sending a visitor to a page they are already
  // on reads as broken.
  const cta =
    pathname === "/"
      ? { href: "#dang-ky", label: "Đăng ký ngay" }
      : { href: "/", label: "Mama Ơi Day" };

  // Link hash trong cùng trang (#dang-ky) phải là <a> thuần (AnchorButton) để
  // native scroll-behavior:smooth cuộn lại mỗi lần bấm — next/link (ButtonLink)
  // bỏ qua khi hash không đổi. Link sang trang khác ("/") vẫn dùng router.
  const CtaButton = cta.href.startsWith("#") ? AnchorButton : ButtonLink;

  return (
    <header
      className={`sticky top-0 z-50 transition-shadow duration-200 ${
        scrolled ? "bg-cream/90 backdrop-blur-md shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <Link href="/" className="flex items-center" aria-label="Mama Ơi — trang chủ">
          <Image
            src="/images/logo-header.png"
            alt="Mama Ơi"
            width={1095}
            height={187}
            className="h-7 w-auto"
            priority
          />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-base font-semibold transition-colors hover:text-primary ${
                pathname === item.href ? "text-primary" : "text-ink-faded"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <CtaButton href={cta.href} className="px-6 py-2.5 text-sm">
            {cta.label}
          </CtaButton>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Đóng menu" : "Mở menu"}
          className="cursor-pointer rounded-lg p-2 text-ink md:hidden"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {open ? (
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-line/50 bg-cream md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-2 py-3 text-base font-semibold ${
                  pathname === item.href ? "text-primary" : "text-ink"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <CtaButton
              href={cta.href}
              className="mt-2 w-full"
            >
              {cta.label}
            </CtaButton>
          </nav>
        </div>
      )}
    </header>
  );
}
