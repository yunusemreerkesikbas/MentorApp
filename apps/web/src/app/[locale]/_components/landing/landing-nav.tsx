import { Logo } from "@mentor/ui";
import { getTranslations } from "next-intl/server";
import { LEDGE_FILLED } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";

const NAV_LINK = `inline-flex min-h-11 items-center whitespace-nowrap px-2 text-body-sm font-bold sm:px-3 text-[var(--landing-on-night)] underline-offset-4 hover:underline ${FOCUS}`;

/** The play ledge at nav height (LEDGE is 56px tall). */
const NAV_CTA = `inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[var(--play-radius)] px-3 text-body-sm font-extrabold outline-none transition-[transform,box-shadow] duration-[120ms] ease-out active:translate-y-1 active:shadow-none motion-reduce:transition-none sm:px-5 ${FOCUS} ${LEDGE_FILLED}`;

/**
 * The bar that floats over the scene and stays there. On a phone it keeps the wordmark, "Giriş yap"
 * and the CTA. "Koçlar için" and "SSS" join it with the sections they point to.
 */
export async function LandingNav() {
  const t = await getTranslations("landing");
  return (
    <header className="fixed inset-x-0 top-0 z-30 px-3 pt-3 sm:px-4 sm:pt-4">
      <nav
        aria-label={t("nav_label")}
        className="mx-auto flex h-14 max-w-6xl items-center gap-1 rounded-[var(--play-radius)] border border-[var(--landing-frost-line)] bg-[var(--landing-frost)] pl-4 pr-2 sm:h-16 sm:gap-3 sm:pl-8 lg:pl-10"
      >
        <Link
          href="/"
          className={`inline-flex min-h-11 items-center text-xl text-[var(--landing-on-night)] sm:text-2xl ${FOCUS}`}
        >
          <Logo />
        </Link>
        {/* A stop anchor in the scene: the stage turns the jump into a camera move. */}
        <a href="#durak-1" className={`${NAV_LINK} max-lg:hidden`}>
          {t("how_it_works")}
        </a>
        <Link href="/knowledge" className={`${NAV_LINK} max-sm:hidden`}>
          {t("blog")}
        </Link>
        <a href="#sss" className={`${NAV_LINK} max-lg:hidden`}>
          {t("faq_nav")}
        </a>
        <Link href="/login" className={`${NAV_LINK} ml-auto`}>
          {t("login")}
        </Link>
        <Link href="/welcome" className={NAV_CTA}>
          {t("start")}
        </Link>
      </nav>
    </header>
  );
}
