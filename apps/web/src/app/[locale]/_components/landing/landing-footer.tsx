import { Logo } from "@mentor/ui";
import { getLocale, getTranslations } from "next-intl/server";
import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";
import { LEGAL_DOCUMENTS, LEGAL_SLUGS } from "@/lib/legal";

type Href = ComponentProps<typeof Link>["href"];

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";
const COLUMN_LINK = `inline-flex min-h-11 items-center text-body-sm font-bold text-[var(--landing-on-night-soft)] underline-offset-4 hover:text-[var(--landing-on-night)] hover:underline ${FOCUS}`;
const BAR_LINK = `inline-flex min-h-11 items-center text-caption text-[var(--landing-on-night-soft)] underline-offset-4 hover:text-[var(--landing-on-night)] hover:underline ${FOCUS}`;

function Column({ title, links }: { title: string; links: { href: Href; label: string }[] }) {
  return (
    <div>
      <h2 className="text-caption font-extrabold uppercase tracking-[0.08em] text-[var(--landing-on-night)]">{title}</h2>
      <ul className="mt-2">
        {links.map((link) => (
          <li key={link.label}>
            <Link href={link.href} className={COLUMN_LINK}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Wordmark + tagline, three titled link columns, then one quiet bottom bar with ©, the legal
 * documents and the other language. Only the other language is linked: the English page is a
 * courtesy copy (noindex), Turkish is canonical.
 */
export async function LandingFooter() {
  const [t, coaches, discovery, legal, locale] = await Promise.all([
    getTranslations("landing"),
    getTranslations("coaches"),
    getTranslations("communityDiscovery"),
    getTranslations("legal"),
    getLocale(),
  ]);
  const other =
    locale === "en"
      ? ({ locale: "tr", label: "Türkçe" } as const)
      : ({ locale: "en", label: "English" } as const);

  return (
    <div className="landing-footer rounded-t-[var(--play-sheet-radius)] bg-[var(--landing-footer)] pt-12">
      <nav
        aria-label={t("footer.nav_label")}
        className="mx-auto grid max-w-6xl gap-x-8 gap-y-8 px-5 pb-10 sm:px-8 md:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] lg:px-10"
      >
        <div>
          <Link href="/" className={`inline-flex min-h-11 items-center text-2xl text-[var(--landing-on-night)] ${FOCUS}`}>
            <Logo />
          </Link>
          <p className="text-body-sm text-[var(--landing-on-night-soft)]">{t("tagline")}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-6 md:contents">
          <Column
            title={t("footer.tools")}
            links={[
              { href: "/pomodoro-timer", label: t("footer.pomodoro") },
              { href: "/mistake-notebook", label: t("footer.notebook") },
              { href: "/study-app", label: t("morning.explore_study_app") },
            ]}
          />
          <Column
            title={t("footer.programs")}
            links={[
              { href: "/yks-study-program", label: t("plan.explore_yks") },
              { href: "/tyt-study-program", label: t("plan.explore_tyt") },
              { href: "/lgs-study-program", label: t("plan.explore_lgs") },
            ]}
          />
          <Column
            title={t("footer.brand")}
            links={[
              { href: "/discover-community", label: discovery("title") },
              { href: "/knowledge", label: t("blog") },
              { href: "/for-coaches", label: coaches("nav_coaches") },
            ]}
          />
        </div>
      </nav>
      <footer className="border-t border-[color-mix(in_srgb,var(--landing-on-night-soft)_22%,transparent)]">
        <div className="mx-auto max-w-6xl px-5 py-4 sm:px-8 lg:px-10">
          <nav aria-label={legal("footer_heading")}>
            <ul className="flex flex-wrap items-center gap-x-4">
              {LEGAL_SLUGS.map((slug) => (
                <li key={slug}>
                  <Link href={{ pathname: "/legal/[slug]", params: { slug } }} className={BAR_LINK}>
                    {locale === "en" ? LEGAL_DOCUMENTS[slug].en.title : LEGAL_DOCUMENTS[slug].tr.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-wrap items-center gap-x-4">
            <p className="mr-auto text-caption text-[var(--landing-on-night-soft)]">© {new Date().getFullYear()} PuhuKoç</p>
            <Link href="/cookie-preferences" className={BAR_LINK}>
              {legal("footer_cookie")}
            </Link>
            <Link
              href="/"
              locale={other.locale}
              lang={other.locale}
              className={`${BAR_LINK} font-bold text-[var(--landing-on-night)]`}
            >
              {other.label}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
