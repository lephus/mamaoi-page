import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { Analytics } from "@/components/Analytics";
import { SITE } from "@/lib/constants";
import "./globals.css";

/**
 * Nunito is the app's typeface. The "vietnamese" subset is not optional —
 * without it the diacritics in "Mama Ơi" fall back to another font mid-word.
 */
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s | ${SITE.name}`,
  },
  description:
    "Ứng dụng theo dõi hành trình lớn lên của bé: bú, ngủ, bỉm, sức khoẻ và tuần phát triển. Đồng hành cùng mẹ mỗi ngày.",
  keywords: [
    "Mama Ơi",
    "app theo dõi bé",
    "nhật ký bé",
    "wonder week",
    "tuần phát triển",
    "mẹ và bé",
    "Mama Ơi Day",
  ],
  applicationName: SITE.name,
  alternates: { canonical: "/" },
  // Traffic arrives from Facebook, so the share card is a conversion surface,
  // not an afterthought. The image is a purpose-built 1200×630 card — not the
  // tall phone screenshot, which Facebook would crop badly.
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description:
      "Ứng dụng theo dõi hành trình lớn lên của bé. Đồng hành cùng mẹ mỗi ngày.",
    images: [
      { url: "/og-image.png", width: 1200, height: 630, alt: `${SITE.name} — ${SITE.tagline}` },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: "Ứng dụng theo dõi hành trình lớn lên của bé.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#f08f8c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={`${nunito.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        {/* If JS never runs, scroll-reveal elements must not stay hidden. */}
        <noscript>
          <style>{`.reveal{opacity:1 !important;transform:none !important;}`}</style>
        </noscript>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
