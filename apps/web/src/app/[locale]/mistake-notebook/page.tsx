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
import { NotebookDemoWidget } from "./_components/notebook-demo-widget";

type PageProps = { params: Promise<{ locale: string }> };

const FAQ_INDICES = [1, 2, 3, 4, 5, 6] as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("mistakeNotebookLp");
  const title = t("meta_title");
  const description = t("meta_description");
  const canonical = `${siteUrl()}${getPathname({ locale: "tr", href: "/mistake-notebook" })}`;
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

export default async function MistakeNotebookLpPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, nonce, messages] = await Promise.all([
    getTranslations("mistakeNotebookLp"),
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
              <div className="mt-6 flex flex-wrap gap-3">
                <SeoSignupCta
                  source="notebook"
                  location="hero"
                  className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}
                >
                  {t("cta_primary")}
                </SeoSignupCta>
                <a
                  href="#nasil-calisir"
                  className={`${LEDGE} ${LEDGE_ON_PAPER} max-sm:w-full`}
                >
                  {t("cta_secondary")}
                </a>
              </div>
            </div>

            <NotebookDemoWidget
              copy={{
                pill: t("demo.pill"),
                badge: t("demo.badge"),
                subject: t("demo.subject"),
                question: t("demo.question"),
                options: t("demo.options"),
                note: t("demo.note"),
                prompt: t("demo.prompt"),
                btnMissed: t("demo.btn_missed"),
                btnSolved: t("demo.btn_solved"),
                feedbackMissed: t("demo.feedback_missed"),
                feedbackSolved: t("demo.feedback_solved"),
                cta: t("demo.cta"),
              }}
            />
          </section>

          <section aria-labelledby="notebook-what-title" className={`${PAGE_FRAME} pt-10 lg:pt-16`}>
            <div className="max-w-3xl">
              <p className={`${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>
                {t("what_pill")}
              </p>
              <h2 id="notebook-what-title" className={PAPER_TITLE}>
                {t("what_title")}
              </h2>
              <p className="mt-4 rounded-[var(--radius-card)] border border-[var(--landing-paper-line)] bg-[var(--color-surface)] p-5 text-base leading-relaxed font-semibold text-[var(--landing-ink)]">
                {t("what_body")}
              </p>
            </div>
          </section>

          <section id="nasil-calisir" aria-labelledby="notebook-how-title" className={`${PAGE_FRAME} scroll-mt-24 pt-16 lg:pt-24`}>
            <div className="max-w-3xl">
              <p className={`${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>
                {t("how.pill")}
              </p>
              <h2 id="notebook-how-title" className={PAPER_TITLE}>
                {t("how.title")}
              </h2>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {([1, 2, 3] as const).map((step) => (
                <article
                  key={step}
                  className="rounded-[var(--radius-card)] border border-[var(--landing-paper-line)] bg-[var(--color-surface)] p-5"
                >
                  <h3 className="text-lg font-extrabold text-[var(--landing-ink)]">
                    {t(`how.step${step}_title`)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--landing-ink-soft)]">
                    {t(`how.step${step}_body`)}
                  </p>
                </article>
              ))}
            </div>
            <div className="mt-6">
              <SeoSignupCta
                source="notebook"
                location="how"
                className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}
              >
                {t("cta_discover")}
              </SeoSignupCta>
            </div>
          </section>

          <section aria-labelledby="notebook-guide-title" className={`${PAGE_FRAME} pt-16 lg:pt-24`}>
            <div className="max-w-3xl">
              <p className={`${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>
                {t("guide.pill")}
              </p>
              <h2 id="notebook-guide-title" className={PAPER_TITLE}>
                {t("guide.title")}
              </h2>
              <ol className="mt-5 space-y-3 rounded-[var(--radius-card)] border border-[var(--landing-paper-line)] bg-[var(--color-surface)] p-6">
                {([1, 2, 3, 4] as const).map((item) => (
                  <li key={item} className="flex gap-3 text-base leading-relaxed text-[var(--landing-ink)]">
                    <span className="inline-flex size-6 flex-none items-center justify-center rounded-full bg-[var(--landing-pill)] text-xs font-black text-[var(--landing-pill-ink)]">
                      {item}
                    </span>
                    <span>{t(`guide.item${item}`)}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-base leading-relaxed text-[var(--landing-ink-soft)]">
                {t("guide.outro")}
              </p>
            </div>
          </section>

          <section aria-labelledby="notebook-ecosystem-title" className={`${PAGE_FRAME} pt-16 lg:pt-24`}>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-[var(--radius-card)] border border-[var(--landing-paper-line)] bg-[var(--color-surface)] p-6 lg:p-8">
                <p className={`${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>
                  {t("ecosystem.pill")}
                </p>
                <h2 id="notebook-ecosystem-title" className="mt-3 text-2xl font-black text-[var(--landing-ink)]">
                  {t("ecosystem.title")}
                </h2>
                <p className="mt-3 text-base leading-relaxed text-[var(--landing-ink-soft)]">
                  {t("ecosystem.body")}
                </p>
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-extrabold underline underline-offset-4">
                  <Link href="/study-app">{t("ecosystem.link_study_app")}</Link>
                  <Link href="/pomodoro-timer">{t("ecosystem.link_pomodoro")}</Link>
                  <Link href="/yks-study-program">{t("ecosystem.link_yks")}</Link>
                  <Link href="/tyt-study-program">{t("ecosystem.link_tyt")}</Link>
                  <Link href="/lgs-study-program">{t("ecosystem.link_lgs")}</Link>
                  <Link href="/knowledge">{t("ecosystem.link_blog")}</Link>
                </div>
              </div>
              <div className="rounded-[var(--radius-card)] border border-[var(--landing-paper-line)] bg-[var(--color-surface)] p-6 lg:p-8">
                <h2 className="text-2xl font-black text-[var(--landing-ink)]">
                  {t("ecosystem.who_title")}
                </h2>
                <p className="mt-3 text-base leading-relaxed text-[var(--landing-ink-soft)]">
                  {t("ecosystem.who_body")}
                </p>
              </div>
            </div>
          </section>

          <PaperFaq
            pill={t("faq.pill")}
            title={t("faq.title")}
            items={FAQ_INDICES.map((i) => ({ q: t(`faq.q${i}`), a: t(`faq.a${i}`) }))}
            nonce={nonce}
          />

          <section aria-labelledby="notebook-closing-title" className={`${PAGE_FRAME} flex flex-col items-center pb-24 pt-16 text-center lg:pt-24`}>
            <h2 id="notebook-closing-title" className={PAPER_TITLE}>
              {t("closing.title")}
            </h2>
            <p className="mt-3 max-w-xl text-lg text-[var(--landing-ink-soft)]">
              {t("closing.body")}
            </p>
            <div className="mt-7 flex w-full flex-wrap justify-center gap-3">
              <SeoSignupCta
                source="notebook"
                location="closing"
                className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}
              >
                {t("cta_primary")}
              </SeoSignupCta>
            </div>
          </section>
        </main>

        <LandingFooter />
      </div>
    </NextIntlClientProvider>
  );
}
