import type { Metadata } from "next";
import Image from "next/image";
import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Reveal } from "@/components/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import {
  APP_FEATURES,
  APP_STORE_URL,
  BABY_MILESTONES,
  EVENT,
  GOOGLE_PLAY_URL,
  SITE,
} from "@/lib/constants";

export const metadata: Metadata = {
  // The app intro moved off the root when the event became the homepage. Pin
  // its canonical here so search engines don't fold /ung-dung into the event
  // page — the root layout defaults every route's canonical to "/".
  alternates: { canonical: "/ung-dung" },
};

/**
 * Six distinct card tints, one per feature. Tailwind cannot see class names
 * built at runtime, so each is spelled out. Ordered so no two adjacent cards
 * share a hue — the grid reads as six colours, not three pairs.
 */
const FEATURE_TINT: Record<string, string> = {
  primary: "bg-primary-faded",
  warning: "bg-warning-faded",
  secondary: "bg-secondary-faded",
  violet: "bg-violet-faded",
  teal: "bg-teal-faded",
  info: "bg-info-faded",
};

/**
 * Ảnh chụp màn hình trên store, theo đúng thứ tự trên App Store. Mỗi tấm đã có
 * sẵn khung điện thoại và tiêu đề, nên trang chỉ bo góc + đổ bóng, không lồng
 * thêm khung nào nữa.
 */
const APP_SCREENS = [
  { src: "/images/app-screens/nhat-ky.webp", alt: "Nhật ký của bé, gọn trong một chạm" },
  { src: "/images/app-screens/ghi-cu-bu.webp", alt: "Ghi cữ bú chỉ vài giây" },
  { src: "/images/app-screens/ghi-am.webp", alt: "Chỉ cần nói, nhật ký tự ghi" },
  { src: "/images/app-screens/cot-moc.webp", alt: "Cột mốc phát triển theo từng tháng" },
  { src: "/images/app-screens/nhieu-be.webp", alt: "Nhiều bé, một ứng dụng" },
] as const;

/** Kích thước thật của ảnh đã xuất (828×1792, tỉ lệ store 1242×2688). */
const SCREEN_W = 828;
const SCREEN_H = 1792;

function StoreButton({
  href,
  store,
  icon,
}: {
  href: string;
  store: string;
  icon: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Tải Mama Ơi trên ${store}`}
      className="inline-flex w-[210px] items-center gap-3 rounded-2xl border border-line bg-white px-5 py-3 text-ink shadow-[var(--shadow-card)] transition duration-200 hover:-translate-y-0.5 hover:border-primary-border hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-cream focus-visible:outline-none active:translate-y-0"
    >
      {icon}
      <span className="flex flex-col text-left leading-tight">
        <span className="text-xs font-semibold text-ink-faded">Tải về trên</span>
        <span className="text-lg font-extrabold">{store}</span>
      </span>
    </a>
  );
}

/**
 * Both store buttons: light cards with each store's own mark, so a parent
 * recognises them at a glance without a heavy black block breaking the soft
 * palette. Used in the hero and again in the closing CTA.
 */
function StoreButtons({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap justify-center gap-3 ${className}`}>
      <StoreButton
        href={APP_STORE_URL}
        store="App Store"
        icon={
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7" aria-hidden="true">
            <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
          </svg>
        }
      />
      <StoreButton
        href={GOOGLE_PLAY_URL}
        store="Google Play"
        icon={
          <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
            <path fill="#4285F4" d="M3.6 1.8 13.8 12 3.6 22.2c-.4-.2-.6-.7-.6-1.2V3c0-.5.2-1 .6-1.2z" />
            <path fill="#34A853" d="M3.6 1.8c.4-.2.9-.2 1.4.1l12.2 6.7L13.8 12z" />
            <path fill="#FBBC04" d="m17.2 8.6 3.5 2c1 .6 1 2.2 0 2.8l-3.5 2-3.4-3.4z" />
            <path fill="#EA4335" d="m13.8 12 3.4 3.4L5 22.1c-.5.3-1 .3-1.4.1z" />
          </svg>
        }
      />
    </div>
  );
}

