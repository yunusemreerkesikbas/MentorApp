import Image from "next/image";
import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import { JOURNEY_LEVEL_CATALOG, JOURNEY_LEVEL_CHAPTERS } from "@/components/journey-levels/journey-level-catalog";
import { JourneyQuests, type QuestGroup } from "./journey-quests";
import { landingAvailability } from "./landing-availability";
import { PAGE_FRAME, PAPER_PILL, PAPER_TITLE } from "./landing-paper";
import "./landing-journey.css";

/**
 * "Gece Yolculuğu": quests, XP and Coin. Only while the economy is on (`economy`); an unknown
 * availability reads as off, so the landing never shows rights that do not land.
 *
 * The quest titles are the API's own (`apps/api/src/i18n/locales/*\/economy.json`, mirrored in
 * `landing.journey.quest`), with its default amounts: +5 XP a daily ritual, +20 XP a weekly one,
 * +25 XP a milestone, +15 Coin for five active days. The lights are the app's level badges, cut
 * round like `JourneyLevelMedallion`. Coin is never said to buy anything: what it opens is AI, and
 * the landing keeps "the AI coach is Premium" true (docs/copy/voice.md, Landing).
 */

/** The sample visitor stands on the third light, Pusula. */
const CURRENT_TIER = 3;
const ROMAN = ["I", "II", "III", "IV"] as const;

export async function LandingJourney() {
  const [t, j, availability] = await Promise.all([getTranslations(), getTranslations("landing.journey"), landingAvailability()]);
  if (availability?.economy !== true) return null;

  const xp = (count: number) => t("economy.quest_reward_xp", { count });
  const coin = (count: number) => t("economy.quest_reward_coin", { count });
  const days = (current: number, target: number) => t("economy.quest_progress_days", { current, target });
  const count = (current: number, target: number) => t("economy.quest_progress_count", { current, target });

  const groups: QuestGroup[] = [
    {
      tab: t("economy.quests_tab_daily"),
      section: t("economy.quests_daily_section"),
      progress: t("economy.quests_progress", { done: 2, total: 4 }),
      rows: [
        { title: j("quest.plan_task"), reward: xp(5), done: true },
        { title: j("quest.focus_session"), reward: xp(5), done: true },
        { title: j("quest.focus_goal"), progress: j("goal_progress"), reward: xp(5) },
        { title: j("quest.mood"), reward: xp(5) },
      ],
    },
    {
      tab: t("economy.quests_tab_weekly"),
      section: t("economy.quests_weekly_section"),
      progress: t("economy.quests_progress", { done: 0, total: 4 }),
      rows: [
        { title: j("quest.active_days", { target: 5 }), progress: days(3, 5), reward: coin(15), coin: true },
        { title: j("quest.focus_sessions", { target: 5 }), progress: count(2, 5), reward: xp(20) },
        { title: j("quest.plan_tasks", { target: 10 }), progress: count(6, 10), reward: xp(20) },
        { title: j("quest.full_week"), progress: days(3, 7), reward: xp(20) },
      ],
    },
    {
      tab: t("economy.quests_tab_milestone"),
      section: t("economy.quests_milestone_section"),
      progress: t("economy.quests_progress", { done: 1, total: 3 }),
      rows: [
        { title: j("quest.milestone_sessions", { count: 10 }), progress: count(10, 10), reward: xp(25), done: true },
        { title: j("quest.milestone_rhythm", { days: 7 }), progress: days(3, 7), reward: xp(25) },
        { title: j("quest.milestone_tasks", { count: 25 }), progress: count(12, 25), reward: xp(25) },
      ],
    },
  ];

  // The lights climb and dip along the path, left to right; positions are shares of the box.
  const last = JOURNEY_LEVEL_CATALOG.length - 1;
  const lights = JOURNEY_LEVEL_CATALOG.map((level, i) => ({
    ...level,
    name: t(`journey_levels.levels.${level.key}.name`),
    x: 5 + (i * 90) / last,
    y: 50 - Math.sin(i * 0.8) * 28,
  }));
  const current = lights[CURRENT_TIER - 1]!;

  return (
    <section id="yolculuk" aria-labelledby="landing-journey-title" className={`lj-root ${PAGE_FRAME} scroll-mt-24 pt-16 lg:pt-24`}>
      <div className="max-w-3xl">
        <p className={`${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>{t("economy.quests_title")}</p>
        <h2 id="landing-journey-title" className={PAPER_TITLE}>
          {j("title")}
        </h2>
        <p className="mt-3 text-lg leading-relaxed text-[var(--landing-ink-soft)]">{j("lead")}</p>
      </div>

      <div className="lj-grid">
        <JourneyQuests title={t("economy.quests_title")} tabsLabel={t("economy.quests_tabs_label")} groups={groups} coinNote={j("coin_note")} />

        <div className="lj-path">
          <p className="lj-level">
            <small>{t("journey_levels.guide_title")}</small>
            <b>{t("journey_levels.level_title", { tier: CURRENT_TIER, name: current.name })}</b>
            <span className="lj-bar" aria-hidden="true">
              <i />
            </span>
            <small>
              {t("journey_levels.progress_value", { current: 120, target: 200 })} · {t(`journey_levels.levels.${current.key}.story`)}
            </small>
          </p>
          <div className="lj-lights" aria-hidden="true">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline points={lights.map((light) => `${light.x.toFixed(1)},${light.y.toFixed(1)}`).join(" ")} />
            </svg>
            {lights.map((light) => (
              <span
                key={light.key}
                className={`lj-light${light.tier < CURRENT_TIER ? " is-lit" : light.tier === CURRENT_TIER ? " is-now" : ""}`}
                style={{ left: `${light.x}%`, top: `${light.y}%` } as CSSProperties}
              >
                <Image src={`/img/levels/${light.key}.webp`} alt="" width={128} height={128} sizes="64px" />
                <small>{light.name}</small>
              </span>
            ))}
          </div>
          <p className="lj-chapters" aria-hidden="true">
            {JOURNEY_LEVEL_CHAPTERS.map((chapter, i) => (
              <span key={chapter.id}>
                {ROMAN[i]}. {t(`journey_levels.chapters.${chapter.id}.name`)}
              </span>
            ))}
          </p>
        </div>
      </div>
    </section>
  );
}
