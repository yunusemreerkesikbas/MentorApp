import "@fontsource-variable/caveat/wght.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { LandingFooter } from "@/app/[locale]/_components/landing/landing-footer";
import { LandingNav } from "@/app/[locale]/_components/landing/landing-nav";
import {
  LEDGE_ON_PAPER,
  PAGE_FRAME,
  PAPER_PILL,
  PAPER_TITLE,
  PaperFaq,
} from "@/app/[locale]/_components/landing/landing-paper";
import { LEDGE, LEDGE_FILLED } from "@/components/panel/panel-styles";
import { setRequestLocale } from "@/i18n/locale";
import { getPathname, Link } from "@/i18n/navigation";
import { pickMessages, ROUTE_MESSAGE_SCOPES } from "@/i18n/scoped-messages";
import { siteUrl } from "@/lib/forum-public";
import { jsonLdHtml } from "@/lib/json-ld";
import { buildWebApplicationStructuredData } from "@/lib/structured-data";
import { PlanDemoWidget } from "./plan-demo-widget";
import { SeoSignupCta } from "./seo-signup-cta";
import {
  getDemoConfig,
  getSampleWeekRows,
  type StudyProgramVariant,
} from "./study-program-lp-presets";

const ROUTE_MAP = {
  yks: "/yks-study-program",
  tyt: "/tyt-study-program",
  lgs: "/lgs-study-program",
} as const;

const FAQ_INDICES = [1, 2, 3, 4, 5, 6] as const;
const COMPARE_ROWS = [1, 2, 3, 4, 5, 6, 7] as const;

