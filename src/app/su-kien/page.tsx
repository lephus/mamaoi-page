import type { Metadata } from "next";
import Image from "next/image";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { CountUp } from "@/components/CountUp";
import { RegistrationForm } from "@/components/RegistrationForm";
import { Reveal } from "@/components/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import {
  EVENT,
  EVENT_FAQ,
  EVENT_GIFTS,
  EVENT_HIGHLIGHTS,
  EVENT_SPEAKERS,
  EVENT_STATS,
  EVENT_TIMELINE,
} from "@/lib/constants";

export const metadata: Metadata = {
  title: EVENT.shortName,
  description: `${EVENT.name}. ${EVENT.dateLabel} tại ${EVENT.venue}. Miễn phí, giới hạn ${EVENT.capacity}.`,
  openGraph: {
    title: `${EVENT.shortName} — ${EVENT.dateLabel}`,
    description: `Một ngày trọn vẹn cho mẹ và bé. ${EVENT.venue}. Giới hạn ${EVENT.capacity}.`,
  },
};

/** Google shows the date, venue and price directly in results for events. */
const eventJsonLd = {
  "@context": "https://schema.org",
  "@type": "Event",
  name: EVENT.name,
  startDate: EVENT.dateISO,
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  eventStatus: "https://schema.org/EventScheduled",
  location: {
    "@type": "Place",
    name: EVENT.venue,
    address: EVENT.address,
  },
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "VND",
    availability: "https://schema.org/InStock",
  },
  organizer: { "@type": "Organization", name: "Mama Ơi" },
};

function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  // Wrapping every heading in Reveal animates all event-page sections on scroll
  // from one place, instead of touching each section.
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      {eyebrow && (
        <span className="inline-block rounded-full bg-primary-faded px-4 py-1.5 text-sm font-bold text-primary">
          {eyebrow}
        </span>
      )}
      <h2 className="mt-4 text-2xl font-extrabold text-ink sm:text-4xl">{title}</h2>
      {children && (
        <p className="mt-4 text-lg leading-7 text-ink-faded">{children}</p>
      )}
    </Reveal>
  );
}

/**
 * One coloured icon per highlight, aligned to EVENT_HIGHLIGHTS order. Icons are
 * Heroicons (outline) — inline so no runtime icon dependency. Tints reuse the
 * design-system tokens so the row reads as four distinct, on-brand accents.
 */
const HIGHLIGHT_STYLES = [
  // Chuyên gia đầu ngành — academic cap
  {
    tint: "bg-primary-faded text-primary",
    path: "M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5",
  },
  // Hoạt động trải nghiệm — sparkles
  {
    tint: "bg-teal-faded text-teal",
    path: "M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z",
  },
  // Quà tặng giá trị — gift
  {
    tint: "bg-info-faded text-info",
    path: "M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z",
  },
  // Cộng đồng mẹ bỉm — users
  {
    tint: "bg-secondary-faded text-secondary",
    path: "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
  },
] as const;

/**
 * Gift cards get a festive coloured surface + a white icon chip — one accent
 * each so the row reads as four distinct rewards, not a wall of amber boxes.
 */
const GIFT_STYLES = [
  // Welcome Kit — gift
  {
    card: "bg-primary-faded",
    chip: "text-primary",
    path: "M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z",
  },
  // Passport Event — book-open
  {
    card: "bg-info-faded",
    chip: "text-info",
    path: "M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25",
  },
  // Quà từ đối tác — tag
  {
    card: "bg-teal-faded",
    chip: "text-teal",
    path: "M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z",
  },
  // Lucky Draw — sparkles
  {
    card: "bg-warning-faded",
    chip: "text-warning",
    path: "M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z",
  },
] as const;

