import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { LEGAL_UPDATED } from "@/lib/constants";

/** Shared shell for the privacy policy and terms pages. */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />

      <main className="px-5 py-12 sm:py-16">
        <article className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-extrabold text-ink sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-ink-faded">
            Cập nhật lần cuối: {LEGAL_UPDATED}
          </p>
          <p className="mt-6 text-lg leading-7 text-ink-faded">{intro}</p>

          <div
            className="
              mt-10 space-y-8
              [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink
              [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-ink
              [&_p]:mt-3 [&_p]:text-base [&_p]:leading-7 [&_p]:text-ink-faded
              [&_ul]:mt-3 [&_ul]:space-y-2 [&_ul]:pl-5
              [&_li]:list-disc [&_li]:text-base [&_li]:leading-7 [&_li]:text-ink-faded
              [&_a]:text-primary [&_a]:underline
              [&_strong]:text-ink
            "
          >
            {children}
          </div>
        </article>
      </main>

      <Footer />
    </>
  );
}

/** One numbered section of a legal document. */
export function LegalSection({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2>
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}
