import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";
import { LEDGE, LEDGE_FILLED } from "@/components/panel/panel-styles";
import { SeoDeskScene } from "@/components/seo-lp/seo-desk-scene";
import { SeoLpShell } from "@/components/seo-lp/seo-lp-shell";
import { PaperNote, PostitSteps, SeoHero, TagLinks } from "@/components/seo-lp/seo-paper";
import { SeoSignupCta } from "@/components/seo-lp/seo-signup-cta";
import { setRequestLocale } from "@/i18n/locale";
import { getPathname, Link } from "@/i18n/navigation";
import { siteUrl } from "@/lib/forum-public";
import { buildWebApplicationStructuredData } from "@/lib/structured-data";
import { LEDGE_ON_PAPER, PAGE_FRAME, PAPER_PILL, PAPER_TITLE } from "../_components/landing/landing-paper";
import { SceneImg } from "../_components/landing/scene-img";
import { NotebookDemoWidget } from "./_components/notebook-demo-widget";

type PageProps = { params: Promise<{ locale: string }> };

const FAQ_INDICES = [1, 2, 3, 4, 5, 6] as const;
const PILL = `${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`;

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

/** The hero is the landing's morning desk; the demo review card is pinned under it as a taped note. */
export default async function MistakeNotebookLpPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The desk's labels are the app's own words, the ones the landing's morning desk renders.
  const [t, tRoot, nonce] = await Promise.all([
    getTranslations("mistakeNotebookLp"),
    getTranslations(),
    headers().then((h) => h.get("x-nonce") ?? undefined),
  ]);

  const origin = siteUrl();
  const canonical = `${origin}${getPathname({ locale: "tr", href: "/mistake-notebook" })}`;
  const webAppJsonLd = buildWebApplicationStructuredData({
    name: t("schema_name"),
    url: canonical,
    description: t("schema_description"),
    siteOrigin: origin,
  });

  const closing = (
    <section aria-labelledby="notebook-closing-title" className={`${PAGE_FRAME} seo-closing`}>
      <div className="seo-puhu" aria-hidden="true">
        <SceneImg src="/visuals/landing/puhu-undecided.webp" width={400} height={400} loading="lazy" />
      </div>
      <h2 id="notebook-closing-title" className={PAPER_TITLE}>
        {t("closing.title")}
      </h2>
      <p className="mt-3 max-w-xl text-lg text-[var(--landing-ink-soft)]">{t("closing.body")}</p>
      <div className="mt-7 flex w-full flex-wrap justify-center gap-3">
        <SeoSignupCta source="notebook" location="closing" className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}>
          {t("cta_primary")}
        </SeoSignupCta>
        <Link href="/login" className={`${LEDGE} ${LEDGE_ON_PAPER} max-sm:w-full`}>
          {t("cta_login")}
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
        pill: t("faq.pill"),
        title: t("faq.title"),
        items: FAQ_INDICES.map((i) => ({ q: t(`faq.q${i}`), a: t(`faq.a${i}`) })),
      }}
      closing={closing}
    >
      <SeoHero
        pill={t("eyebrow")}
        h1={t("h1")}
        lead={t("subhead")}
        proof={t("proof")}
        ctas={
          <>
            <SeoSignupCta source="notebook" location="hero" className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}>
              {t("cta_primary")}
            </SeoSignupCta>
            <a href="#nasil-calisir" className={`${LEDGE} ${LEDGE_ON_PAPER} max-sm:w-full`}>
              {t("cta_secondary")}
            </a>
          </>
        }
        scribble={t("scribble")}
        scene={
          <SeoDeskScene
            label={t("scene_aria")}
            copy={{
              notebook: tRoot("notebook.cover_title"),
              pages: tRoot("notebooks.pages", { count: 11 }),
              due: tRoot("notebooks.due", { count: 2 }),
            }}
          />
        }
        pinned={
          <PaperNote name={t("demo.pill")} paper="lined" tape="#f7b3a0" tilt="-2deg" still>
            <NotebookDemoWidget
              copy={{
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
          </PaperNote>
        }
      />

      <section aria-labelledby="notebook-what-title" className={`${PAGE_FRAME} seo-sec`}>
        <div className="seo-sec-head">
          <p className={PILL}>{t("what_pill")}</p>
          <h2 id="notebook-what-title" className={PAPER_TITLE}>
            {t("what_title")}
          </h2>
        </div>
        <div className="seo-answer">
          <PaperNote paper="lined" tilt="-0.5deg">
            <p>{t("what_body")}</p>
          </PaperNote>
        </div>
      </section>

      <section id="nasil-calisir" aria-labelledby="notebook-how-title" className={`${PAGE_FRAME} seo-sec scroll-mt-24`}>
        <div className="seo-sec-head">
          <p className={PILL}>{t("how.pill")}</p>
          <h2 id="notebook-how-title" className={PAPER_TITLE}>
            {t("how.title")}
          </h2>
        </div>
        <PostitSteps
          steps={([1, 2, 3] as const).map((step) => ({ title: t(`how.step${step}_title`), body: t(`how.step${step}_body`) }))}
        />
        <div className="mt-8">
          <SeoSignupCta source="notebook" location="how" className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}>
            {t("cta_discover")}
          </SeoSignupCta>
        </div>
      </section>

      <section aria-labelledby="notebook-guide-title" className={`${PAGE_FRAME} seo-sec`}>
        <div className="seo-sec-head">
          <p className={PILL}>{t("guide.pill")}</p>
          <h2 id="notebook-guide-title" className={PAPER_TITLE}>
            {t("guide.title")}
          </h2>
        </div>
        <div className="seo-notebook">
          <ol className="seo-notebook-list">
            {([1, 2, 3, 4] as const).map((item) => (
              <li key={item}>{t(`guide.item${item}`)}</li>
            ))}
          </ol>
        </div>
        <p className="seo-sec-summary">{t("guide.outro")}</p>
      </section>

      <section aria-label={t("ecosystem.title")} className={`${PAGE_FRAME} seo-sec`}>
        <div className="seo-notes" style={{ "--n": 2 } as CSSProperties}>
          <PaperNote name={t("ecosystem.pill")} title={t("ecosystem.title")} heading="h2" tape="#a8d8b0" tilt="-0.5deg">
            <p>{t("ecosystem.body")}</p>
            <TagLinks
              links={[
                { href: "/study-app", label: t("ecosystem.link_study_app") },
                { href: "/pomodoro-timer", label: t("ecosystem.link_pomodoro") },
                { href: "/yks-study-program", label: t("ecosystem.link_yks") },
                { href: "/tyt-study-program", label: t("ecosystem.link_tyt") },
                { href: "/lgs-study-program", label: t("ecosystem.link_lgs") },
                { href: "/knowledge", label: t("ecosystem.link_blog") },
              ]}
            />
          </PaperNote>
          <PaperNote name={t("ecosystem.who_name")} title={t("ecosystem.who_title")} heading="h2" paper="grid" tape="#cbb8f0" tilt="0.6deg">
            <p>{t("ecosystem.who_body")}</p>
          </PaperNote>
        </div>
      </section>
    </SeoLpShell>
  );
}
