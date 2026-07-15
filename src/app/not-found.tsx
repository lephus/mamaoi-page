import Image from "next/image";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ButtonLink } from "@/components/ui/Button";

/**
 * 404. Rendered with a real 404 status by Next's not-found convention.
 *
 * Keeps the header and footer so a lost visitor always has a way out, and
 * offers the two routes that actually matter — the app home and the event —
 * rather than dead-ending them.
 */
export default function NotFound() {
  return (
    <>
      <Header />

      <main className="flex min-h-[100dvh] items-center overflow-hidden px-5 py-16">
        <div className="animate-reveal relative mx-auto max-w-lg text-center">
          {/* Soft blush behind the character, matching the hero. */}
          <div
            aria-hidden="true"
            className="absolute top-8 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary-faded blur-3xl"
          />

          <Image
            src="/images/emoji-cloud-grumpy.png"
            alt=""
            width={200}
            height={200}
            className="animate-float relative mx-auto h-40 w-40 object-contain"
            priority
          />

          <p className="relative mt-2 text-6xl font-extrabold tracking-tight text-primary sm:text-7xl">
            404
          </p>

          <h1 className="relative mt-3 text-2xl font-extrabold text-ink sm:text-4xl">
            Ối! Trang này đi lạc mất rồi
          </h1>

          <p className="relative mx-auto mt-4 max-w-md text-lg leading-7 text-ink-faded">
            Trang mẹ đang tìm không tồn tại hoặc đã được chuyển đi nơi khác. Mẹ quay lại
            trang chủ nhé.
          </p>

          <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/">Về trang chủ</ButtonLink>
            <ButtonLink href="/su-kien" variant="outline">
              Khám phá Mama Ơi Day
            </ButtonLink>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
