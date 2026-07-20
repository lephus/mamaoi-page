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
  EVENT_EXPERTS,
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
      <h2 className="mt-4 text-2xl font-extrabold text-ink sm:text-4xl">
        {title}
      </h2>
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
  // Quà tặng hấp dẫn — gift
  {
    tint: "bg-primary-faded text-primary",
    path: "M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z",
  },
  // Hoạt động thú vị — sparkles
  {
    tint: "bg-teal-faded text-teal",
    path: "M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z",
  },
  // Tư vấn chuyên sâu — academic cap
  {
    tint: "bg-info-faded text-info",
    path: "M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5",
  },
  // Gặp gỡ giao lưu — users
  {
    tint: "bg-secondary-faded text-secondary",
    path: "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
  },
  // Check-in sống ảo — camera
  {
    tint: "bg-warning-faded text-warning",
    path: "M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316ZM16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z",
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

/**
 * One tone + Heroicon per timeline moment, aligned to EVENT_TIMELINE order.
 * Reuses the app's six-colour rotation (same system as the feature/gift rows)
 * so each moment reads as its own on-brand accent — check-in → coral, talkshow
 * → blue, tea break → amber, cooking → sage, lucky draw → violet, closing → teal.
 */
const TIMELINE_STYLES = [
  // Check-in — ticket
  {
    tone: "bg-primary-faded text-primary",
    path: "M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z",
  },
  // Talkshow — microphone
  {
    tone: "bg-info-faded text-info",
    path: "M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z",
  },
  // Tea Break — cup (custom stroke, matches Heroicons weight)
  {
    tone: "bg-warning-faded text-warning",
    path: "M4 8.5h11v4.5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8.5Z M15 9.5h1.5a2.25 2.25 0 0 1 0 4.5H15 M8 3v2 M11 3v2",
  },
  // Cooking Show — fire
  {
    tone: "bg-secondary-faded text-secondary",
    path: "M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z M12 18a3.75 3.75 0 0 0 .495-7.467 5.99 5.99 0 0 0-1.925 3.546 5.974 5.974 0 0 1-2.133-1A3.75 3.75 0 0 0 12 18Z",
  },
  // Lucky Draw — sparkles
  {
    tone: "bg-violet-faded text-violet",
    path: "M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z",
  },
  // Bế mạc — camera
  {
    tone: "bg-teal-faded text-teal",
    path: "M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z",
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
        <section className="relative flex min-h-[calc(100dvh_-_4rem)] flex-col justify-center overflow-hidden px-5 py-6">
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-12">
            {/* Bé Gạo — key visual chính. DOM đứng trước nên trên mobile ảnh nằm trên;
                desktop dùng md:order-2 để đẩy sang phải, khối chữ về bên trái. */}
            <div className="relative order-1 flex justify-center md:order-2">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-faded blur-3xl"
              />
              <Image
                src="/images/illo-baby-girl.png"
                alt="Bé Gạo — nhân vật của Mama Ơi Day"
                width={640}
                height={640}
                priority
                className="animate-float relative w-[240px] drop-shadow-xl sm:w-[300px] md:w-[360px]"
              />
            </div>

            {/* Khối chữ — canh giữa trên mobile, canh trái trên desktop. */}
            <div className="order-2 text-center md:order-1 md:text-left">
              <span className="inline-block rounded-full bg-white px-4 py-1.5 text-sm font-bold text-primary shadow-sm">
                Miễn phí · Giới hạn {EVENT.capacity}
              </span>

              <h1 className="mt-4 text-4xl leading-tight font-extrabold text-ink sm:text-5xl">
                Mama Ơi Day
              </h1>
              {/* Slogan chính thức theo KV. Dài hơn dòng cũ nên `text-balance`
                  chia hai dòng cho cân thay vì để rơi một chữ xuống dòng dưới. */}
              <p className="mt-2 text-xl leading-snug font-bold text-balance text-primary sm:text-2xl">
                Gắn kết thương hiệu – lan tỏa yêu thương
              </p>

              <div className="mt-6 inline-flex flex-col gap-3 rounded-2xl bg-white px-6 py-4 text-left shadow-[var(--shadow-card)] sm:flex-row sm:gap-8">
                <div>
                  <p className="text-sm text-ink-faded">Thời gian</p>
                  <p className="text-lg font-bold text-ink">
                    {EVENT.dateLabel}
                  </p>
                </div>
                <div className="hidden w-px bg-line sm:block" />
                <div>
                  <p className="text-sm text-ink-faded">Địa điểm</p>
                  <p className="text-lg font-bold text-ink">{EVENT.venue}</p>
                  <p className="text-sm text-ink-faded">{EVENT.address}</p>
                </div>
              </div>

              <div className="mt-6">
                <ButtonLink href="#dang-ky">Đăng ký ngay</ButtonLink>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
                {EVENT_STATS.map((s) => (
                  <div key={s.label}>
                    <dt className="sr-only">{s.label}</dt>
                    <dd>
                      <span className="block text-3xl font-extrabold text-primary sm:text-4xl">
                        <CountUp to={s.value} plus={s.plus} />
                      </span>
                      <span className="mt-1.5 block text-base font-bold text-balance text-ink sm:text-lg">
                        {s.label}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* ---------- Giới thiệu ---------- */}
        <section className="px-5 py-14 sm:py-16">
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
                  <strong className="text-ink">một năm đầu đời</strong> — quãng
                  thời gian đẹp nhất, và cũng nhiều bỡ ngỡ nhất.
                </p>
                <p>
                  Chúng tôi tin rằng không người mẹ nào nên đi một mình. Mama Ơi
                  Day là ngày cả cộng đồng gặp nhau: học từ chuyên gia, thử
                  những điều mới cùng con, và tìm thấy những người mẹ đang ở
                  cùng chặng đường.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------- Gặp bé Gạo ---------- */}
        <section className="px-5 py-14 sm:py-16">
          <Reveal className="mx-auto grid max-w-5xl items-center gap-10 rounded-3xl bg-primary-faded p-8 sm:p-12 md:grid-cols-2 md:gap-16">
            {/* Cột hình — speech bubble đặt PHÍA TRÊN bé Gạo, không overlay lên các
                trang trí đã "nướng" sẵn ở 4 góc của PNG (mặt trời, mây, cầu vồng, hoa). */}
            <div className="order-1 flex flex-col items-center">
              <div className="relative mb-1 max-w-[15rem] rounded-2xl bg-white px-4 py-2.5 text-center text-sm font-bold text-ink shadow-[var(--shadow-card)]">
                Mẹ ơi! đến chơi với Gạo nhaaa...
                {/* Đuôi bong bóng trỏ xuống bé Gạo. */}
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 rounded-[3px] bg-white"
                />
              </div>
              <Image
                src="/images/illo-baby-girl.png"
                alt="Bé Gạo vẫy tay chào mẹ"
                width={640}
                height={640}
                className="animate-float w-[220px] sm:w-[260px]"
              />
            </div>

            {/* Cột chữ + thẻ passport (dựng bằng CSS/SVG, nằm trong cột này để chủ
                động layout — không đụng baked-art của ảnh). */}
            <div className="order-2 text-center md:text-left">
              <span className="inline-block rounded-full bg-white px-4 py-1.5 text-sm font-bold text-primary shadow-sm">
                Bé Gạo
              </span>
              <h2 className="mt-4 text-2xl font-extrabold text-ink sm:text-4xl">
                Gặp bé Gạo tại Mama Ơi Day
              </h2>
              <p className="mt-5 text-lg leading-7 text-ink-faded">
                Bé Gạo là người bạn nhỏ của cộng đồng Mama Ơi — cô bé sẽ cùng mẹ
                và bé đi hết một ngày thật vui: từ lúc check-in, qua từng hoạt
                động, đến khi ra về.
              </p>

              {/* Thẻ MAMA ƠI PASSPORT — trái tim là SVG inline (không dùng emoji). */}
              <div className="mt-6 inline-flex rotate-[-4deg] items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-[var(--shadow-card)] ring-1 ring-primary-border">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-faded text-primary">
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
                  </svg>
                </span>
                <span className="text-left leading-tight">
                  <span className="block text-[0.65rem] font-bold tracking-[0.18em] text-primary uppercase">
                    Mama Ơi
                  </span>
                  <span className="block text-lg font-extrabold text-ink">
                    Passport
                  </span>
                </span>
              </div>

              <p className="mt-6 text-lg leading-7 text-ink-faded">
                Đến check-in, mỗi mẹ nhận một tấm{" "}
                <strong className="text-ink">MAMA ƠI PASSPORT</strong> xinh xắn.
                Cùng bé Gạo ghi dấu qua mỗi hoạt động trong ngày — và mang tấm
                passport về nhà làm kỷ niệm.
              </p>

              {/*
                TODO(client): nếu client xác nhận cơ chế passport (đóng dấu đủ hoạt động
                → đổi quà đặc biệt cuối ngày), thêm hàng 3 bước: Nhận passport → Ghi dấu
                từng hoạt động → Đổi quà. Giữ copy "làm kỷ niệm" cho tới khi được duyệt.
              */}
            </div>
          </Reveal>
        </section>

        {/* ---------- Điểm nổi bật ---------- */}
        <section className="px-5 py-14 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="Điểm nổi bật"
              title="Điều gì đang chờ mẹ?"
            />
            {/* flex-wrap chứ không phải grid: năm mục không chia hết cho lưới bốn
                cột, grid sẽ bỏ lại một card mồ côi lệch trái ở hàng dưới. Wrap
                cho hàng cuối tự căn giữa — 3 + 2 cân đối. */}
            <ul className="mt-12 flex flex-wrap justify-center gap-5">
              {EVENT_HIGHLIGHTS.map((h, i) => {
                const s = HIGHLIGHT_STYLES[i % HIGHLIGHT_STYLES.length];
                return (
                  // Reveal (the .reveal class) owns the scroll fade-up transform;
                  // the hover lift/shadow lives on the inner card so the two never
                  // fight over the transform, and it animates smoothly.
                  <Reveal
                    key={h.title}
                    as="li"
                    delay={(i % 3) * 50}
                    className="h-full w-full sm:w-[calc(50%-0.625rem)] lg:w-[calc(33.333%-0.834rem)]"
                  >
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
        <section className="px-5 py-14 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="Diễn giả"
              title="Học từ những người đi trước"
            >
              Chuyên gia đầu ngành về mẹ và bé, cùng những người mẹ truyền cảm
              hứng.
            </SectionHeading>

            {/* Featured — the announced guest(s), given a spotlight card. */}
            <div className="mt-12 space-y-6">
              {EVENT_SPEAKERS.map((s) => (
                <Reveal key={s.name}>
                  <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-faded to-white p-6 shadow-[var(--shadow-card)] ring-1 ring-primary-border sm:p-8">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-primary-faded blur-3xl"
                    />
                    <div className="relative flex flex-col items-center gap-6 text-center sm:flex-row sm:gap-8 sm:text-left">
                      {s.photo && (
                        <div className="relative shrink-0">
                          <Image
                            src={s.photo}
                            alt={s.name}
                            width={320}
                            height={320}
                            className="h-40 w-40 rounded-full object-cover object-top shadow-lg ring-4 ring-white sm:h-52 sm:w-52"
                          />
                          {/* Star medallion marks the special guest. */}
                          <span
                            aria-hidden="true"
                            className="absolute right-1 bottom-1 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white shadow-md ring-4 ring-white sm:right-2 sm:bottom-2"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="h-5 w-5"
                            >
                              <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                            </svg>
                          </span>
                        </div>
                      )}
                      <div className="relative">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-bold text-primary shadow-sm">
                          <svg
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="h-4 w-4"
                            aria-hidden="true"
                          >
                            <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                          </svg>
                          {s.role}
                        </span>
                        <h3 className="mt-3 text-2xl font-extrabold text-ink sm:text-4xl">
                          {s.name}
                        </h3>
                        <p className="mt-2 max-w-md text-base leading-6 text-ink-faded">
                          Đồng hành cùng mẹ và bé tại Mama Ơi Day.
                        </p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* Chuyên gia — tiểu sử dài nên đoạn đầu hiện sẵn, phần còn lại nằm
                sau <details>. Dùng thẻ native chứ không phải state React: mẹ đọc
                được cả khi JS chưa tải xong, và Ctrl+F của trình duyệt vẫn tìm
                thấy chữ bên trong. */}
            <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {EVENT_EXPERTS.map((s, i) => (
                <Reveal
                  key={s.name}
                  as="li"
                  delay={(i % 3) * 60}
                  className="h-full"
                >
                  <div className="flex h-full flex-col items-center rounded-2xl bg-white p-6 text-center shadow-[var(--shadow-card)] ring-1 ring-line">
                    <Image
                      src={s.photo}
                      alt={s.name}
                      width={320}
                      height={320}
                      className="h-28 w-28 rounded-full object-cover shadow-md ring-4 ring-primary-faded"
                    />
                    <h3 className="mt-4 text-lg font-bold text-ink">
                      {s.name}
                    </h3>
                    <span className="mt-2 rounded-full bg-primary-faded px-3 py-1 text-xs font-semibold text-primary">
                      {s.role}
                    </span>

                    {/* <summary> BẮT BUỘC là con đầu tiên của <details> — đặt sau
                        thì trình duyệt tự sinh marker riêng và nút bấm hỏng. Nên
                        DOM để summary trước, còn `order-last` đẩy nó xuống dưới
                        về mặt hiển thị. */}
                    <details className="group mt-4 flex w-full flex-col text-left">
                      <summary className="order-last mt-3 inline-flex cursor-pointer list-none items-center gap-1 text-sm font-bold text-primary hover:underline [&::-webkit-details-marker]:hidden">
                        <span className="group-open:hidden">Xem thêm</span>
                        <span className="hidden group-open:inline">
                          Thu gọn
                        </span>
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4 transition-transform group-open:rotate-180"
                          aria-hidden="true"
                        >
                          <path d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                      </summary>
                      {/* line-clamp chỉ áp khi ĐANG đóng: mở ra là bỏ cắt dòng,
                          nên không chữ nào của khách bị mất. */}
                      <p className="line-clamp-3 text-base leading-6 text-ink-faded group-open:line-clamp-none">
                        {s.bio[0]}
                      </p>
                      {s.bio.slice(1).map((p) => (
                        <p
                          key={p.slice(0, 24)}
                          className="mt-3 hidden text-base leading-6 text-ink-faded group-open:block"
                        >
                          {p}
                        </p>
                      ))}
                    </details>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- CTA #2 (middle) — scarcity, shaped like an event ticket ---------- */}
        <section className="px-5 py-14 sm:py-16">
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
                  <span className="text-xl font-extrabold text-ink sm:text-2xl">
                    suất
                  </span>
                </div>
                <p className="mx-auto mt-5 max-w-md text-base leading-7 text-ink-faded">
                  Đăng ký mở từ{" "}
                  <strong className="font-bold text-ink">
                    {EVENT.registrationOpens}
                  </strong>
                  . Giữ chỗ cho mẹ và bé ngay hôm nay.
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
                <p className="mt-4 text-sm text-ink-faded">
                  Miễn phí · {EVENT.dateLabel}
                </p>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ---------- Timeline ---------- */}
        <section className="px-5 py-14 sm:py-16">
          <div className="mx-auto w-full max-w-4xl">
            <SectionHeading eyebrow="Timeline" title="Một ngày của mẹ và bé" />

            {/*
              Alternating "day journey": a soft gradient spine runs down the middle
              (down the left on mobile), each moment a coloured icon medallion beaded
              onto it with its card. Rows reveal one-by-one as they scroll into view,
              sliding in from their own side (left/right) — so scrolling the section
              plays the day out. Motion is transform/opacity only and the directional
              slide is gated behind prefers-reduced-motion.
            */}
            <ol className="relative mt-14">
              {/* Spine — behind the medallions; stops short so bé Gạo caps the end. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-2 bottom-6 left-6 w-1 -translate-x-1/2 rounded-full bg-gradient-to-b from-primary-border via-primary-border to-transparent md:left-1/2"
              />

              {EVENT_TIMELINE.map((item, i) => {
                const s = TIMELINE_STYLES[i % TIMELINE_STYLES.length];
                const left = i % 2 === 0; // desktop side
                return (
                  <li key={item.title} className="relative mb-6 last:mb-0">
                    <Reveal
                      className={`relative ${left ? "reveal-left" : "reveal-right"}`}
                    >
                      {/* Icon medallion, beaded on the spine (ring punches it out). */}
                      <span
                        aria-hidden="true"
                        className={`absolute top-1.5 left-6 z-10 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full ring-4 ring-cream md:left-1/2 ${s.tone}`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.7}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-6 w-6"
                        >
                          <path d={s.path} />
                        </svg>
                      </span>

                      {/* Card — sits opposite the spine; alternates side on desktop. */}
                      <div
                        className={`ml-16 md:ml-0 md:w-[calc(50%-2.75rem)] ${
                          left
                            ? "md:mr-auto md:pr-4 md:text-right"
                            : "md:ml-auto md:pl-4 md:text-left"
                        }`}
                      >
                        <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-card)] transition-[translate,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:shadow-[var(--shadow-hover)]">
                          <span
                            className={`inline-block rounded-full px-3 py-1 text-xs font-extrabold tracking-wide text-ink ${s.tone}`}
                          >
                            {item.time}
                          </span>
                          <h3 className="mt-2.5 text-lg font-bold text-ink">
                            {item.title}
                          </h3>
                          <p className="mt-1 text-base leading-6 text-ink-faded">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </Reveal>
                  </li>
                );
              })}
            </ol>

            {/* bé Gạo caps the journey — the day ends with her (per the last item). */}
            <Reveal className="mt-2 flex flex-col items-center text-center">
              <Image
                src="/images/illo-baby-girl.png"
                alt=""
                width={640}
                height={640}
                className="w-20"
              />
              <p className="mt-2 text-sm text-ink-faded">
                Lịch trình có thể thay đổi. Ban tổ chức sẽ thông báo qua email.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ---------- Quà tặng ---------- */}
        <section className="px-5 py-14 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="Quà tặng"
              title="Mẹ về tay không? Không có đâu."
            >
              1.000 phần quà cho 500 mẹ — nghĩa là mẹ nào cũng có phần, và
              thường là nhiều hơn một.
            </SectionHeading>

            {/* Hai cột: Passport bên trái vì đó là món quà đặc trưng nhất và là
                thứ duy nhất mẹ nhìn thấy được trước khi đến; bốn nhóm quà còn lại
                xếp 2×2 bên phải để hai bên cân nhau thay vì ảnh nằm trên một dải
                card dàn ngang. Mobile xếp chồng, ảnh vẫn lên trước. */}
            <div className="mt-12 grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
              {/* Mobile chỉ hiện trang bìa: bản trải hai trang co lại thì chữ bên
                  trong không đọc nổi, thà cho xem rõ một nửa. */}
              <Reveal>
                <figure className="rounded-3xl bg-primary-faded p-5 text-center sm:p-8">
                  <Image
                    src="/images/passport-mama-oi-bia.webp"
                    alt="Bìa Mama Ơi Passport — sổ tay dành cho mẹ tại sự kiện"
                    width={700}
                    height={1122}
                    className="mx-auto w-full max-w-[240px] rounded-2xl shadow-lg sm:hidden"
                  />
                  <Image
                    src="/images/passport-mama-oi.webp"
                    alt="Mama Ơi Passport — bìa và trang thông tin thành viên"
                    width={1400}
                    height={1122}
                    className="mx-auto hidden w-full rounded-2xl shadow-lg sm:block"
                  />
                  <figcaption className="mt-5 text-base leading-6 text-ink-faded">
                    <span className="font-bold text-ink">Mama Ơi Passport</span>{" "}
                    — mỗi mẹ một cuốn, mang về làm kỷ niệm ngày đầu tiên của
                    hành trình.
                  </figcaption>
                </figure>
              </Reveal>

              <ul className="grid gap-4 sm:grid-cols-2">
                {EVENT_GIFTS.map((g, i) => {
                  const s = GIFT_STYLES[i % GIFT_STYLES.length];
                  return (
                    <Reveal
                      key={g.title}
                      as="li"
                      delay={(i % 4) * 50}
                      className="h-full"
                    >
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
                        <h3 className="text-lg font-bold text-ink">
                          {g.title}
                        </h3>
                        <p className="mt-2 text-base leading-6 text-ink-faded">
                          {g.description}
                        </p>
                      </div>
                    </Reveal>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>

        {/* ---------- Đối tác ---------- */}
        <section className="px-5 py-14 sm:py-16">
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
        <section className="px-5 py-14 sm:py-16">
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
                  <p className="mt-3 text-base leading-6 text-ink-faded">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Form đăng ký — CTA #3 (bottom) ---------- */}
        <section id="dang-ky" className="scroll-mt-20 px-5 py-14 sm:py-16">
          <div className="mx-auto max-w-2xl">
            <SectionHeading eyebrow="Đăng ký" title="Giữ chỗ cho mẹ và bé">
              Điền thông tin bên dưới. Mẹ sẽ nhận email xác nhận kèm mã QR
              check-in.
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
