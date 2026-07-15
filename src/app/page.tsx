import Image from "next/image";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Reveal } from "@/components/Reveal";
import { AnchorButton, ButtonLink } from "@/components/ui/Button";
import { WaitlistForm } from "@/components/WaitlistForm";
import { APP_FEATURES, EVENT, SITE } from "@/lib/constants";

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

function PhoneMockup({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={`relative w-fit rounded-[2.5rem] border-[10px] border-ink/90 bg-ink/90 shadow-2xl ${className}`}
    >
      {/* The source capture is a tall (390×1100) full app screen. Crop it to a
          real phone aspect with object-cover so the mockup reads as a phone —
          not a skinny sliver — and comfortably fits one viewport. Mobile sizes
          by width; desktop sizes by height (minus header + hero padding). */}
      <div className="relative aspect-[9/19] w-[185px] overflow-hidden rounded-[1.8rem] sm:w-[225px] md:h-[min(calc(100dvh_-_13rem),580px)] md:w-auto">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(min-width: 768px) 280px, 225px"
          className="object-cover object-top"
          priority
        />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <Header />

      <main>
        {/* ---------- Hero — one viewport, no internal scroll ---------- */}
        <section className="relative flex min-h-[calc(100dvh_-_4rem)] items-center overflow-hidden px-5 py-12">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-8 md:grid-cols-2 md:gap-12">
            <div className="animate-reveal text-center md:text-left">
              <span className="inline-flex items-center gap-2.5 rounded-full bg-primary-faded py-2 pr-4 pl-4 text-sm font-bold text-primary">
                <span
                  aria-hidden="true"
                  className="relative flex h-2 w-2 shrink-0 items-center justify-center"
                >
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                Sắp ra mắt trên
                <span aria-hidden="true" className="h-3.5 w-px bg-primary/30" />
                <span
                  role="img"
                  aria-label="App Store và Google Play"
                  className="flex items-center gap-2 text-primary-pressed"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden="true">
                    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
                  </svg>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                    <path d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z" />
                  </svg>
                </span>
              </span>

              <h1 className="mt-5 text-4xl leading-tight font-extrabold text-ink sm:text-5xl">
                {SITE.tagline}
              </h1>

              <p className="mx-auto mt-4 max-w-md text-lg leading-7 text-ink-faded md:mx-0">
                Bú, ngủ, bỉm, sức khoẻ và tuần phát triển — tất cả trong một ứng dụng.
                Ghi lại chỉ bằng một chạm, kể cả khi mẹ đang bế bé một tay.
              </p>

              {/* One button. It scrolls to the email form at the foot of the
                  page via native smooth-scroll — no form clutter in the hero. */}
              <div className="mt-8">
                <AnchorButton href="#nhan-tin">Nhận tin khi ra mắt</AnchorButton>
              </div>
            </div>

            <div className="relative flex justify-center">
              {/* Soft blush behind the phone, echoing the app's warm background. */}
              <div
                aria-hidden="true"
                className="absolute top-1/2 left-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-faded blur-3xl"
              />
              <PhoneMockup
                src="/images/app-home.png"
                alt="Màn hình chính của ứng dụng Mama Ơi"
                className="animate-float"
              />
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

        {/* ---------- Wonder Week: the app's differentiator ---------- */}
        <section className="flex min-h-[100dvh] flex-col justify-center px-5 py-16">
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

        {/* ---------- Bridge to the event ---------- */}
        <section className="flex min-h-[100dvh] flex-col justify-center px-5 py-16">
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
            <ButtonLink href="/su-kien" className="mt-8">
              Tìm hiểu sự kiện
            </ButtonLink>
          </Reveal>
        </section>

        {/* ---------- Closing waitlist CTA — the email lives here ---------- */}
        <section
          id="nhan-tin"
          className="flex min-h-[100dvh] scroll-mt-20 flex-col justify-center px-5 py-16"
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
                {/* Notify bell with a pulsing dot — echoes the hero "coming soon" cue. */}
                <span className="relative mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-faded text-primary">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-7 w-7"
                    aria-hidden="true"
                  >
                    <path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0M3.124 7.5A8.969 8.969 0 0 1 5.292 3m13.416 0a8.969 8.969 0 0 1 2.168 4.5" />
                  </svg>
                  <span aria-hidden="true" className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                    <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-primary ring-2 ring-white" />
                  </span>
                </span>

                <h2 className="mt-5 text-2xl font-extrabold text-ink sm:text-3xl">
                  Nhận tin khi Mama Ơi ra mắt
                </h2>
                <p className="mx-auto mt-2.5 max-w-sm text-base leading-7 text-ink-faded sm:text-lg">
                  Để lại email, mẹ sẽ là người đầu tiên biết.
                </p>

                <div className="mt-7 text-left">
                  <WaitlistForm />
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </>
  );
}