export default function EventPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
      />
      <Header />

      <main>
        {/* ---------- Hero — CTA #1 (top) ---------- */}
        <section className="relative flex min-h-[100dvh] flex-col justify-center overflow-hidden px-5 pt-20 pb-16">
          <div
            aria-hidden="true"
            className="absolute top-0 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-primary-faded blur-3xl"
          />
          <div className="relative mx-auto max-w-3xl text-center">
            <span className="inline-block rounded-full bg-white px-4 py-1.5 text-sm font-bold text-primary shadow-sm">
              Miễn phí · Giới hạn {EVENT.capacity}
            </span>

            <h1 className="mt-6 text-4xl leading-tight font-extrabold text-ink sm:text-5xl">
              Mama Ơi Day
            </h1>
            <p className="mt-3 text-xl font-bold text-primary sm:text-2xl">
              Hành trình 1 năm đầu đời cùng con
            </p>

            <div className="mt-8 inline-flex flex-col gap-3 rounded-2xl bg-white px-6 py-5 text-left shadow-[var(--shadow-card)] sm:flex-row sm:gap-8">
              <div>
                <p className="text-sm text-ink-faded">Thời gian</p>
                <p className="text-lg font-bold text-ink">{EVENT.dateLabel}</p>
              </div>
              <div className="hidden w-px bg-line sm:block" />
              <div>
                <p className="text-sm text-ink-faded">Địa điểm</p>
                <p className="text-lg font-bold text-ink">{EVENT.venue}</p>
                <p className="text-sm text-ink-faded">{EVENT.address}</p>
              </div>
            </div>

            <div className="mt-8">
              <ButtonLink href="#dang-ky">Đăng ký ngay</ButtonLink>
            </div>

            <dl className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {EVENT_STATS.map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd>
                    <span className="block text-3xl font-extrabold text-primary sm:text-5xl">
                      <CountUp to={s.value} plus={s.plus} />
                    </span>
                    <span className="mt-2 block text-base font-bold text-balance text-ink sm:text-lg">
                      {s.label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ---------- Giới thiệu ---------- */}
        <section className="flex min-h-[100dvh] flex-col justify-center px-5 py-16">
          <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-2 md:gap-16">
            {/* App welcome screen, framed as a phone on a soft sage glow. */}
            <Reveal className="relative flex justify-center">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary-faded blur-3xl"
              />
              <div className="animate-float relative w-fit rounded-[2.5rem] border-[10px] border-ink/90 bg-ink/90 shadow-2xl">
                <Image
                  src="/images/app-welcome.png"
                  alt="Màn hình chào mừng của ứng dụng Mama Ơi"
                  width={390}
                  height={844}
                  className="w-56 rounded-[1.8rem] sm:w-60"
                />
              </div>
            </Reveal>

            <Reveal>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-faded px-4 py-1.5 text-sm font-bold text-secondary">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                </svg>
                Cộng đồng
              </span>
              <h2 className="mt-4 text-2xl font-extrabold text-ink sm:text-4xl">
                Về cộng đồng Mama Ơi
              </h2>
              <div className="mt-5 space-y-4 text-lg leading-7 text-ink-faded">
                <p>
                  Mama Ơi là cộng đồng của những người mẹ đang đi cùng con qua{" "}
                  <strong className="text-ink">một năm đầu đời</strong> — quãng thời gian
                  đẹp nhất, và cũng nhiều bỡ ngỡ nhất.
                </p>
                <p>
                  Chúng tôi tin rằng không người mẹ nào nên đi một mình. Mama Ơi Day là
                  ngày cả cộng đồng gặp nhau: học từ chuyên gia, thử những điều mới cùng
                  con, và tìm thấy những người mẹ đang ở cùng chặng đường.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------- Điểm nổi bật ---------- */}
        <section className="flex min-h-[100dvh] flex-col justify-center px-5 py-16">
          <div className="mx-auto max-w-6xl">
            <SectionHeading eyebrow="Điểm nổi bật" title="Điều gì đang chờ mẹ?" />
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {EVENT_HIGHLIGHTS.map((h, i) => {
                const s = HIGHLIGHT_STYLES[i % HIGHLIGHT_STYLES.length];
                return (
                  // Reveal (the .reveal class) owns the scroll fade-up transform;
                  // the hover lift/shadow lives on the inner card so the two never
                  // fight over the transform, and it animates smoothly.
                  <Reveal key={h.title} as="li" delay={(i % 4) * 50} className="h-full">
                    <div className="group flex h-full flex-col rounded-2xl bg-white p-6 shadow-[var(--shadow-card)] transition-[translate,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:shadow-[var(--shadow-hover)]">
                      <span
                        className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl transition-[scale] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110 ${s.tint}`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.7}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-6 w-6"
                          aria-hidden="true"
                        >
                          <path d={s.path} />
                        </svg>
                      </span>
                      <h3 className="text-lg font-bold text-ink">{h.title}</h3>
                      <p className="mt-2 text-base leading-6 text-ink-faded">
                        {h.description}
                      </p>
                    </div>
                  </Reveal>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ---------- Diễn giả ---------- */}
        <section className="flex min-h-[100dvh] flex-col justify-center px-5 py-16">
          <div className="mx-auto max-w-6xl">
            <SectionHeading eyebrow="Diễn giả" title="Học từ những người đi trước">
              Chuyên gia đầu ngành về mẹ và bé, cùng những người mẹ truyền cảm hứng.
            </SectionHeading>

            <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {EVENT_SPEAKERS.map((s, i) => (
                <Reveal key={s.name} as="li" delay={(i % 4) * 50} className="group text-center">
                  {s.photo ? (
                    <Image
                      src={s.photo}
                      alt={s.name}
                      width={320}
                      height={320}
                      className="mx-auto h-40 w-40 rounded-full object-cover object-top shadow-[var(--shadow-card)] transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    // TODO(client): supply the remaining speaker photos.
                    <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-primary-faded">
                      <span className="text-sm text-ink-faded">Ảnh diễn giả</span>
                    </div>
                  )}
                  <h3 className="mt-4 text-lg font-bold text-ink">{s.name}</h3>
                  <p className="text-base text-ink-faded">{s.role}</p>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- CTA #2 (middle) — scarcity, shaped like an event ticket ---------- */}
        <section className="flex min-h-[100dvh] flex-col justify-center px-5 py-16">
          <Reveal className="mx-auto w-full max-w-2xl">
            <div className="relative overflow-hidden rounded-[2rem] bg-white shadow-[var(--shadow-card)]">
              {/* Soft blush + sage blobs so the card reads as a scene, not a flat box. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-primary-faded blur-3xl"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-secondary-faded blur-3xl"
              />

              {/* Pitch — the scarcity number is the hook, so it leads. */}
              <div className="relative px-6 pt-10 pb-9 text-center sm:px-12">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-faded px-3.5 py-1.5 text-sm font-bold text-primary">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
                  </svg>
                  Số lượng có hạn
                </span>

                <p className="mt-6 text-sm font-bold tracking-[0.12em] text-ink-faded uppercase">
                  Chỉ có
                </p>
                <div className="mt-1 flex items-baseline justify-center gap-2.5">
                  <CountUp
                    to={parseInt(EVENT.capacity, 10)}
                    className="bg-gradient-to-br from-primary to-primary-pressed bg-clip-text text-6xl leading-none font-extrabold tracking-tight text-transparent sm:text-7xl"
                  />
                  <span className="text-xl font-extrabold text-ink sm:text-2xl">suất</span>
                </div>
                <p className="mx-auto mt-5 max-w-md text-base leading-7 text-ink-faded">
                  Đăng ký mở từ{" "}
                  <strong className="font-bold text-ink">{EVENT.registrationOpens}</strong>. Giữ
                  chỗ cho mẹ và bé ngay hôm nay.
                </p>
              </div>

              {/* Ticket tear-line: a dashed rule with a notch bitten out of each edge. */}
              <div aria-hidden="true" className="relative h-0">
                <span className="absolute top-1/2 -left-3.5 h-7 w-7 -translate-y-1/2 rounded-full bg-cream" />
                <span className="absolute top-1/2 -right-3.5 h-7 w-7 -translate-y-1/2 rounded-full bg-cream" />
                <div className="mx-8 border-t-2 border-dashed border-primary-border" />
              </div>

              {/* Action. */}
              <div className="relative px-6 pt-8 pb-10 text-center sm:px-12">
                <ButtonLink href="#dang-ky">Đăng ký ngay</ButtonLink>
                <p className="mt-4 text-sm text-ink-faded">Miễn phí · {EVENT.dateLabel}</p>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ---------- Timeline ---------- */}
        <section className="flex min-h-[100dvh] flex-col justify-center px-5 py-16">
          <div className="mx-auto max-w-3xl">
            <SectionHeading eyebrow="Timeline" title="Một ngày của mẹ và bé" />
            <ol className="mt-12 space-y-1">
              {EVENT_TIMELINE.map((item, i) => (
                <li key={item.title} className="flex gap-5">
                  <div className="flex flex-col items-center">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                      {item.time}
                    </span>
                    {i < EVENT_TIMELINE.length - 1 && (
                      <span aria-hidden="true" className="w-0.5 flex-1 bg-primary-border" />
                    )}
                  </div>
                  <div className="pb-8">
                    <h3 className="text-lg font-bold text-ink">{item.title}</h3>
                    <p className="mt-1 text-base leading-6 text-ink-faded">
                      {item.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-center text-sm text-ink-faded">
              Lịch trình có thể thay đổi. Ban tổ chức sẽ thông báo qua email.
            </p>
          </div>
        </section>

        {/* ---------- Quà tặng ---------- */}
        <section className="flex min-h-[100dvh] flex-col justify-center px-5 py-16">
          <div className="mx-auto max-w-6xl">
            <SectionHeading eyebrow="Quà tặng" title="Mẹ về tay không? Không có đâu.">
              Hàng ngàn phần quà từ các thương hiệu mẹ và bé uy tín.
            </SectionHeading>
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {EVENT_GIFTS.map((g, i) => {
                const s = GIFT_STYLES[i % GIFT_STYLES.length];
                return (
                  <Reveal key={g.title} as="li" delay={(i % 4) * 50} className="h-full">
                    <div
                      className={`group flex h-full flex-col rounded-2xl p-6 transition-[translate,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:shadow-[var(--shadow-hover)] ${s.card}`}
                    >
                      <span
                        className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm transition-[scale] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110 ${s.chip}`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.7}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-6 w-6"
                          aria-hidden="true"
                        >
                          <path d={s.path} />
                        </svg>
                      </span>
                      <h3 className="text-lg font-bold text-ink">{g.title}</h3>
                      <p className="mt-2 text-base leading-6 text-ink-faded">
                        {g.description}
                      </p>
                    </div>
                  </Reveal>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ---------- Đối tác ---------- */}
        <section className="flex min-h-[100dvh] flex-col justify-center px-5 py-16">
          <div className="mx-auto max-w-6xl">
            <SectionHeading eyebrow="Đối tác" title="Đồng hành cùng Mama Ơi" />
            {/*
              PLACEHOLDER — no sponsor logos supplied yet. Tiers are laid out so
              logos can be dropped in without touching the layout.
            */}
            <div className="mt-12 space-y-10">
              {(["Gold", "Silver", "Standard"] as const).map((tier, i) => (
                <div key={tier}>
                  <h3 className="mb-5 text-center text-sm font-bold tracking-wide text-ink-faded uppercase">
                    {tier}
                  </h3>
                  <ul className="flex flex-wrap justify-center gap-4">
                    {Array.from({ length: [3, 4, 6][i] }).map((_, j) => (
                      <li
                        key={j}
                        className="flex h-20 w-36 items-center justify-center rounded-xl border border-line bg-white text-xs text-ink-placeholder"
                      >
                        Logo
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="flex min-h-[100dvh] flex-col justify-center px-5 py-16">
          <div className="mx-auto w-full max-w-3xl">
            <SectionHeading eyebrow="FAQ" title="Mẹ đang thắc mắc?" />
            <div className="mt-12 space-y-3">
              {EVENT_FAQ.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-2xl bg-white px-6 py-5 shadow-sm"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold text-ink">
                    {item.q}
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-2xl leading-none text-primary transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-base leading-6 text-ink-faded">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Form đăng ký — CTA #3 (bottom) ---------- */}
        <section
          id="dang-ky"
          className="flex min-h-[100dvh] scroll-mt-20 flex-col justify-center px-5 py-16"
        >
          <div className="mx-auto max-w-2xl">
            <SectionHeading eyebrow="Đăng ký" title="Giữ chỗ cho mẹ và bé">
              Điền thông tin bên dưới. Mẹ sẽ nhận email xác nhận kèm mã QR check-in.
            </SectionHeading>

            <div className="mt-10 rounded-3xl bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
              <RegistrationForm />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