export async function generateStudyProgramMetadata(
  variant: StudyProgramVariant,
  locale: string,
): Promise<Metadata> {
  setRequestLocale(locale);
  const t = await getTranslations(`studyProgramLp.${variant}`);
  const title = t("meta_title");
  const description = t("meta_description");
  const canonical = `${siteUrl()}${getPathname({ locale: "tr", href: ROUTE_MAP[variant] })}`;
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

export async function StudyProgramLpTemplate({
  variant,
  locale,
}: {
  variant: StudyProgramVariant;
  locale: string;
}) {
  setRequestLocale(locale);
  const [c, v, nonce, messages] = await Promise.all([
    getTranslations("studyProgramLp.common"),
    getTranslations(`studyProgramLp.${variant}`),
    headers().then((h) => h.get("x-nonce") ?? undefined),
    getMessages(),
  ]);

  const origin = siteUrl();
  const canonical = `${origin}${getPathname({ locale: "tr", href: ROUTE_MAP[variant] })}`;
  const webAppJsonLd = buildWebApplicationStructuredData({
    name: v("schema_name"),
    url: canonical,
    description: v("schema_description"),
    siteOrigin: origin,
  });

  const sampleAnchor = variant === "tyt" ? "ornek-tyt" : "ornek";
  const sampleRows = getSampleWeekRows(variant, locale);
  const demoConfig = getDemoConfig(variant, locale);

  return (
    <NextIntlClientProvider messages={pickMessages(messages, ROUTE_MESSAGE_SCOPES.landing)}>
      <div className="landing-city-theme landing-day min-h-screen">
        {locale === "tr" ? (
          <script
            nonce={nonce}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLdHtml(webAppJsonLd) }}
          />
        ) : null}
        <LandingNav variant="seo" />

        <main className="landing-paper pt-24 lg:pt-28">
          <section className={`${PAGE_FRAME} pb-10 pt-4 lg:pb-14`}>
            <div className="max-w-3xl">
              <p className={`${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>
                {v("eyebrow")}
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-[-0.015em] sm:text-4xl lg:text-5xl">
                {v("h1")}
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-[var(--landing-ink-soft)]">
                {v("subhead")}
              </p>
              <p className="mt-3 text-sm font-extrabold text-[var(--landing-ink-soft)]">
                {c("proof")}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <SeoSignupCta
                  source={variant}
                  location="hero"
                  className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}
                >
                  {c("cta_build")}
                </SeoSignupCta>
                <a
                  href={`#${sampleAnchor}`}
                  className={`${LEDGE} ${LEDGE_ON_PAPER} max-sm:w-full`}
                >
                  {c("cta_sample")}
                </a>
                {variant === "lgs" ? (
                  <a
                    href="#veli"
                    className="inline-flex min-h-11 items-center px-3 text-sm font-extrabold text-[var(--landing-ink)] underline underline-offset-4"
                  >
                    {v("parent_pill")}
                  </a>
                ) : null}
              </div>
            </div>

            <PlanDemoWidget
              variant={variant}
              config={demoConfig}
              copy={{
                pill: c("demo_pill"),
                scribble: c("demo_scribble"),
                firstGroupLabel: variant === "lgs" ? c("demo_mode_label") : c("demo_field_label"),
                hoursLabel: c("demo_hours_label"),
                focusLabel: c("demo_focus_label"),
                note: c("demo_note"),
                saveCta: c("cta_save_plan"),
              }}
            />
          </section>

          <section id="nasil" aria-labelledby="program-how-title" className={`${PAGE_FRAME} scroll-mt-24 pt-12 lg:pt-20`}>
            <div className="max-w-3xl">
              <p className={`${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>
                {c("how_pill")}
              </p>
              <h2 id="program-how-title" className={PAPER_TITLE}>
                {c("how_title")}
              </h2>
              <p className="mt-4 rounded-[var(--radius-card)] border border-[var(--landing-paper-line)] bg-[var(--color-surface)] p-5 text-base leading-relaxed font-semibold text-[var(--landing-ink)]">
                {v("answer_first")}
              </p>
            </div>
            <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {([1, 2, 3, 4] as const).map((step) => (
                <li
                  key={step}
                  className="rounded-[var(--radius-card)] border border-[var(--landing-paper-line)] bg-[var(--color-surface)] p-5"
                >
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--landing-pill)] text-sm font-black text-[var(--landing-pill-ink)]">
                    {step}
                  </span>
                  <p className="mt-3 text-sm leading-relaxed font-semibold text-[var(--landing-ink)]">
                    {v(`step${step}`)}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section id={sampleAnchor} aria-labelledby="program-sample-title" className={`${PAGE_FRAME} scroll-mt-24 pt-16 lg:pt-24`}>
            <div className="max-w-3xl">
              <p className={`${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>
                {c("sample_pill")}
              </p>
              <h2 id="program-sample-title" className={PAPER_TITLE}>
                {v("sample_title")}
              </h2>
            </div>
            <div className="mt-6 overflow-x-auto rounded-[var(--radius-card)] border border-[var(--landing-paper-line)] bg-[var(--color-surface)]">
              <table className="w-full min-w-[440px] border-collapse text-left text-sm sm:text-base">
                <thead>
                  <tr className="border-b border-[var(--landing-paper-line)] bg-[var(--landing-pill)]">
                    <th className="w-24 px-4 py-3 font-extrabold text-[var(--landing-ink)]">{c("sample_day_col")}</th>
                    <th className="px-4 py-3 font-extrabold text-[var(--landing-ink)]">{c("sample_blocks_col")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleRows.map((row) => (
                    <tr key={row.day} className="border-b border-[var(--landing-paper-line)] last:border-b-0">
                      <td className="px-4 py-3 font-black text-[var(--landing-ink)]">{row.day}</td>
                      <td className="px-4 py-3 font-semibold text-[var(--landing-ink-soft)]">{row.blocks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm italic text-[var(--landing-ink-soft)]">{v("sample_disclaimer")}</p>
            <p className="mt-2 text-sm font-semibold text-[var(--landing-ink)]">{v("sample_teaser")}</p>
          </section>

          <section aria-labelledby="program-compare-title" className={`${PAGE_FRAME} pt-16 lg:pt-24`}>
            <div className="max-w-3xl">
              <p className={`${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>
                {c("compare_pill")}
              </p>
              <h2 id="program-compare-title" className={PAPER_TITLE}>
                {v("compare_title")}
              </h2>
              <p className="mt-3 text-lg leading-relaxed text-[var(--landing-ink-soft)]">
                {v("compare_summary")}
              </p>
            </div>
            <div className="mt-6 overflow-x-auto rounded-[var(--radius-card)] border border-[var(--landing-paper-line)] bg-[var(--color-surface)]">
              <table className="w-full min-w-[480px] border-collapse text-left text-sm sm:text-base">
                <thead>
                  <tr className="border-b border-[var(--landing-paper-line)] bg-[var(--landing-pill)]">
                    <th className="px-4 py-3.5 font-extrabold text-[var(--landing-ink)]">{c("compare_col_feature")}</th>
                    <th className="px-4 py-3.5 font-bold text-[var(--landing-ink-soft)]">{c("compare_col_pdf")}</th>
                    <th className="px-4 py-3.5 font-black text-[var(--landing-ink)]">{c("compare_col_puhu")}</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row) => (
                    <tr key={row} className="border-b border-[var(--landing-paper-line)] last:border-b-0">
                      <td className="px-4 py-3 font-semibold text-[var(--landing-ink)]">{c(`compare_row${row}_label`)}</td>
                      <td className="px-4 py-3 text-[var(--landing-ink-soft)]">{c(`compare_row${row}_pdf`)}</td>
                      <td className="px-4 py-3 font-extrabold text-[var(--landing-ink)]">✓ {c(`compare_row${row}_puhu`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6">
              <SeoSignupCta
                source={variant}
                location="table"
                className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}
              >
                {c("cta_free_start")}
              </SeoSignupCta>
            </div>
          </section>

          {variant === "lgs" ? (
            <section id="veli" aria-labelledby="lgs-parent-title" className={`${PAGE_FRAME} scroll-mt-24 pt-16 lg:pt-24`}>
              <div className="rounded-[var(--radius-card)] border border-[var(--landing-paper-line)] bg-[var(--color-surface)] p-6 lg:p-8">
                <p className={`${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>
                  {v("parent_pill")}
                </p>
                <h2 id="lgs-parent-title" className="mt-3 text-2xl font-black text-[var(--landing-ink)]">
                  {v("parent_title")}
                </h2>
                <p className="mt-3 max-w-3xl text-base leading-relaxed text-[var(--landing-ink-soft)]">
                  {v("parent_body")}
                </p>
                <p className="mt-4">
                  <Link
                    href="/for-coaches"
                    className="inline-flex min-h-11 items-center text-sm font-extrabold text-[var(--landing-ink)] underline underline-offset-4"
                  >
                    {v("parent_cta")} →
                  </Link>
                </p>
              </div>
            </section>
          ) : null}

          <section aria-labelledby="program-bridge-title" className={`${PAGE_FRAME} pt-16 lg:pt-24`}>
            <div className="rounded-[var(--radius-card)] border border-[var(--landing-paper-line)] bg-[var(--color-surface)] p-6 lg:p-8">
              <p className={`${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>
                {v("bridge_pill")}
              </p>
              <h2 id="program-bridge-title" className="mt-3 text-2xl font-black text-[var(--landing-ink)]">
                {v("bridge_title")}
              </h2>
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-[var(--landing-ink-soft)]">
                {v("bridge_body")}
              </p>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-extrabold underline underline-offset-4">
                <Link href="/study-app">{c("link_study_app")}</Link>
                <Link href="/pomodoro-timer">{c("link_pomodoro")}</Link>
                {variant !== "yks" ? <Link href="/yks-study-program">{c("link_yks")}</Link> : null}
                {variant !== "tyt" ? <Link href="/tyt-study-program">{c("link_tyt")}</Link> : null}
                {variant !== "lgs" ? <Link href="/lgs-study-program">{c("link_lgs")}</Link> : null}
                <Link href="/mistake-notebook">{c("link_notebook")}</Link>
                <Link href="/for-coaches">{c("link_coaches")}</Link>
                <Link href="/knowledge">{c("link_blog")}</Link>
              </div>
            </div>
          </section>

          <PaperFaq
            pill={v("faq_pill")}
            title={v("faq_title")}
            items={FAQ_INDICES.map((i) => ({ q: v(`q${i}`), a: v(`a${i}`) }))}
            nonce={nonce}
          />

          <section aria-labelledby="program-closing-title" className={`${PAGE_FRAME} flex flex-col items-center pb-24 pt-16 text-center lg:pt-24`}>
            <h2 id="program-closing-title" className={PAPER_TITLE}>
              {v("closing_title")}
            </h2>
            <p className="mt-3 max-w-xl text-lg text-[var(--landing-ink-soft)]">
              {v("closing_body")}
            </p>
            <div className="mt-7 flex w-full flex-wrap justify-center gap-3">
              <SeoSignupCta
                source={variant}
                location="closing"
                className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}
              >
                {c("cta_build")}
              </SeoSignupCta>
              <Link href="/login" className={`${LEDGE} ${LEDGE_ON_PAPER} max-sm:w-full`}>
                {c("cta_has_account")}
              </Link>
            </div>
          </section>
        </main>

        <LandingFooter />
      </div>
    </NextIntlClientProvider>
  );
}
