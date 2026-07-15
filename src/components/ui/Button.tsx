import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "outline";

const styles: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-hover active:bg-primary-pressed shadow-sm",
  outline:
    "bg-white text-primary border border-primary-border hover:bg-primary-faded-hover",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 " +
  "text-base font-bold cursor-pointer select-none " +
  // Scale up on hover, down on press — no vertical jump. `transition` (not an
  // explicit property list) is required: Tailwind v4 animates scale via the CSS
  // `scale` property, which a `transition-[transform]` list would miss, making
  // it snap instead of ease. The disabled resets keep a mid-submit button
  // inert; anchors are never disabled, so they always react.
  "transition duration-200 " +
  "hover:scale-[1.03] active:scale-[0.97] " +
  "disabled:hover:scale-100 disabled:active:scale-100 " +
  // A visible focus ring is the difference between usable and unusable for
  // anyone on a keyboard or screen reader.
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-cream " +
  "disabled:opacity-60 disabled:cursor-not-allowed";

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; children: ReactNode }) {
  return (
    <button className={`${base} ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </Link>
  );
}

/**
 * Same look as ButtonLink, but a plain in-page anchor. Used for hash links
 * (e.g. the hero's "leave your email" jump) so the browser's native
 * `scroll-behavior: smooth` handles the scroll — no JS, no router involvement.
 */
export function AnchorButton({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a href={href} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </a>
  );
}
