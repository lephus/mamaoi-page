import type { Metadata } from "next";
import Image from "next/image";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ButtonLink } from "@/components/ui/Button";
import { EVENT } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Cảm ơn mẹ đã đăng ký",
  // A thank-you page has nothing to offer search engines, and indexing it would
  // let people land here without registering.
  robots: { index: false, follow: false },
};

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  return (
    <>
      <Header />

      <main className="flex flex-1 items-center px-5 py-16">
        <div className="mx-auto max-w-lg text-center">
          <Image
            src="/images/illo-baby-girl.png"
            alt=""
            width={180}
            height={180}
            className="mx-auto h-40 w-40 object-contain"
            priority
          />

          <h1 className="mt-6 text-2xl font-extrabold text-ink sm:text-4xl">
            Cảm ơn mẹ đã đăng ký!
          </h1>
          <p className="mt-4 text-lg leading-7 text-ink-faded">
            Mẹ đã có một chỗ tại <strong className="text-ink">{EVENT.shortName}</strong>.
            Email xác nhận kèm mã QR check-in đang trên đường tới hộp thư của mẹ.
          </p>

          {/*
            The code is shown here as well as emailed. If the email bounces, is
            delayed, or lands in spam, the mother still leaves this page holding
            the one thing she needs at the door.
          */}
          {code && (
            <div className="mt-8 rounded-2xl border border-primary-border bg-primary-faded px-6 py-5">
              <p className="text-sm text-ink-faded">Mã check-in của mẹ</p>
              <p className="mt-1 text-2xl font-extrabold tracking-widest text-primary">
                {code}
              </p>
              <p className="mt-2 text-xs text-ink-faded">
                Mẹ chụp màn hình lại nhé — phòng khi email vào mục spam.
              </p>
            </div>
          )}

          <dl className="mt-8 space-y-2 text-left text-base">
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 text-ink-faded">Thời gian</dt>
              <dd className="font-semibold text-ink">{EVENT.dateLabel}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 text-ink-faded">Địa điểm</dt>
              <dd className="font-semibold text-ink">
                {EVENT.venue}
                <span className="block font-normal text-ink-faded">{EVENT.address}</span>
              </dd>
            </div>
          </dl>

          <ButtonLink href="/" variant="outline" className="mt-10">
            Khám phá ứng dụng Mama Ơi
          </ButtonLink>
        </div>
      </main>

      <Footer />
    </>
  );
}
