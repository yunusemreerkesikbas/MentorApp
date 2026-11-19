import "../_components/landing/landing-focus.css";
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
import { jsonLdHtml } from "@/lib/json-ld";
import { buildWebApplicationStructuredData } from "@/lib/structured-data";
import { STUDY_ROOM_BACKDROP_SRC, STUDY_ROOM_THEME_IDS } from "@/lib/study-room-theme";
import type { FocusRoomTheme } from "../_components/landing/focus-room";
import { LandingFooter } from "../_components/landing/landing-footer";
import { LandingNav } from "../_components/landing/landing-nav";
import {
  LEDGE_ON_PAPER,
  PAGE_FRAME,
  PAPER_PILL,
  PAPER_TITLE,
  PaperFaq,
} from "../_components/landing/landing-paper";
import { PublicPomodoroWidget } from "./_components/public-pomodoro-widget";

type PageProps = { params: Promise<{ locale: string }> };

const FAQ_INDICES = [1, 2, 3, 4, 5] as const;
const COMPARE_ROWS = [1, 2, 3, 4, 5, 6] as const;

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

export default async function PomodoroTimerPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tRoot, nonce, messages] = await Promise.all([
    getTranslations("pomodoroLp"),
    getTranslations(),
    headers().then((h) => h.get("x-nonce") ?? undefined),
    getMessages(),
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
          <section className={`${PAGE_FRAME} pb-12 pt-4 lg:pb-16`}>
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
                <a
                  href="#timer"
                  className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}
                >
                  {t("cta_start_timer")}
                </a>
                <SeoSignupCta
                  source="pomodoro"
                  location="hero"
                  className={`${LEDGE} ${LEDGE_ON_PAPER} max-sm:w-full`}
                >
                  {t("cta_signup")}
                </SeoSignupCta>
              </div>
            </div>

            <div className="lf-root mt-8">
              <PublicPomodoroWidget
                themes={themes}
                copy={{
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
                }}
              />
            </div>
          </section>

          <section id="nasil" aria-labelledby="pomodoro-how-title" className={`${PAGE_FRAME} scroll-mt-24 pt-12 lg:pt-20`}>
            <div className="max-w-3xl">
              <p className={`${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>
                {t("how.pill")}
              </p>
              <h2 id="pomodoro-how-title" className={PAPER_TITLE}>
                {t("how.title")}
              </h2>
              <p className="mt-4 rounded-[var(--radius-card)] border border-[var(--landing-paper-line)] bg-[var(--color-surface)] p-5 text-base leading-relaxed font-semibold text-[var(--landing-ink)]">
                {t("how.answer_first")}
              </p>
            </div>
            <ol className="mt-6 grid gap-4 sm:grid-cols-3">
              {([1, 2, 3] as const).map((step) => (
                <li
                  key={step}
                  className="rounded-[var(--radius-card)] border border-[var(--landing-paper-line)] bg-[var(--color-surface)] p-5"
                >
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--landing-pill)] text-sm font-black text-[var(--landing-pill-ink)]">
                    {step}
                  </span>
                  <h3 className="mt-3 text-lg font-extrabold text-[var(--landing-ink)]">
                    {t(`how.step${step}_title`)}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--landing-ink-soft)]">
                    {t(`how.step${step}_body`)}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="pomodoro-compare-title" className={`${PAGE_FRAME} pt-16 lg:pt-24`}>
            <div className="max-w-3xl">
              <p className={`${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>
                {t("compare.pill")}
              </p>
              <h2 id="pomodoro-compare-title" className={PAPER_TITLE}>
                {t("compare.title")}
              </h2>
              <p className="mt-3 text-lg leading-relaxed text-[var(--landing-ink-soft)]">
                {t("compare.summary")}
              </p>
            </div>
            <div className="mt-6 overflow-x-auto rounded-[var(--radius-card)] border border-[var(--landing-paper-line)] bg-[var(--color-surface)]">
              <table className="w-full min-w-[480px] border-collapse text-left text-sm sm:text-base">
                <thead>
                  <tr className="border-b border-[var(--landing-paper-line)] bg-[var(--landing-pill)]">
                    <th className="px-4 py-3.5 font-extrabold text-[var(--landing-ink)]">{t("compare.col_feature")}</th>
                    <th className="px-4 py-3.5 font-bold text-[var(--landing-ink-soft)]">{t("compare.col_basic")}</th>
                    <th className="px-4 py-3.5 font-black text-[var(--landing-ink)]">{t("compare.col_puhu")}</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row) => (
                    <tr key={row} className="border-b border-[var(--landing-paper-line)] last:border-b-0">
                      <td className="px-4 py-3 font-semibold text-[var(--landing-ink)]">{t(`compare.row${row}_label`)}</td>
                      <td className="px-4 py-3 text-[var(--landing-ink-soft)]">{t(`compare.row${row}_basic`)}</td>
                      <td className="px-4 py-3 font-extrabold text-[var(--landing-ink)]">✓ {t(`compare.row${row}_puhu`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6">
              <SeoSignupCta
                source="pomodoro"
                location="table"
                className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}
              >
                {t("cta_free_start")}
              </SeoSignupCta>
            </div>
          </section>

          <section aria-labelledby="pomodoro-rooms-title" className={`${PAGE_FRAME} pt-16 lg:pt-24`}>
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="rounded-[var(--radius-card)] border border-[var(--landing-paper-line)] bg-[var(--color-surface)] p-6 lg:p-8">
                <p className={`${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>
                  {t("rooms.pill")}
                </p>
                <h2 id="pomodoro-rooms-title" className="mt-3 text-2xl font-black text-[var(--landing-ink)]">
                  {t("rooms.title")}
                </h2>
                <p className="mt-3 text-base leading-relaxed text-[var(--landing-ink-soft)]">
                  {t("rooms.body")}
                </p>
              </div>
              <div className="rounded-[var(--radius-card)] border border-[var(--landing-paper-line)] bg-[var(--color-surface)] p-6 lg:p-8">
                <p className={`${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>
                  {t("companion.pill")}
                </p>
                <h2 className="mt-3 text-2xl font-black text-[var(--landing-ink)]">
                  {t("companion.title")}
                </h2>
                <p className="mt-3 text-base leading-relaxed text-[var(--landing-ink-soft)]">
                  {t("companion.body")}
                </p>
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-extrabold underline underline-offset-4">
                  <Link href="/">{t("companion.link_home")}</Link>
                  <Link href="/study-app">{t("companion.link_study_app")}</Link>
                  <Link href="/yks-study-program">{t("companion.link_yks")}</Link>
                  <Link href="/tyt-study-program">{t("companion.link_tyt")}</Link>
                  <Link href="/lgs-study-program">{t("companion.link_lgs")}</Link>
                  <Link href="/mistake-notebook">{t("companion.link_notebook")}</Link>
                  <Link href="/for-coaches">{t("companion.link_coaches")}</Link>
                </div>
              </div>
            </div>
          </section>

          <PaperFaq
            pill={t("faq.pill")}
            title={t("faq.title")}
            items={FAQ_INDICES.map((i) => ({ q: t(`faq.q${i}`), a: t(`faq.a${i}`) }))}
            nonce={nonce}
          />

          <section aria-labelledby="pomodoro-closing-title" className={`${PAGE_FRAME} flex flex-col items-center pb-24 pt-16 text-center lg:pt-24`}>
            <h2 id="pomodoro-closing-title" className={PAPER_TITLE}>
              {t("closing.title")}
            </h2>
            <p className="mt-3 max-w-xl text-lg text-[var(--landing-ink-soft)]">
              {t("closing.body")}
            </p>
            <div className="mt-7 flex w-full flex-wrap justify-center gap-3">
              <a href="#timer" className={`${LEDGE} ${LEDGE_ON_PAPER} max-sm:w-full`}>
                {t("cta_start_timer")}
              </a>
              <SeoSignupCta
                source="pomodoro"
                location="closing"
                className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}
              >
                {t("cta_signup")}
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
