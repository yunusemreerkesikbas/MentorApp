import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";
import { LEDGE, LEDGE_FILLED } from "@/components/panel/panel-styles";
import { type FacadeItem, FacadeTags } from "@/components/seo-lp/facade-tags";
import { SeoLpShell } from "@/components/seo-lp/seo-lp-shell";
import { PaperNote, PostitSteps, SeoHero, TagLinks } from "@/components/seo-lp/seo-paper";
import { SeoSignupCta } from "@/components/seo-lp/seo-signup-cta";
import { setRequestLocale } from "@/i18n/locale";
import { getPathname } from "@/i18n/navigation";
import { siteUrl } from "@/lib/forum-public";
import { buildWebApplicationStructuredData } from "@/lib/structured-data";
import { LEDGE_ON_PAPER, PAGE_FRAME, PAPER_PILL, PAPER_TITLE } from "../_components/landing/landing-paper";
import { SceneImg } from "../_components/landing/scene-img";

type PageProps = { params: Promise<{ locale: string }> };

const FAQ_INDICES = [1, 2, 3, 4, 5, 6] as const;
const PILL = `${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`;

/**
 * Each feature: its message index (`features.f{n}_*`), its door plate number, where its tag hangs on
 * the facade (percent of the facade box, from the canvas) and the tag's tilt. Tags run in reading
 * order over the windows; the feature notes below run Plan, Odak, Defter, Masa, Puhu.
 */
const FEATURES = {
  puhu: { n: 5, plate: 1, x: "24.5%", y: "37%", tilt: "-4deg" },
  defter: { n: 3, plate: 3, x: "75.5%", y: "37%", tilt: "3deg" },
  plan: { n: 1, plate: 4, x: "24.5%", y: "57.5%", tilt: "2deg" },
  odak: { n: 2, plate: 5, x: "50%", y: "57.5%", tilt: "-2deg" },
  masa: { n: 4, plate: 6, x: "75.5%", y: "57.5%", tilt: "-3deg" },
} as const;
type FeatureId = keyof typeof FEATURES;
const TAG_ORDER: FeatureId[] = ["puhu", "defter", "plan", "odak", "masa"];
const NOTE_ORDER: FeatureId[] = ["plan", "odak", "defter", "masa", "puhu"];
const NOTE_LOOKS = [
  { paper: "lined", tape: "#9cc7f0", tilt: "-0.8deg" },
  { paper: "grid", tape: "#f7b3a0", tilt: "0.6deg" },
  { paper: undefined, tape: "#a8d8b0", tilt: "-0.4deg" },
  { paper: "lined", tape: "#ffd15c", tilt: "0.7deg" },
  { paper: "grid", tape: "#9cc7f0", tilt: "-0.6deg" },
] as const;

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

