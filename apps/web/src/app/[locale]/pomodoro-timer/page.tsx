import "../_components/landing/landing-focus.css";
import "./_components/pomodoro-room.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";
import { LEDGE, LEDGE_FILLED } from "@/components/panel/panel-styles";
import { SeoLpShell } from "@/components/seo-lp/seo-lp-shell";
import { NotebookTable, PaperNote, PostitSteps, SceneFrame, SeoHero, TagLinks } from "@/components/seo-lp/seo-paper";
import { SeoSignupCta } from "@/components/seo-lp/seo-signup-cta";
import { setRequestLocale } from "@/i18n/locale";
import { getPathname } from "@/i18n/navigation";
import { siteUrl } from "@/lib/forum-public";
import { buildWebApplicationStructuredData } from "@/lib/structured-data";
import { STUDY_ROOM_BACKDROP_SRC, STUDY_ROOM_THEME_IDS } from "@/lib/study-room-theme";
import type { FocusRoomTheme } from "../_components/landing/focus-room";
import { LEDGE_ON_PAPER, PAGE_FRAME, PAPER_PILL, PAPER_TITLE } from "../_components/landing/landing-paper";
import { SceneImg } from "../_components/landing/scene-img";
import { PublicPomodoroWidget, type PublicPomodoroCopy } from "./_components/public-pomodoro-widget";

type PageProps = { params: Promise<{ locale: string }> };

