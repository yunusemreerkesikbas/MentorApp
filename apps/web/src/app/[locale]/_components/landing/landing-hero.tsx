import { getTranslations } from "next-intl/server";
import { LEDGE, LEDGE_FILLED } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";

const LEDGE_ON_NIGHT =
  "border-2 border-[var(--landing-on-night-line)] text-[var(--landing-on-night)]";

/**
 * Stop 0: the headline and the two ways in. The city scene (stop B) is drawn behind it; until then
 * it sits on the night sky alone. Server-rendered and waits on nothing, so it is the first paint.
 */
export async function LandingHero() {
  const t = await getTranslations("landing");
  return (
    <section
      aria-labelledby="landing-title"
      className="flex min-h-svh items-center bg-[linear-gradient(180deg,var(--landing-night-top),var(--landing-night-bottom))] pb-16 pt-28"
    >
      {/* The app's page frame (PANEL_MAIN_CLASS), so the hero, the nav and the footer share one edge. */}
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10">
        <div className="max-w-xl">
          <p className="inline-flex min-h-8 items-center rounded-full border border-[var(--landing-lamp-line)] px-3.5 text-caption font-extrabold text-[var(--landing-lamp)]">
            {t("tagline")}
          </p>
          <h1
            id="landing-title"
            className="mt-4 text-balance text-hero font-black tracking-[-0.025em] text-[var(--landing-on-night)] lg:text-hero-lg"
          >
            {t.rich("hero_title", {
              glow: (chunks) => <span className="text-[var(--landing-lamp)]">{chunks}</span>,
            })}
          </h1>
          <p className="mt-4 max-w-lg text-pretty text-lg leading-relaxed text-[var(--landing-on-night-soft)]">
            {t("hero_lead")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/welcome" className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}>
              {t("start")}
            </Link>
            <Link href="/login" className={`${LEDGE} ${LEDGE_ON_NIGHT} max-sm:w-full`}>
              {t("has_account")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
