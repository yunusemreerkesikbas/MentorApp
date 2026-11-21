import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { ComponentProps, CSSProperties } from "react";
import { LEDGE_ON_PAPER, PAGE_FRAME, PAPER_PILL, PAPER_TITLE } from "@/app/[locale]/_components/landing/landing-paper";
import { SceneImg } from "@/app/[locale]/_components/landing/scene-img";
import { LEDGE, LEDGE_FILLED } from "@/components/panel/panel-styles";
import { setRequestLocale } from "@/i18n/locale";
import { getPathname, Link } from "@/i18n/navigation";
import { siteUrl } from "@/lib/forum-public";
import { buildWebApplicationStructuredData } from "@/lib/structured-data";
import { PlanDemoWidget } from "./plan-demo-widget";
import { SeoLpShell } from "./seo-lp-shell";
import { NotebookTable, PaperNote, PostitSteps, SceneFrame, SeoHero, TagLinks } from "./seo-paper";
import { SeoSignupCta } from "./seo-signup-cta";
import { getDemoConfig, getSampleWeekRows, type StudyProgramVariant } from "./study-program-lp-presets";

const ROUTE_MAP = {
  yks: "/yks-study-program",
  tyt: "/tyt-study-program",
  lgs: "/lgs-study-program",
} as const;

const FAQ_INDICES = [1, 2, 3, 4, 5, 6] as const;
const COMPARE_ROWS = [1, 2, 3, 4, 5, 6, 7] as const;
const PILL = `${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`;

