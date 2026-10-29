import { Logo } from "@mentor/ui";
import { getLocale, getTranslations } from "next-intl/server";
import { PublicFooter } from "@/components/public-footer";
import { Link } from "@/i18n/navigation";

const FOOTER_LINK =
  "inline-flex min-h-11 items-center text-body-sm font-bold text-[var(--landing-on-night-soft)] underline-offset-4 hover:text-[var(--landing-on-night)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";

/**
 * Wordmark, Blog and the other language, then the shared legal footer on the night ink. Only the
 * other language is linked: the English page is a courtesy copy (noindex), Turkish is canonical.
 */
export async function LandingFooter() {
  const [t, coaches, locale] = await Promise.all([getTranslations("landing"), getTranslations("coaches"), getLocale()]);
  const other =
    locale === "en"
      ? ({ locale: "tr", label: "Türkçe" } as const)
      : ({ locale: "en", label: "English" } as const);
  return (
    <div className="landing-footer rounded-t-[var(--play-sheet-radius)] bg-[var(--landing-footer)] pt-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 pb-4 sm:flex-row sm:items-start sm:justify-between sm:px-8 lg:px-10">
        <div>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-2xl text-[var(--landing-on-night)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            <Logo />
          </Link>
          <p className="text-body-sm text-[var(--landing-on-night-soft)]">{t("tagline")}</p>
        </div>
        <ul className="flex flex-wrap gap-x-6">
          <li>
            <Link href="/knowledge" className={FOOTER_LINK}>
              {t("blog")}
            </Link>
          </li>
          <li>
            <Link href="/for-coaches" className={FOOTER_LINK}>
              {coaches("nav_coaches")}
            </Link>
          </li>
          <li>
            <Link href="/" locale={other.locale} lang={other.locale} className={FOOTER_LINK}>
              {other.label}
            </Link>
          </li>
        </ul>
      </div>
      <PublicFooter wide />
      <p className="mx-auto max-w-6xl px-5 pb-8 text-caption text-[var(--landing-on-night-soft)] sm:px-8 lg:px-10">
        © {new Date().getFullYear()} PuhuKoç
      </p>
    </div>
  );
}
