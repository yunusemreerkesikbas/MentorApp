import Image from "next/image";
import { headers } from "next/headers";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { LEDGE, LEDGE_FILLED } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import { fetchCoachSignupOpen } from "@/lib/coach-signup";
import { jsonLdHtml } from "@/lib/json-ld";

const FAQ = [1, 2, 3, 4, 5, 6] as const;

const PILL = "inline-flex min-h-8 items-center rounded-full px-3 text-caption font-extrabold";
const SECTION_TITLE = "mt-3 text-display font-black tracking-[-0.01em] lg:text-section";
const LEDGE_ON_PAPER = "border-2 border-[var(--landing-paper-line)] text-[var(--landing-ink)]";
const FRAME = "mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10";

/**
 * The coach band. Hidden while coach signup is closed (it fails closed); its own Suspense boundary,
 * so the status read never holds the page back.
 */
async function CoachBand() {
  const [open, t] = await Promise.all([fetchCoachSignupOpen(), getTranslations("landing.coach_band")]);
  if (!open) return null;
  return (
    <section id="koclar" aria-labelledby="landing-coach-title" className={`${FRAME} scroll-mt-24 pt-16 lg:pt-24`}>
      <div className="flex flex-col overflow-hidden rounded-[var(--play-sheet-radius)] bg-[var(--landing-coach)] px-6 pt-8 text-[var(--landing-on-night)] lg:flex-row lg:items-center lg:gap-8 lg:px-14 lg:pt-12">
        <div className="pb-2 lg:pb-12">
          <p className={`${PILL} bg-[var(--landing-coach-pill)] text-[var(--landing-on-night)]`}>{t("pill")}</p>
          <h2 id="landing-coach-title" className={SECTION_TITLE}>
            {t("title")}
          </h2>
          <p className="mb-6 mt-3 max-w-xl text-lg leading-relaxed text-[var(--landing-coach-soft)]">{t("body")}</p>
          <Link
            href={{ pathname: "/signup", query: { rol: "koc" } }}
            className={`${LEDGE} bg-[var(--landing-on-night)] text-[var(--landing-coach)] shadow-[0_4px_0_var(--landing-coach-soft)] max-lg:w-full`}
          >
            {t("cta")}
          </Link>
        </div>
        <Image
          src="/mascot/puhu/puhu-host.png"
          alt=""
          width={1600}
          height={2000}
          sizes="(min-width: 1024px) 260px, 190px"
          className="mx-auto -mb-6 w-[190px] lg:-mb-10 lg:ml-auto lg:mr-0 lg:w-[260px]"
        />
      </div>
    </section>
  );
}

/** After the dawn: the coach band, the questions people ask, and one more way in. */
export async function LandingAfter() {
  const [t, nonce] = await Promise.all([
    getTranslations("landing"),
    headers().then((h) => h.get("x-nonce") ?? undefined),
  ]);
  const faq = FAQ.map((i) => ({ q: t(`faq.q${i}`), a: t(`faq.a${i}`) }));
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };

  return (
    // Slides over the last frame of the scene, like a page turning up from the bottom.
    <div className="landing-paper relative z-10 -mt-7 rounded-t-[var(--play-sheet-radius)] bg-[var(--landing-paper)] text-[var(--landing-ink)]">
      <Suspense fallback={null}>
        <CoachBand />
      </Suspense>

      <section id="sss" aria-labelledby="landing-faq-title" className={`${FRAME} scroll-mt-24 pt-16 lg:pt-24`}>
        <div className="max-w-4xl">
          <p className={`${PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>{t("faq.pill")}</p>
          <h2 id="landing-faq-title" className={SECTION_TITLE}>
            {t("faq.title")}
          </h2>
          <div className="mt-4 border-b border-[var(--landing-paper-line)]">
            {faq.map(({ q, a }) => (
              <details key={q} className="group border-t border-[var(--landing-paper-line)]">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] lg:text-lg [&::-webkit-details-marker]:hidden">
                  <span>{q}</span>
                  <b
                    aria-hidden="true"
                    className="flex size-8 flex-none items-center justify-center rounded-full bg-[var(--landing-pill)] text-xl transition-transform group-open:rotate-45 motion-reduce:transition-none"
                  >
                    +
                  </b>
                </summary>
                <p className="pb-5 text-base leading-relaxed text-[var(--landing-ink-soft)] lg:pr-12">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="landing-final-title" className={`${FRAME} flex flex-col items-center pb-24 pt-16 text-center lg:pt-24`}>
        <div aria-hidden="true" className="lc-bigwin">
          <Image src="/visuals/landing/room-puhu.webp" alt="" fill sizes="200px" className="object-cover" />
        </div>
        <h2 id="landing-final-title" className={SECTION_TITLE}>
          {t("final.title")}
        </h2>
        <p className="mt-3 text-lg text-[var(--landing-ink-soft)]">{t("final.body")}</p>
        <div className="mt-7 flex w-full flex-wrap justify-center gap-3">
          <Link href="/welcome" className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}>
            {t("start")}
          </Link>
          <Link href="/login" className={`${LEDGE} ${LEDGE_ON_PAPER} max-sm:w-full`}>
            {t("has_account")}
          </Link>
        </div>
      </section>

      <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(faqJsonLd) }} />
    </div>
  );
}
