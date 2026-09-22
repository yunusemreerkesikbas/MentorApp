"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Play, Plus } from "lucide-react";
import type {
  PlanTaskDto,
  PlanTaskStatus,
  QuestProgressView,
  TodayPanelResponse,
} from "@mentor/types";
import { CompanionBubble } from "@/components/panel/companion-bubble";
import {
  LEDGE,
  LEDGE_FILLED,
  LEDGE_OUTLINE,
  LEDGE_TEXT_LINK,
} from "@/components/panel/panel-styles";
import { PremiumLockNudge } from "@/components/premium/premium-lock-nudge";
import { Link } from "@/i18n/navigation";
import { trackCoachEvent } from "@/lib/analytics";
import { usePremiumPaywall } from "@/lib/premium-paywall";
import { useDailyGreeting } from "@/lib/use-daily-greeting";
import { buildTodayPath, sessionHrefFor } from "./today-path-model";
import { TodayPath } from "./today-path";
import { WeekBand } from "./week-band";

/**
 * "Bugünün yolu": the panel's one primary action. Puhu's line, the day as a path, the single
 * next step as a play ledge, and this week underneath. Replaces the rhythm card, the metric row,
 * the focus card and the next-action card, which all told the same story with different numbers.
 */
export function TodayPathCard({
  data,
  quests,
  busyTaskId,
  onSetStatus,
}: {
  data: TodayPanelResponse;
  quests: QuestProgressView[] | null;
  busyTaskId: string | null;
  onSetStatus: (task: PlanTaskDto, status: PlanTaskStatus) => void;
}) {
  const t = useTranslations("panel");
  const { openPaywall } = usePremiumPaywall();
  const { greeting, locked } = useDailyGreeting();
  const defaultMinutes = data.sessionPresets[0]?.focusMinutes ?? 25;
  const path = buildTodayPath(data.tasks, quests, defaultMinutes);
  const { cta } = path;

  useEffect(() => {
    trackCoachEvent("coach_next_action_impression", {
      surface: "dashboard",
      next_action_kind: cta.kind,
    });
  }, [cta.kind]);

  const trackClick = () =>
    trackCoachEvent("coach_next_action_click", {
      surface: "dashboard",
      next_action_kind: cta.kind,
    });

  const title =
    cta.kind === "START_TASK"
      ? t("path_title_start", { count: path.total, minutes: cta.minutes })
      : cta.kind === "ADD_TASK"
        ? t("path_title_empty")
        : t("path_title_done");

  const ambient =
    cta.kind === "DAY_COMPLETE" && data.focusGoal.focusMinutesToday > 0
      ? data.focusGoal.goalMinutes != null
        ? t("ambient_done_goal", {
            minutes: data.focusGoal.focusMinutesToday,
            goal: data.focusGoal.goalMinutes,
          })
        : t("ambient_done", { minutes: data.focusGoal.focusMinutesToday })
      : data.focusingNow != null && data.focusingNow > 0
        ? t("ambient_focusing_now", { count: data.focusingNow })
        : null;

  return (
    <section
      className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]"
      aria-labelledby="today-path-title"
      data-testid="today-path-card"
    >
      <div className="flex flex-col gap-4 px-5 pb-5 pt-5 sm:px-7 sm:pt-6">
        <CompanionBubble
          puhu={cta.kind === "DAY_COMPLETE" ? "happy" : "winking"}
          text={greeting ?? data.motivationalLine}
          aiLabel={greeting ? t("path_note_label") : null}
        >
          {locked ? (
            <PremiumLockNudge
              label={t("premium_greeting_nudge")}
              onClick={() => openPaywall({ sourceFeature: "daily.greeting" })}
            />
          ) : null}
        </CompanionBubble>

        <h2
          id="today-path-title"
          className="text-xl font-extrabold leading-snug text-[var(--color-main)] sm:text-title"
        >
          {title}
        </h2>

        <TodayPath
          path={path}
          busyTaskId={busyTaskId}
          sessionHref={(task) => sessionHrefFor(task, defaultMinutes)}
          onSetStatus={onSetStatus}
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          {cta.kind === "START_TASK" ? (
            <Link
              href={sessionHrefFor(cta.task, defaultMinutes)}
              onClick={trackClick}
              aria-label={t("cta_start", { title: cta.task.title, minutes: cta.minutes })}
              className={`${LEDGE} ${LEDGE_FILLED} w-full sm:w-auto sm:max-w-md`}
              data-testid="today-path-cta"
            >
              <Play className="size-[18px] shrink-0 fill-current" aria-hidden />
              <span className="truncate">{cta.task.title}</span>
              <span className="shrink-0">
                {t("cta_start_minutes", { minutes: cta.minutes })}
              </span>
            </Link>
          ) : cta.kind === "ADD_TASK" ? (
            <Link
              href={{ pathname: "/plan", query: { add: "1", source: "dashboard" } }}
              onClick={trackClick}
              className={`${LEDGE} ${LEDGE_FILLED} w-full sm:w-auto`}
              data-testid="today-path-cta"
            >
              <Plus className="size-5 shrink-0" strokeWidth={2.5} aria-hidden />
              {t("cta_add_task")}
            </Link>
          ) : (
            <Link
              href="/study-session"
              onClick={trackClick}
              className={`${LEDGE} ${LEDGE_OUTLINE} w-full sm:w-auto`}
              data-testid="today-path-cta"
            >
              <Play className="size-[18px] shrink-0 fill-current" aria-hidden />
              {t("cta_free_study")}
            </Link>
          )}
          {cta.kind !== "ADD_TASK" ? (
            <Link href="/plan" className={`${LEDGE_TEXT_LINK} self-end sm:ml-auto sm:self-auto`}>
              {cta.kind === "DAY_COMPLETE" ? t("cta_see_plan") : t("plan_edit")}
            </Link>
          ) : null}
        </div>

        {ambient ? (
          <p className="-mt-1 flex items-center gap-2 text-caption font-bold text-[var(--color-secondary)]">
            <span
              className="size-2 shrink-0 rounded-full bg-[var(--play-cta)]"
              aria-hidden
            />
            {ambient}
          </p>
        ) : null}
      </div>

      <WeekBand
        week={data.streak.week}
        streak={data.streak.currentStreak}
        focusGoal={data.focusGoal}
      />
    </section>
  );
}
