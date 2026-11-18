import type { Metadata } from "next";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { LEDGE, LEDGE_FILLED } from "@/components/panel/panel-styles";
import { SeoSignupCta } from "@/components/seo-lp/seo-signup-cta";
import { setRequestLocale } from "@/i18n/locale";
import { getPathname, Link } from "@/i18n/navigation";
import { pickMessages, ROUTE_MESSAGE_SCOPES } from "@/i18n/scoped-messages";
import { siteUrl } from "@/lib/forum-public";
import { LandingFooter } from "../_components/landing/landing-footer";
import { LandingNav } from "../_components/landing/landing-nav";
import {
  LEDGE_ON_PAPER,
  PAGE_FRAME,
  PAPER_PILL,
  PAPER_TITLE,
  PaperFaq,
} from "../_components/landing/landing-paper";

type PageProps = { params: Promise<{ locale: string }> };

const FEATURE_INDICES = [1, 2, 3, 4, 5] as const;
const STEP_INDICES = [1, 2, 3, 4] as const;
const FAQ_INDICES = [1, 2, 3, 4, 5, 6] as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("studyAppLp");
  const title = t("meta_title");
  const description = t("meta_description");
  const canonical = `${siteUrl()}${getPathname({ locale: "tr", href: "/study-app" })}`;
  const ogImage = `${siteUrl()}/img/brand/puhukoc-og-${locale === "en" ? "en" : "tr"}.png`;
  return {
    title,
    description,
    alternates: { canonical },
    robots: locale === "en" ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "PuhuKoç",
      locale: locale === "en" ? "en_US" : "tr_TR",
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function StudyAppLpPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, nonce, messages] = await Promise.all([
    getTranslations("studyAppLp"),
    headers().then((h) => h.get("x-nonce") ?? undefined),
    getMessages(),
  ]);

  return (
    <NextIntlClientProvider messages={pickMessages(messages, ROUTE_MESSAGE_SCOPES.landing)}>
      <div className="landing-city-theme landing-day min-h-screen">
        <LandingNav variant="seo" />

        <main className="landing-paper pt-24 lg:pt-28">
          <section className={`${PAGE_FRAME} pb-10 pt-4 lg:pb-14`}>
            <div className="max-w-3xl">
              <p className={`${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>
                {t("eyebrow")}
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-[-0.015em] sm:text-4xl lg:text-5xl">
                {t("h1")}
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-[var(--landing-ink-soft)]">
                {t("subhead")}
              </p>
              <p className="mt-3 text-sm font-extrabold text-[var(--landing-ink-soft)]">
                {t("proof")}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <SeoSignupCta
                  source="study_app"
                  location="hero"
                  className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}
                >
                  {t("cta_primary")}
                </SeoSignupCta>
                <a
                  href="#ozellikler"
                  className={`${LEDGE} ${LEDGE_ON_PAPER} max-sm:w-full`}
                >
                  {t("cta_secondary")}
                </a>
              </div>
              <p className="mt-6 rounded-[var(--radius-card)] border border-[var(--landing-paper-line)] bg-[var(--color-surface)] p-5 text-base leading-relaxed font-semibold text-[var(--landing-ink)]">
                {t("definition")}
              </p>
            </div>
          </section>

          <section id="ozellikler" aria-labelledby="study-app-features-title" className={`${PAGE_FRAME} scroll-mt-24 pt-12 lg:pt-20`}>
            <div className="max-w-3xl">
              <p className={`${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>
                {t("features.pill")}
              </p>
              <h2 id="study-app-features-title" className={PAPER_TITLE}>
                {t("features.title")}
              </h2>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURE_INDICES.map((i) => (
                <article
                  key={i}
                  className="rounded-[var(--radius-card)] border border-[var(--landing-paper-line)] bg-[var(--color-surface)] p-6"
                >
                  <h3 className="text-lg font-extrabold text-[var(--landing-ink)]">
                    {t(`features.f${i}_title`)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--landing-ink-soft)]">
                    {t(`features.f${i}_body`)}
                  </p>
                </article>
              ))}
            </div>
            <div className="mt-6">
              <SeoSignupCta
                source="study_app"
                location="features"
                className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}
              >
                {t("cta_primary")}
              </SeoSignupCta>
            </div>
          </section>

          <section id="nasil" aria-labelledby="study-app-steps-title" className={`${PAGE_FRAME} scroll-mt-24 pt-16 lg:pt-24`}>
            <div className="max-w-3xl">
              <p className={`${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>
                {t("steps.pill")}
              </p>
              <h2 id="study-app-steps-title" className={PAPER_TITLE}>
                {t("steps.title")}
              </h2>
            </div>
            <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEP_INDICES.map((i) => (
                <li
                  key={i}
                  className="rounded-[var(--radius-card)] border border-[var(--landing-paper-line)] bg-[var(--color-surface)] p-5"
                >
                  <h3 className="text-base font-extrabold text-[var(--landing-ink)]">
                    {t(`steps.s${i}_title`)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--landing-ink-soft)]">
                    {t(`steps.s${i}_body`)}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="study-app-exams-title" className={`${PAGE_FRAME} pt-16 lg:pt-24`}>
            <div className="rounded-[var(--radius-card)] border border-[var(--landing-paper-line)] bg-[var(--color-surface)] p-6 lg:p-8">
              <p className={`${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>
                {t("exams.pill")}
              </p>
              <h2 id="study-app-exams-title" className="mt-3 text-2xl font-black text-[var(--landing-ink)]">
                {t("exams.title")}
              </h2>
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-[var(--landing-ink-soft)]">
                {t("exams.body")}
              </p>
              <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2.5 text-sm font-extrabold underline underline-offset-4">
                <li><Link href="/yks-study-program">{t("exams.link_yks")}</Link></li>
                <li><Link href="/tyt-study-program">{t("exams.link_tyt")}</Link></li>
                <li><Link href="/lgs-study-program">{t("exams.link_lgs")}</Link></li>
                <li><Link href="/pomodoro-timer">{t("exams.link_pomodoro")}</Link></li>
                <li><Link href="/mistake-notebook">{t("exams.link_notebook")}</Link></li>
                <li><Link href="/for-coaches">{t("exams.link_coaches")}</Link></li>
                <li><Link href="/knowledge">{t("exams.link_blog")}</Link></li>
              </ul>
            </div>
          </section>

          <PaperFaq
            pill={t("faq.pill")}
            title={t("faq.title")}
            items={FAQ_INDICES.map((i) => ({ q: t(`faq.q${i}`), a: t(`faq.a${i}`) }))}
            nonce={nonce}
          />

          <section aria-labelledby="study-app-closing-title" className={`${PAGE_FRAME} flex flex-col items-center pb-24 pt-16 text-center lg:pt-24`}>
            <h2 id="study-app-closing-title" className={PAPER_TITLE}>
              {t("closing.title")}
            </h2>
            <p className="mt-3 max-w-xl text-lg text-[var(--landing-ink-soft)]">
              {t("closing.body")}
            </p>
            <div className="mt-7 flex w-full flex-wrap justify-center gap-3">
              <SeoSignupCta
                source="study_app"
                location="closing"
                className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}
              >
                {t("cta_primary")}
              </SeoSignupCta>
              <Link href="/login" className={`${LEDGE} ${LEDGE_ON_PAPER} max-sm:w-full`}>
                {t("cta_login")}
              </Link>
            </div>
          </section>
        </main>

        <LandingFooter />
      </div>
    </NextIntlClientProvider>
  );
}
