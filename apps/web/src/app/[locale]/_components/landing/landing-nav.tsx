import { Logo } from "@mentor/ui";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";

const NAV_LINK = `inline-flex min-h-11 items-center whitespace-nowrap px-2 text-body-sm font-bold sm:px-3 text-[var(--landing-nav-ink)] underline-offset-4 hover:underline ${FOCUS}`;

/** The play ledge at nav height (LEDGE is 56px tall), in the page's CTA colour (`--landing-nav-cta`). */
const NAV_CTA = `inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[var(--play-radius)] px-3 text-body-sm font-extrabold outline-none transition-[transform,box-shadow] duration-[120ms] ease-out active:translate-y-1 active:shadow-none motion-reduce:transition-none sm:px-5 ${FOCUS} bg-[var(--landing-nav-cta)] text-[var(--landing-nav-cta-ink)] shadow-[0_4px_0_var(--landing-nav-cta-edge)]`;

/**
 * The bar that floats over the page and stays there. On a phone it keeps the wordmark, "Giriş yap"
 * and the CTA. `coaches` is the coach page: a daytime bar (`.landing-day`), its own sections, and the
 * coach CTA while coach signup is open.
 */
export async function LandingNav({
  variant = "home",
  coachSignupOpen = false,
}: {
  variant?: "home" | "coaches";
  coachSignupOpen?: boolean;
}) {
  const [t, c] = await Promise.all([getTranslations("landing"), getTranslations("coaches")]);
  const coaches = variant === "coaches";
  return (
    <header className="fixed inset-x-0 top-0 z-30 px-3 pt-3 sm:px-4 sm:pt-4">
      <nav
        aria-label={t("nav_label")}
        className="mx-auto flex h-14 max-w-6xl items-center gap-1 rounded-[var(--play-radius)] border border-[var(--landing-nav-line)] bg-[var(--landing-nav-bg)] pl-4 pr-2 sm:h-16 sm:gap-3 sm:pl-8 lg:pl-10"
      >
        <Link href="/" className={`inline-flex min-h-11 items-center text-xl text-[var(--landing-nav-ink)] sm:text-2xl ${FOCUS}`}>
          <Logo />
        </Link>
        {/* In-page anchors; on the landing the stage turns `#durak-N` into a camera move. */}
        <a href={coaches ? "#tur" : "#durak-1"} className={`${NAV_LINK} max-lg:hidden`}>
          {coaches ? c("nav_round") : t("how_it_works")}
        </a>
        {coaches ? (
          <>
            <Link href="/" className={`${NAV_LINK} max-lg:hidden`}>
              {c("nav_students")}
            </Link>
            <Link href="/for-coaches" aria-current="page" className={`${NAV_LINK} max-lg:hidden`}>
              {c("nav_coaches")}
            </Link>
          </>
        ) : (
          <>
            <Link href="/for-coaches" className={`${NAV_LINK} max-lg:hidden`}>
              {c("nav_coaches")}
            </Link>
            <Link href="/knowledge" className={`${NAV_LINK} max-sm:hidden`}>
              {t("blog")}
            </Link>
          </>
        )}
        <a href="#sss" className={`${NAV_LINK} max-lg:hidden`}>
          {t("faq_nav")}
        </a>
        <Link href="/login" className={`${NAV_LINK} ml-auto`}>
          {t("login")}
        </Link>
        {coaches ? (
          coachSignupOpen ? (
            <Link href={{ pathname: "/signup", query: { rol: "koc" } }} className={NAV_CTA}>
              {c("cta")}
            </Link>
          ) : null
        ) : (
          <Link href="/welcome" className={NAV_CTA}>
            {t("start")}
          </Link>
        )}
      </nav>
    </header>
  );
}