/** The hero is the landing's apartment facade at dawn; a tag on each window shows that feature's note. */
export default async function StudyAppLpPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, nonce] = await Promise.all([
    getTranslations("studyAppLp"),
    headers().then((h) => h.get("x-nonce") ?? undefined),
  ]);

  const origin = siteUrl();
  const canonical = `${origin}${getPathname({ locale: "tr", href: "/study-app" })}`;
  const webAppJsonLd = buildWebApplicationStructuredData({
    name: t("schema_name"),
    url: canonical,
    description: t("schema_description"),
    siteOrigin: origin,
  });

  const links: Partial<Record<FeatureId, NonNullable<FacadeItem["link"]>>> = {
    plan: { href: "/yks-study-program", label: t("exams.link_yks") },
    odak: { href: "/pomodoro-timer", label: t("exams.link_pomodoro") },
    defter: { href: "/mistake-notebook", label: t("exams.link_notebook") },
  };
  const item = (id: FeatureId): FacadeItem => {
    const f = FEATURES[id];
    return {
      id,
      tag: t(`scene.tag_${id}`),
      name: t(`features.f${f.n}_name`),
      title: t(`features.f${f.n}_title`),
      body: t(`features.f${f.n}_body`),
      plate: t("scene.plate", { n: f.plate }),
      x: f.x,
      y: f.y,
      tilt: f.tilt,
      link: links[id],
    };
  };

  const closing = (
    <section aria-labelledby="study-app-closing-title" className={`${PAGE_FRAME} seo-closing`}>
      <div className="seo-puhu" aria-hidden="true">
        <SceneImg src="/visuals/landing/puhu-undecided.webp" width={400} height={400} loading="lazy" />
      </div>
      <h2 id="study-app-closing-title" className={PAPER_TITLE}>
        {t("closing.title")}
      </h2>
      <p className="mt-3 max-w-xl text-lg text-[var(--landing-ink-soft)]">{t("closing.body")}</p>
      <div className="mt-7 flex w-full flex-wrap justify-center gap-3">
        <SeoSignupCta source="study_app" location="closing" className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}>
          {t("cta_primary")}
        </SeoSignupCta>
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
            <SeoSignupCta source="study_app" location="hero" className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}>
              {t("cta_primary")}
            </SeoSignupCta>
            <a href="#ozellikler" className={`${LEDGE} ${LEDGE_ON_PAPER} max-sm:w-full`}>
              {t("cta_secondary")}
            </a>
          </>
        }
        scribble={t("scribble")}
        scene={
          <FacadeTags items={TAG_ORDER.map(item)} facadeAlt={t("scene.aria")}>
            <span className="seo-dawn-sun" aria-hidden="true" />
            <div className="seo-dawn-far" aria-hidden="true">
              <SceneImg src="/visuals/landing/city-mid.webp" mobileSrc="/visuals/landing/city-mid-mobile.webp" loading="lazy" fetchPriority="low" />
            </div>
          </FacadeTags>
        }
      />

      <section aria-label={t("definition_pill")} className={`${PAGE_FRAME} seo-sec`}>
        <p className={PILL}>{t("definition_pill")}</p>
        <div className="seo-answer">
          <PaperNote paper="lined" tilt="-0.4deg">
            <p>{t("definition")}</p>
          </PaperNote>
        </div>
      </section>

      <section id="ozellikler" aria-labelledby="study-app-features-title" className={`${PAGE_FRAME} seo-sec scroll-mt-24`}>
        <div className="seo-sec-head">
          <p className={PILL}>{t("features.pill")}</p>
          <h2 id="study-app-features-title" className={PAPER_TITLE}>
            {t("features.title")}
          </h2>
        </div>
        <div className="seo-notes" style={{ "--n": 3 } as CSSProperties}>
          {NOTE_ORDER.map((id, i) => {
            const { name, title, body, plate } = item(id);
            const look = NOTE_LOOKS[i];
            return (
              <PaperNote key={id} name={name} plate={plate} title={title} paper={look.paper} tape={look.tape} tilt={look.tilt}>
                <p>{body}</p>
              </PaperNote>
            );
          })}
        </div>
        <div className="mt-8">
          <SeoSignupCta source="study_app" location="features" className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}>
            {t("cta_primary")}
          </SeoSignupCta>
        </div>
      </section>

      <section id="nasil" aria-labelledby="study-app-steps-title" className={`${PAGE_FRAME} seo-sec scroll-mt-24`}>
        <div className="seo-sec-head">
          <p className={PILL}>{t("steps.pill")}</p>
          <h2 id="study-app-steps-title" className={PAPER_TITLE}>
            {t("steps.title")}
          </h2>
        </div>
        <PostitSteps
          steps={([1, 2, 3, 4] as const).map((i) => ({ title: t(`steps.s${i}_title`), body: t(`steps.s${i}_body`) }))}
        />
      </section>

      <section aria-label={t("exams.title")} className={`${PAGE_FRAME} seo-sec`}>
        <div className="seo-answer">
          <PaperNote name={t("exams.pill")} title={t("exams.title")} heading="h2" tape="#a8d8b0" tilt="-0.5deg">
            <p>{t("exams.body")}</p>
            <TagLinks
              links={[
                { href: "/yks-study-program", label: t("exams.link_yks") },
                { href: "/tyt-study-program", label: t("exams.link_tyt") },
                { href: "/lgs-study-program", label: t("exams.link_lgs") },
                { href: "/pomodoro-timer", label: t("exams.link_pomodoro") },
                { href: "/mistake-notebook", label: t("exams.link_notebook") },
                { href: "/for-coaches", label: t("exams.link_coaches") },
                { href: "/knowledge", label: t("exams.link_blog") },
              ]}
            />
          </PaperNote>
        </div>
      </section>
    </SeoLpShell>
  );
}