export async function generateStudyProgramMetadata(variant: StudyProgramVariant, locale: string): Promise<Metadata> {
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

/** "Plan odası" in the hero: Puhu pinning the week on the corkboard, the live plan demo pinned under it. */
export async function StudyProgramLpTemplate({ variant, locale }: { variant: StudyProgramVariant; locale: string }) {
  setRequestLocale(locale);
  const [c, v, nonce] = await Promise.all([
    getTranslations("studyProgramLp.common"),
    getTranslations(`studyProgramLp.${variant}`),
    headers().then((h) => h.get("x-nonce") ?? undefined),
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

  const bridgeLinks: ComponentProps<typeof TagLinks>["links"] = [
    { href: "/study-app", label: c("link_study_app") },
    { href: "/pomodoro-timer", label: c("link_pomodoro") },
    ...(variant !== "yks" ? [{ href: "/yks-study-program" as const, label: c("link_yks") }] : []),
    ...(variant !== "tyt" ? [{ href: "/tyt-study-program" as const, label: c("link_tyt") }] : []),
    ...(variant !== "lgs" ? [{ href: "/lgs-study-program" as const, label: c("link_lgs") }] : []),
    { href: "/mistake-notebook", label: c("link_notebook") },
    { href: "/for-coaches", label: c("link_coaches") },
    { href: "/knowledge", label: c("link_blog") },
  ];

  const closing = (
    <section aria-labelledby="program-closing-title" className={`${PAGE_FRAME} seo-closing`}>
      <div className="seo-puhu" aria-hidden="true">
        <SceneImg src="/visuals/landing/puhu-undecided.webp" width={400} height={400} loading="lazy" />
      </div>
      <h2 id="program-closing-title" className={PAPER_TITLE}>
        {v("closing_title")}
      </h2>
      <p className="mt-3 max-w-xl text-lg text-[var(--landing-ink-soft)]">{v("closing_body")}</p>
      <div className="mt-7 flex w-full flex-wrap justify-center gap-3">
        <SeoSignupCta source={variant} location="closing" className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}>
          {c("cta_build")}
        </SeoSignupCta>
        <Link href="/login" className={`${LEDGE} ${LEDGE_ON_PAPER} max-sm:w-full`}>
          {c("cta_has_account")}
        </Link>
      </div>
    </section>
  );

  return (
    <SeoLpShell
      locale={locale}
      nonce={nonce}
      jsonLd={webAppJsonLd}
      faq={{
        pill: v("faq_pill"),
        title: v("faq_title"),
        items: FAQ_INDICES.map((i) => ({ q: v(`q${i}`), a: v(`a${i}`) })),
      }}
      closing={closing}
    >
      <SeoHero
        pill={v("eyebrow")}
        h1={v("h1")}
        lead={v("subhead")}
        proof={c("proof")}
        ctas={
          <>
            <SeoSignupCta source={variant} location="hero" className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}>
              {c("cta_build")}
            </SeoSignupCta>
            <a href={`#${sampleAnchor}`} className={`${LEDGE} ${LEDGE_ON_PAPER} max-sm:w-full`}>
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
          </>
        }
        scribble={c("scribble")}
        scene={
          // Decorative: the H1 carries the meaning.
          <SceneFrame>
            <SceneImg src="/visuals/landing/room-plan.webp" width={1000} height={585} loading="eager" fetchPriority="high" />
          </SceneFrame>
        }
        pinned={
          <PaperNote name={c("demo_scribble")} paper="grid" tape="#ffd15c" tilt="1.6deg" pin>
            <PlanDemoWidget
              variant={variant}
              config={demoConfig}
              copy={{
                pill: c("demo_pill"),
                firstGroupLabel: variant === "lgs" ? c("demo_mode_label") : c("demo_field_label"),
                hoursLabel: c("demo_hours_label"),
                focusLabel: c("demo_focus_label"),
                note: c("demo_note"),
                saveCta: c("cta_save_plan"),
              }}
            />
          </PaperNote>
        }
      />

      <section id="nasil" aria-labelledby="program-how-title" className={`${PAGE_FRAME} seo-sec scroll-mt-24`}>
        <div className="seo-sec-head">
          <p className={PILL}>{c("how_pill")}</p>
          <h2 id="program-how-title" className={PAPER_TITLE}>
            {c("how_title")}
          </h2>
        </div>
        <div className="seo-answer">
          <PaperNote paper="lined" tilt="-0.5deg">
            <p>{v("answer_first")}</p>
          </PaperNote>
        </div>
        <PostitSteps steps={([1, 2, 3, 4] as const).map((step) => ({ body: v(`step${step}`) }))} />
      </section>

      <section id={sampleAnchor} aria-labelledby="program-sample-title" className={`${PAGE_FRAME} seo-sec scroll-mt-24`}>
        <div className="seo-sec-head">
          <p className={PILL}>{c("sample_pill")}</p>
          <h2 id="program-sample-title" className={PAPER_TITLE}>
            {v("sample_title")}
          </h2>
        </div>
        <NotebookTable
          head={[c("sample_day_col"), c("sample_blocks_col")]}
          rows={sampleRows.map((row) => [row.day, row.blocks])}
          handFirst
          label={v("sample_title")}
        />
        <p className="seo-footnote">{v("sample_disclaimer")}</p>
        <p className="seo-hand-line">{v("sample_teaser")}</p>
      </section>

      <section aria-labelledby="program-compare-title" className={`${PAGE_FRAME} seo-sec`}>
        <div className="seo-sec-head">
          <p className={PILL}>{c("compare_pill")}</p>
          <h2 id="program-compare-title" className={PAPER_TITLE}>
            {v("compare_title")}
          </h2>
          <p className="seo-sec-summary">{v("compare_summary")}</p>
        </div>
        <NotebookTable
          head={[c("compare_col_feature"), c("compare_col_pdf"), c("compare_col_puhu")]}
          rows={COMPARE_ROWS.map((row) => [c(`compare_row${row}_label`), c(`compare_row${row}_pdf`), c(`compare_row${row}_puhu`)])}
          markLast
          label={v("compare_title")}
        />
        <div className="seo-ctas">
          <SeoSignupCta source={variant} location="table" className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}>
            {c("cta_free_start")}
          </SeoSignupCta>
        </div>
      </section>

      {variant === "lgs" ? (
        <section id="veli" aria-label={v("parent_title")} className={`${PAGE_FRAME} seo-sec scroll-mt-24`}>
          <div className="seo-answer">
            <PaperNote name={v("parent_pill")} title={v("parent_title")} heading="h2" tape="#f7b3a0" tilt="-0.5deg">
              <p>{v("parent_body")}</p>
              <p>
                <Link
                  href="/for-coaches"
                  className="inline-flex min-h-11 items-center text-sm font-extrabold text-[var(--landing-ink)] underline underline-offset-4"
                >
                  {v("parent_cta")} →
                </Link>
              </p>
            </PaperNote>
          </div>
        </section>
      ) : null}

      <section className={`${PAGE_FRAME} seo-sec`}>
        <div className="seo-notes" style={{ "--n": 1 } as CSSProperties}>
          <PaperNote name={v("bridge_pill")} title={v("bridge_title")} heading="h2" tape="#a8d8b0" tilt="-0.5deg">
            <p>{v("bridge_body")}</p>
            <TagLinks links={bridgeLinks} />
          </PaperNote>
        </div>
      </section>
    </SeoLpShell>
  );
}