export default function AppPage() {
  return (
    <>
      <Header />

      <main>
        {/* ---------- Hero — one viewport, no internal scroll ---------- */}
        <section className="relative flex min-h-[calc(100dvh_-_4rem)] items-center overflow-hidden px-5 py-12">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-8 md:grid-cols-2 md:gap-12">
            <div className="animate-reveal text-center md:text-left">
              <h1 className="text-4xl leading-tight font-extrabold text-ink sm:text-5xl">
                {SITE.tagline}
              </h1>

              <p className="mx-auto mt-4 max-w-md text-lg leading-7 text-ink-faded md:mx-0">
                Bú, ngủ, bỉm, sức khoẻ và tuần phát triển — tất cả trong một ứng dụng.
                Ghi lại chỉ bằng một chạm, kể cả khi mẹ đang bế bé một tay.
              </p>

              <StoreButtons className="mt-8 md:justify-start" />
            </div>

            <div className="relative flex justify-center">
              {/* Soft blush behind the screens, echoing the app's warm background. */}
              <div
                aria-hidden="true"
                className="absolute top-1/2 left-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-faded blur-3xl"
              />
              {/* Fan of three store screens: two tilted behind (desktop only —
                  on a phone they would crowd the headline), the diary in front.
                  Desktop sizes by height so the hero stays one viewport. */}
              <div className="relative">
                <Image
                  src={APP_SCREENS[2].src}
                  alt=""
                  width={SCREEN_W}
                  height={SCREEN_H}
                  sizes="240px"
                  className="absolute top-1/2 right-[55%] hidden h-[min(calc(100dvh_-_17rem),500px)] w-auto -translate-y-1/2 -rotate-6 rounded-[1.75rem] shadow-xl md:block"
                />
                <Image
                  src={APP_SCREENS[3].src}
                  alt=""
                  width={SCREEN_W}
                  height={SCREEN_H}
                  sizes="240px"
                  className="absolute top-1/2 left-[55%] hidden h-[min(calc(100dvh_-_17rem),500px)] w-auto -translate-y-1/2 rotate-6 rounded-[1.75rem] shadow-xl md:block"
                />
                <Image
                  src={APP_SCREENS[0].src}
                  alt={APP_SCREENS[0].alt}
                  width={SCREEN_W}
                  height={SCREEN_H}
                  sizes="(min-width: 768px) 280px, 240px"
                  priority
                  className="animate-float relative h-auto w-[220px] rounded-[2rem] shadow-2xl sm:w-[250px] md:h-[min(calc(100dvh_-_13rem),580px)] md:w-auto"
                />
              </div>
            </div>
          </div>

          {/* Quiet scroll hint so the fold does not read as the whole page. */}
          <a
            href="#tinh-nang"
            aria-label="Xem tính năng"
            className="absolute bottom-5 left-1/2 -translate-x-1/2 text-ink-faded/60 transition-colors hover:text-primary"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="animate-float">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </section>

        {/* ---------- Features — six colours ---------- */}
        <section
          id="tinh-nang"
          className="flex min-h-[calc(100dvh_-_4rem)] scroll-mt-16 flex-col justify-center px-5 py-10"
        >
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-extrabold text-ink sm:text-4xl">
                Mọi thứ về con, gọn trong một nơi
              </h2>
              <p className="mt-4 text-lg leading-7 text-ink-faded">
                Không còn những mẩu giấy ghi vội hay cố nhớ xem bé bú lần cuối lúc mấy giờ.
              </p>
            </Reveal>

            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {APP_FEATURES.map((f, i) => (
                // Reveal (the .reveal class) owns the scroll fade-up transform.
                // The hover lift/shadow lives on an INNER card so the two never
                // fight over `transform` — otherwise .reveal.in-view pins it and
                // the shadow snaps in with no easing.
                <Reveal key={f.title} as="li" delay={(i % 3) * 60} className="h-full">
                  <div
                    className={`group flex h-full flex-col rounded-2xl p-5 transition-[translate,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:shadow-[var(--shadow-card)] ${
                      FEATURE_TINT[f.color] ?? "bg-primary-faded"
                    }`}
                  >
                    <Image
                      src={f.icon}
                      alt=""
                      width={160}
                      height={160}
                      className="h-16 w-16 object-contain transition-[scale] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
                    />
                    <h3 className="mt-3 text-lg font-bold text-ink">{f.title}</h3>
                    <p className="mt-1.5 text-base leading-6 text-ink-faded">
                      {f.description}
                    </p>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- Store screens — swipe on mobile, one row on desktop ---------- */}
        <section className="px-5 py-14 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-extrabold text-ink sm:text-4xl">
                Mama Ơi trong tay mẹ
              </h2>
              <p className="mt-4 text-lg leading-7 text-ink-faded">
                Chạm một lần hoặc chỉ cần nói — nhật ký của bé luôn gọn gàng.
              </p>
            </Reveal>

            {/* -mx-5/px-5 lets the swipe row run edge to edge on a phone while
                the first card still lines up with the page gutter. */}
            <ul className="-mx-5 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
              {APP_SCREENS.map((screen, i) => (
                <Reveal
                  key={screen.src}
                  as="li"
                  delay={i * 60}
                  className="w-[220px] shrink-0 snap-center lg:w-auto"
                >
                  <Image
                    src={screen.src}
                    alt={screen.alt}
                    width={SCREEN_W}
                    height={SCREEN_H}
                    sizes="(min-width: 1024px) 220px, 220px"
                    className="h-auto w-full rounded-[1.5rem] shadow-[var(--shadow-card)]"
                  />
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- Wonder Week: the app's differentiator ---------- */}
        <section className="px-5 py-14 sm:py-16">
          <Reveal className="mx-auto grid max-w-6xl items-center gap-12 rounded-3xl bg-white p-8 shadow-[var(--shadow-card)] sm:p-12 md:grid-cols-2">
            <div>
              <span className="inline-block rounded-full bg-secondary-faded px-4 py-1.5 text-sm font-bold text-secondary">
                Tuần phát triển
              </span>
              <h2 className="mt-5 text-2xl font-extrabold text-ink sm:text-4xl">
                Biết trước khi con quấy khóc
              </h2>
              <p className="mt-4 text-lg leading-7 text-ink-faded">
                Có những tuần bé bỗng nhiên bám mẹ, khó ngủ, quấy khóc không rõ lý do.
                Đó là <strong className="text-ink">Wonder Week</strong> — giai đoạn não bộ
                của bé đang nhảy vọt.
              </p>
              <p className="mt-3 text-lg leading-7 text-ink-faded">
                Mama Ơi tính sẵn các mốc này từ ngày dự sinh của bé, báo cho mẹ biết trước
                điều gì đang tới và cần làm gì. Mẹ hiểu con, thay vì tự trách mình.
              </p>
            </div>

            {/* The app's own two moods for a leap: the fussy phase, then the
                calm on the other side. Same artwork the mother sees in-app. */}
            <div className="flex items-center justify-center gap-4">
              <figure className="text-center">
                <Image
                  src="/images/emoji-cloud-grumpy.png"
                  alt=""
                  width={200}
                  height={200}
                  className="animate-float mx-auto w-24 object-contain sm:w-32"
                />
                <figcaption className="mt-2 text-sm font-semibold text-ink-faded">
                  Bé quấy, khó ngủ
                </figcaption>
              </figure>

              <span aria-hidden="true" className="text-2xl text-primary">
                →
              </span>

              <figure className="text-center">
                <Image
                  src="/images/emoji-sun-green.png"
                  alt=""
                  width={200}
                  height={200}
                  className="animate-float mx-auto w-24 object-contain sm:w-32"
                />
                <figcaption className="mt-2 text-sm font-semibold text-ink-faded">
                  Bé vui vẻ trở lại
                </figcaption>
              </figure>
            </div>
          </Reveal>
        </section>

        {/* ---------- Hành trình 12 tháng đầu đời — cột mốc, một tính năng của app ---------- */}
        <section className="px-5 py-14 sm:py-16">
          <div className="mx-auto max-w-6xl">
            {/* Desktop: nguyên infographic đã duyệt (đã crop bỏ dải QR + icon
                trùng với mục "Điều gì đang chờ mẹ" ở cuối ảnh). Ẩn trên mobile
                vì ảnh rộng 1600px, chữ co lại không đọc nổi. */}
            <Reveal className="hidden sm:block">
              <Image
                src="/images/hanh-trinh-12-thang.webp"
                alt="Hành trình 12 tháng đầu đời cùng Gạo — cột mốc phát triển của bé từ sơ sinh đến 12 tháng"
                width={1600}
                height={664}
                className="w-full rounded-3xl shadow-[var(--shadow-card)]"
              />
            </Reveal>

            {/* Mobile: dựng lại timeline từ CÙNG dữ liệu — đọc được trên điện
                thoại thay vì phải vuốt một tấm ảnh rộng. Dải nối dọc bên trái
                mô phỏng trục thời gian của infographic. */}
            <div className="sm:hidden">
              {/* Heading nội tuyến — SectionHeading là component riêng của trang
                  sự kiện, không mang sang đây. */}
              <Reveal className="mx-auto max-w-2xl text-center">
                <span className="inline-block rounded-full bg-primary-faded px-4 py-1.5 text-sm font-bold text-primary">
                  Hành trình của bé
                </span>
                <h2 className="mt-4 text-2xl font-extrabold text-ink sm:text-4xl">
                  12 tháng đầu đời cùng con
                </h2>
                <p className="mt-4 text-lg leading-7 text-balance text-ink-faded">
                  Mỗi cột mốc là một bước tiến diệu kỳ, từng ngày lớn lên và đầy
                  ắp yêu thương.
                </p>
              </Reveal>
              <ol className="relative mt-10 space-y-3 before:absolute before:top-6 before:bottom-6 before:left-6 before:w-px before:bg-primary-border">
                {BABY_MILESTONES.map((m) => (
                  <Reveal key={m.month} as="li" className="relative flex gap-4">
                    <span className="relative z-10 flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full bg-primary-faded text-primary ring-4 ring-cream">
                      <span className="text-lg leading-none font-extrabold">
                        {m.month}
                      </span>
                      <span className="text-[10px] leading-none font-semibold">
                        tháng
                      </span>
                    </span>
                    <div className="flex-1 rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
                      <h3 className="font-bold text-ink">{m.title}</h3>
                      <p className="mt-0.5 text-sm leading-5 text-ink-faded">
                        {m.desc}
                      </p>
                    </div>
                  </Reveal>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ---------- Bridge to the event ---------- */}
        <section className="px-5 py-14 sm:py-16">
          <Reveal className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-primary-faded p-8 text-center sm:p-12">
            <Image
              src="/images/illo-baby-girl.png"
              alt=""
              width={140}
              height={140}
              className="mx-auto h-32 w-32 object-contain"
            />
            <h2 className="mt-4 text-2xl font-extrabold text-ink sm:text-4xl">
              Gặp cộng đồng Mama Ơi ngoài đời thật
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-7 text-ink-faded">
              <strong className="text-ink">{EVENT.shortName}</strong> — một ngày trọn vẹn
              cho mẹ và bé, cùng chuyên gia, workshop và {EVENT.capacity} khác.
            </p>
            <p className="mt-2 text-base font-semibold text-primary">
              {EVENT.dateLabel} · {EVENT.venue}
            </p>
            <ButtonLink href="/" className="mt-8">
              Tìm hiểu sự kiện
            </ButtonLink>
          </Reveal>
        </section>

        {/* ---------- Closing download CTA ---------- */}
        <section
          id="tai-app"
          className="scroll-mt-20 px-5 py-14 sm:py-16"
        >
          <Reveal className="mx-auto w-full max-w-xl">
            <div className="relative overflow-hidden rounded-[2rem] bg-white px-6 py-10 shadow-[var(--shadow-card)] sm:px-10 sm:py-12">
              {/* Soft blush + sage blobs so the closing CTA reads as a scene. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary-faded blur-3xl"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-secondary-faded blur-3xl"
              />

              <div className="relative text-center">
                {/* The app icon exactly as it sits on the phone's home screen. */}
                <Image
                  src="/images/logo-app-icon.png"
                  alt=""
                  width={128}
                  height={128}
                  className="mx-auto h-16 w-16 rounded-2xl shadow-sm"
                />

                <h2 className="mt-5 text-2xl font-extrabold text-ink sm:text-3xl">
                  Tải Mama Ơi ngay hôm nay
                </h2>
                <p className="mx-auto mt-2.5 max-w-sm text-base leading-7 text-ink-faded sm:text-lg">
                  Đã có mặt trên App Store và Google Play.
                </p>

                <StoreButtons className="mt-7" />
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </>
  );
}
