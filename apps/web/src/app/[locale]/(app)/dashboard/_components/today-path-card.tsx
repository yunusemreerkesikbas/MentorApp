"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Play, Plus, Sparkles } from "lucide-react";
import type {
  PlanTaskDto,
  PlanTaskStatus,
  QuestProgressView,
  TodayPanelResponse,
} from "@mentor/types";
import { PuhuImage } from "@/components/puhu-image";
import { PremiumLockNudge } from "@/components/premium/premium-lock-nudge";
import { Link } from "@/i18n/navigation";
import { trackCoachEvent } from "@/lib/analytics";
import { usePremiumPaywall } from "@/lib/premium-paywall";
import { useDailyGreeting } from "@/lib/use-daily-greeting";
import { buildTodayPath, sessionHrefFor } from "./today-path-model";
import { TodayPath } from "./today-path";
import { WeekBand } from "./week-band";

/** Play ledge (DESIGN.md §6) as a link: `@mentor/ui` Button is a `<button>`. */
const LEDGE =
  "inline-flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-[var(--play-radius)] px-5 text-base font-extrabold sm:px-6 sm:text-lg outline-none transition-[transform,box-shadow] duration-[120ms] ease-out focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 active:translate-y-1 active:shadow-none motion-reduce:transition-none";
const LEDGE_FILLED =
  "bg-[var(--play-cta)] text-[var(--play-cta-ink)] shadow-[0_4px_0_var(--play-cta-edge)]";
const LEDGE_OUTLINE =
  "border-2 border-[var(--play-line)] bg-[var(--color-surface)] text-[var(--play-selected-ink)] shadow-[0_4px_0_var(--play-line)]";
const TEXT_LINK =
  "inline-flex min-h-11 items-center text-body-sm font-extrabold text-[var(--play-selected-ink)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";

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
        <div className="flex items-start gap-3 sm:gap-4">
          <PuhuImage
            variant={cta.kind === "DAY_COMPLETE" ? "happy" : "winking"}
            size={72}
            className="shrink-0"
          />
          <div
            className={`min-w-0 flex-1 rounded-[var(--play-radius)] px-4 py-3 ${greeting ? "bg-[color-mix(in_srgb,var(--premium-ring-from)_10%,var(--color-surface))]" : "bg-[var(--play-selected)]"}`}
          >
            {greeting ? (
              <span className="mb-1 flex items-center gap-1.5 text-xs font-extrabold text-[var(--play-selected-ink)]">
                <Sparkles
                  className="size-3.5 fill-current text-[var(--premium-ring-from)]"
                  aria-hidden
                />
                {t("path_note_label")}
              </span>
            ) : null}
            <ExpandableNote text={greeting ?? data.motivationalLine} />
            {locked ? (
              <PremiumLockNudge
                label={t("premium_greeting_nudge")}
                onClick={() => openPaywall({ sourceFeature: "daily.greeting" })}
              />
            ) : null}
          </div>
        </div>

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
            <Link href="/plan" className={`${TEXT_LINK} self-end sm:ml-auto sm:self-auto`}>
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

/** Long premium notes fold to three lines behind "Daha fazla göster". */
function ExpandableNote({ text }: { text: string }) {
  const t = useTranslations("panel");
  const reduceMotion = useReducedMotion();
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [heights, setHeights] = useState<{ collapsed: number; full: number } | null>(
    null,
  );

  // Collapse when the note changes — adjust during render, not in an effect.
  const [renderedText, setRenderedText] = useState(text);
  if (renderedText !== text) {
    setRenderedText(text);
    setExpanded(false);
  }

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || 24;
    setHeights({ collapsed: Math.round(lineHeight * 3), full: el.scrollHeight });
  }, [text]);

  const needsToggle = heights != null && heights.full > heights.collapsed + 1;

  return (
    <div>
      <motion.div
        initial={false}
        animate={{
          height: needsToggle ? (expanded ? heights.full : heights.collapsed) : "auto",
        }}
        transition={
          reduceMotion ? { duration: 0 } : { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
        }
        className="relative overflow-hidden"
      >
        <p
          ref={textRef}
          className="text-body-sm font-semibold leading-6 text-[var(--color-body)]"
        >
          {text}
        </p>
      </motion.div>
      {needsToggle ? (
        <button
          type="button"
          className="mt-1 min-h-9 text-sm font-bold text-[var(--color-main)] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? t("rhythm_show_less") : t("rhythm_show_more")}
        </button>
      ) : null}
    </div>
  );
}
