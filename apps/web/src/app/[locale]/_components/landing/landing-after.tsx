import Image from "next/image";
import { headers } from "next/headers";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { LEDGE, LEDGE_FILLED } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import { fetchCoachSignupOpen } from "@/lib/coach-signup";
import { LandingBlog } from "./landing-blog";
import { LandingFocus } from "./landing-focus";
import { LandingJourney } from "./landing-journey";
import { LandingMorning } from "./landing-morning";
import { LEDGE_ON_PAPER, PAGE_FRAME, PAPER_PILL, PAPER_TITLE, PaperFaq } from "./landing-paper";

const FAQ = [1, 2, 3, 4, 5, 6] as const;

/**
 * The coach band. Hidden while coach signup is closed (it fails closed); its own Suspense boundary,
 * so the status read never holds the page back.
 */
async function CoachBand() {
  const [open, t] = await Promise.all([fetchCoachSignupOpen(), getTranslations("landing.coach_band")]);
  if (!open) return null;
  return (
    <section id="koclar" aria-labelledby="landing-coach-title" className={`${PAGE_FRAME} scroll-mt-24 pt-16 lg:pt-24`}>
      <div className="flex flex-col overflow-hidden rounded-[var(--play-sheet-radius)] bg-[var(--landing-coach)] px-6 pt-8 text-[var(--landing-on-night)] lg:flex-row lg:items-center lg:gap-8 lg:px-14 lg:pt-12">
        <div className="pb-2 lg:pb-12">
          <p className={`${PAPER_PILL} bg-[var(--landing-coach-pill)] text-[var(--landing-on-night)]`}>{t("pill")}</p>
          <h2 id="landing-coach-title" className={PAPER_TITLE}>
            {t("title")}
          </h2>
          <p className="mb-6 mt-3 max-w-xl text-lg leading-relaxed text-[var(--landing-coach-soft)]">{t("body")}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link
              href={{ pathname: "/signup", query: { rol: "koc" } }}
              className={`${LEDGE} bg-[var(--landing-on-night)] text-[var(--landing-coach)] shadow-[0_4px_0_var(--landing-coach-soft)] max-lg:w-full`}
            >
              {t("cta")}
            </Link>
            <Link
              href="/for-coaches"
              className="inline-flex min-h-11 items-center text-base font-bold text-[var(--landing-coach-soft)] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-lamp)]"
            >
              {t("more")}
            </Link>
          </div>
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

/**
 * After the dawn: the morning desk, the focus room, the night journey (quests and lights), the coach
 * band, the blog, the questions people ask, and one more way in.
 */
export async function LandingAfter() {
  const [t, nonce] = await Promise.all([
    getTranslations("landing"),
    headers().then((h) => h.get("x-nonce") ?? undefined),
  ]);

  return (
    // Slides over the last frame of the scene, like a page turning up from the bottom.
    <div className="landing-paper relative z-10 -mt-7 rounded-t-[var(--play-sheet-radius)] bg-[var(--landing-paper)] text-[var(--landing-ink)]">
      <LandingMorning />
      {/* Both read the availability flags (study rooms, economy): streamed, so nothing waits on them. */}
      <Suspense fallback={null}>
        <LandingFocus />
      </Suspense>
      <Suspense fallback={null}>
        <LandingJourney />
      </Suspense>
      <Suspense fallback={null}>
        <CoachBand />
      </Suspense>
      <Suspense fallback={null}>
        <LandingBlog />
      </Suspense>

      <PaperFaq
        pill={t("faq.pill")}
        title={t("faq.title")}
        items={FAQ.map((i) => ({ q: t(`faq.q${i}`), a: t(`faq.a${i}`) }))}
        nonce={nonce}
      />

      <section aria-labelledby="landing-final-title" className={`${PAGE_FRAME} flex flex-col items-center pb-24 pt-16 text-center lg:pt-24`}>
        <div aria-hidden="true" className="lc-bigwin">
          <Image src="/visuals/landing/room-puhu.webp" alt="" fill sizes="200px" className="object-cover" />
        </div>
        <h2 id="landing-final-title" className={PAPER_TITLE}>
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
    </div>
  );
}