const FAQ_INDICES = [1, 2, 3, 4, 5] as const;
const COMPARE_ROWS = [1, 2, 3, 4, 5, 6] as const;
const PILL = `${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pomodoroLp");
  const title = t("meta_title");
  const description = t("meta_description");
  const canonical = `${siteUrl()}${getPathname({ locale: "tr", href: "/pomodoro-timer" })}`;
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

type Translate = Awaited<ReturnType<typeof getTranslations>>;

function widgetCopy(t: Translate, tRoot: Translate): PublicPomodoroCopy {
  return {
    roomLabel: t("widget.room_label"),
    soundLabel: t("widget.sound_label"),
    preset25: t("widget.preset_25_5"),
    preset50: t("widget.preset_50_10"),
    presetCustom: t("widget.preset_custom"),
    presetStopwatch: t("widget.preset_stopwatch"),
    phaseFocus: t("widget.phase_focus"),
    phaseBreak: t("widget.phase_break"),
    unitMin: t("widget.unit_min"),
    unitElapsed: t("widget.unit_elapsed"),
    decreaseAria: t("widget.decrease_aria"),
    increaseAria: t("widget.increase_aria"),
    plainView: t("widget.plain_view"),
    start: t("widget.start"),
    pause: t("widget.pause"),
    resume: t("widget.resume"),
    finish: t("widget.finish"),
    reset: t("widget.reset"),
    doneTitle: t("widget.done_title"),
    doneBody: t("widget.done_body"),
    doneCta: t("widget.done_cta"),
    doneAgain: t("widget.done_again"),
    sounds: {
      scene: tRoot("session_ambient.track_scene"),
      library: tRoot("session_ambient.track_library"),
      cafe: tRoot("session_ambient.track_cafe"),
      home: tRoot("session_ambient.track_home"),
      off: tRoot("session_ambient.track_off"),
    },
  };
}

/** "Odak odası" in the hero: the free timer in its room, with the ambient-sound note pinned under it. */
export default async function PomodoroTimerPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tRoot, nonce] = await Promise.all([
    getTranslations("pomodoroLp"),
    getTranslations(),
    headers().then((h) => h.get("x-nonce") ?? undefined),
  ]);

  const origin = siteUrl();
  const canonical = `${origin}${getPathname({ locale: "tr", href: "/pomodoro-timer" })}`;
  const webAppJsonLd = buildWebApplicationStructuredData({
    name: t("schema_name"),
    url: canonical,
    description: t("schema_description"),
    siteOrigin: origin,
  });

  const themes: FocusRoomTheme[] = STUDY_ROOM_THEME_IDS.map((id) => ({
    id,
    label: tRoot(`session_room.theme_${id}`),
    backdrop: STUDY_ROOM_BACKDROP_SRC[id],
    light: id === "HOME",
  }));

  const closing = (
    <section aria-labelledby="pomodoro-closing-title" className={`${PAGE_FRAME} seo-closing`}>
      <div className="seo-puhu" aria-hidden="true">
        <SceneImg src="/visuals/landing/puhu-undecided.webp" width={400} height={400} loading="lazy" />
      </div>
      <h2 id="pomodoro-closing-title" className={PAPER_TITLE}>
        {t("closing.title")}
      </h2>
      <p className="mt-3 max-w-xl text-lg text-[var(--landing-ink-soft)]">{t("closing.body")}</p>
      <div className="mt-7 flex w-full flex-wrap justify-center gap-3">
        <a href="#timer" className={`${LEDGE} ${LEDGE_ON_PAPER} max-sm:w-full`}>
          {t("cta_start_timer")}
        </a>
        <SeoSignupCta source="pomodoro" location="closing" className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}>
          {t("cta_signup")}
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
            <a href="#timer" className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}>
              {t("cta_start_timer")}
            </a>
            <SeoSignupCta source="pomodoro" location="hero" className={`${LEDGE} ${LEDGE_ON_PAPER} max-sm:w-full`}>
              {t("cta_signup")}
            </SeoSignupCta>
          </>
        }
        scribble={t("scribble")}
        scene={
          <SceneFrame>
            <div className="lf-root">
              <PublicPomodoroWidget themes={themes} copy={widgetCopy(t, tRoot)} />
            </div>
          </SceneFrame>
        }
        pinned={
          <PaperNote name={t("hero_note.name")} paper="grid" tape="#ffd15c" tilt="-3deg">
            <p>{t("hero_note.body")}</p>
          </PaperNote>
        }
      />

      <section id="nasil" aria-labelledby="pomodoro-how-title" className={`${PAGE_FRAME} seo-sec scroll-mt-24`}>
        <div className="seo-sec-head">
          <p className={PILL}>{t("how.pill")}</p>
          <h2 id="pomodoro-how-title" className={PAPER_TITLE}>
            {t("how.title")}
          </h2>
        </div>
        <div className="seo-answer">
          <PaperNote paper="lined" tilt="-0.5deg">
            <p>{t("how.answer_first")}</p>
          </PaperNote>
        </div>
        <PostitSteps
          steps={([1, 2, 3] as const).map((step) => ({ title: t(`how.step${step}_title`), body: t(`how.step${step}_body`) }))}
        />
      </section>

      <section aria-labelledby="pomodoro-compare-title" className={`${PAGE_FRAME} seo-sec`}>
        <div className="seo-sec-head">
          <p className={PILL}>{t("compare.pill")}</p>
          <h2 id="pomodoro-compare-title" className={PAPER_TITLE}>
            {t("compare.title")}
          </h2>
          <p className="seo-sec-summary">{t("compare.summary")}</p>
        </div>
        <NotebookTable
          head={[t("compare.col_feature"), t("compare.col_basic"), t("compare.col_puhu")]}
          rows={COMPARE_ROWS.map((row) => [t(`compare.row${row}_label`), t(`compare.row${row}_basic`), t(`compare.row${row}_puhu`)])}
          markLast
          label={t("compare.title")}
        />
        <div className="seo-ctas">
          <SeoSignupCta source="pomodoro" location="table" className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}>
            {t("cta_free_start")}
          </SeoSignupCta>
        </div>
      </section>

      <section className={`${PAGE_FRAME} seo-sec`}>
        <div className="seo-notes" style={{ "--n": 2 } as CSSProperties}>
          <PaperNote name={t("rooms.pill")} title={t("rooms.title")} heading="h2" paper="grid" tape="#a8d8b0" tilt="0.7deg">
            <p>{t("rooms.body")}</p>
          </PaperNote>
          <PaperNote name={t("companion.pill")} title={t("companion.title")} heading="h2" tape="#f7b3a0">
            <p>{t("companion.body")}</p>
            <TagLinks
              links={[
                { href: "/", label: t("companion.link_home") },
                { href: "/study-app", label: t("companion.link_study_app") },
                { href: "/yks-study-program", label: t("companion.link_yks") },
                { href: "/tyt-study-program", label: t("companion.link_tyt") },
                { href: "/lgs-study-program", label: t("companion.link_lgs") },
                { href: "/mistake-notebook", label: t("companion.link_notebook") },
                { href: "/for-coaches", label: t("companion.link_coaches") },
              ]}
            />
          </PaperNote>
        </div>
      </section>
    </SeoLpShell>
  );
}
