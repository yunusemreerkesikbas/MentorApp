"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import { History, Minus, PenLine, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FocusGoalDto, StudySessionDto } from "@mentor/types";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import { Button, DigitPopIn, Skeleton, SkeletonGroup, SuccessCheck } from "@mentor/ui";
import {
  PANEL_CARD_TITLE,
  PANEL_QUIET_LINK,
  PANEL_TEXT_LINK,
} from "@/components/panel/panel-styles";
import { historyDateRange } from "@/lib/history-date-range";
import { useMentorToast } from "@/lib/mentor-toast";
import { listStudySessions } from "@/lib/study-sessions";

const GOAL_MIN = 15;
const GOAL_MAX = 600;
const GOAL_STEP = 15;
const DEFAULT_GOAL = 120;

/** Every card in the /seans rail: glass on the scene, the panel's solid card on the plain screen. */
export const SESSION_CARD_CLASS =
  "flex flex-col gap-3 rounded-[var(--radius-card)] p-5 session-liquid-card";

/** One-shot celebration per UTC day (consistent with the backend day math). */
function celebrationKey(): string {
  return `mentor.session.goalCelebrated:${new Date().toISOString().slice(0, 10)}`;
}

function hasCelebratedToday(): boolean {
  try {
    return window.localStorage.getItem(celebrationKey()) === "1";
  } catch {
    return true;
  }
}

function markCelebratedToday(): void {
  try {
    window.localStorage.setItem(celebrationKey(), "1");
  } catch {
    // ignore
  }
}

/**
 * "Bugün" on the /seans rail: the day's focus goal, drawn from the sessions that filled it.
 *
 * The goal line is made of today's completed sessions, one segment each, on a track that is the
 * goal: progress you can count, not a percentage. Abandoned sessions do not count toward the
 * goal, so they are said in words instead of drawn. "Tüm geçmiş" opens the history drawer; the
 * rail that used to hold it on the left is gone.
 */
export function SessionTodayCard({
  focusGoal,
  freshSessionId = null,
  onGoalChange,
  onOpenHistory,
}: {
  /** `undefined` while `/coaching/today` loads; `null` when it failed (the card hides). */
  focusGoal: FocusGoalDto | null | undefined;
  /** The session just finished on this screen: its segment grows into the strip. */
  freshSessionId?: string | null;
  onGoalChange: (goalMinutes: number | null) => void;
  onOpenHistory: () => void;
}) {
  const t = useTranslations("session");
  const titleId = useId();
  const { error: showErrorToast } = useMentorToast();
  const [sessions, setSessions] = useState<StudySessionDto[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_GOAL);
  const [saving, setSaving] = useState(false);
  // Grown once: editing the goal remounts the strip, and the new segment must not grow again.
  const [freshGrown, setFreshGrown] = useState(false);
  // Snapshot once whether today's celebration already fired (focusGoal arrives async).
  const [celebratedAtMount] = useState(() => hasCelebratedToday());

  useEffect(() => {
    let active = true;
    const { from, to } = historyDateRange("today");
    listStudySessions(1, 20, undefined, from, to)
      .then((res) => {
        if (active) setSessions(res.items);
      })
      .catch(() => {
        // The goal still reads without the strip.
        if (active) setSessions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const goalMinutes = focusGoal?.goalMinutes ?? null;
  const focused = focusGoal?.focusMinutesToday ?? 0;
  const reached = goalMinutes != null && focused >= goalMinutes;
  const celebrate = reached && !celebratedAtMount;
  useEffect(() => {
    if (celebrate) markCelebratedToday();
  }, [celebrate]);

  if (focusGoal === null) return null;
  if (focusGoal === undefined || sessions === null) return <SessionTodayCardSkeleton />;

  // The API lists newest first; the strip reads left to right through the day.
  // Only sessions that count toward the goal draw: one finished in seconds is COMPLETED but under
  // the platform's minimum, and a segment beside "0 / 120 dk" would contradict the number.
  const completed = sessions
    .filter((s) => s.status === "COMPLETED" && s.countsAsFocusSession !== false)
    .map((s) => ({ id: s.id, minutes: Math.max(1, Math.round(s.actualFocusSeconds / 60)) }))
    .reverse();
  const abandoned = sessions.filter((s) => s.status === "ABANDONED").length;
  // The goal's minutes come from `/coaching/today`, the segments from the session list. If the
  // list failed (or lags), the minutes still draw, as one segment, and still read as progress.
  const segments =
    completed.length > 0 ? completed : focused > 0 ? [{ id: "today", minutes: focused }] : [];
  const stripLabel =
    completed.length === 0 && focused > 0
      ? t("today_strip_aria_minutes", { goal: goalMinutes ?? 0, minutes: focused })
      : t("today_strip_aria", { goal: goalMinutes ?? 0, count: completed.length, minutes: focused });

  const save = async (value: number | null) => {
    setSaving(true);
    try {
      await usersControllerUpdateMe({ dailyFocusGoalMinutes: value });
      onGoalChange(value);
      setEditing(false);
    } catch (err) {
      showErrorToast({
        title: t("goal_save_error_title"),
        message: err instanceof ApiClientError ? err.body.message : t("goal_save_error_message"),
        duration: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  const startEditing = () => {
    setDraft(goalMinutes ?? DEFAULT_GOAL);
    setEditing(true);
  };

  return (
    <section className={SESSION_CARD_CLASS} aria-labelledby={titleId}>
      <div className="flex items-center justify-between gap-2">
        <h2 id={titleId} className={PANEL_CARD_TITLE}>
          {editing ? t("goal_title") : t("today_title")}
        </h2>
        {goalMinutes != null && !editing ? (
          <button
            type="button"
            aria-label={t("goal_edit_aria")}
            onClick={startEditing}
            className="-my-2.5 -mr-2.5 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-secondary)] transition-colors duration-150 hover:bg-[var(--color-surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
          >
            <PenLine className="size-5" strokeWidth={1.75} aria-hidden />
          </button>
        ) : null}
      </div>

      {editing ? (
        <GoalEditor
          draft={draft}
          saving={saving}
          canRemove={goalMinutes != null}
          onDraftChange={setDraft}
          onSave={() => void save(draft)}
          onCancel={() => setEditing(false)}
          onRemove={() => void save(null)}
        />
      ) : (
        <>
          <p className="flex items-baseline gap-1.5 text-[var(--color-main)]">
            <DigitPopIn
              value={focused}
              className="text-display font-extrabold leading-none tabular-nums"
            />
            <span className="text-body-sm font-extrabold text-[var(--color-secondary)]">
              {goalMinutes != null ? t("today_of_goal", { goal: goalMinutes }) : t("today_focus_unit")}
            </span>
          </p>

          {goalMinutes != null ? (
            <GoalStrip
              label={stripLabel}
              goal={goalMinutes}
              segments={segments}
              freshId={freshGrown ? null : freshSessionId}
              onFreshGrown={() => setFreshGrown(true)}
              reached={reached}
            />
          ) : null}

          <div className="flex flex-col gap-0.5 text-body-sm font-semibold text-[var(--color-secondary)]">
            {reached ? (
              <p className="inline-flex items-center gap-1.5 font-extrabold text-[var(--color-success)]">
                <SuccessCheck
                  state="in"
                  size={18}
                  stroke="var(--color-success)"
                  style={
                    celebrate
                      ? ({
                          ["--check-y-amount" as string]: "6px",
                          ["--check-blur-from" as string]: "3px",
                          ["--check-rotate-from" as string]: "35deg",
                        } as CSSProperties)
                      : undefined
                  }
                />
                {t("goal_reached")}
              </p>
            ) : goalMinutes != null ? (
              <p>
                {focused > 0
                  ? t("today_remaining", { minutes: goalMinutes - focused })
                  : t("today_empty_goal")}
              </p>
            ) : (
              <p>{t("today_done", { count: completed.length })}</p>
            )}
            {abandoned > 0 ? <p>{t("today_abandoned", { count: abandoned })}</p> : null}
          </div>

          {goalMinutes == null ? (
            <button type="button" onClick={startEditing} className={`${PANEL_TEXT_LINK} self-start`}>
              {t("goal_set_cta")}
            </button>
          ) : null}
        </>
      )}

      <button
        type="button"
        onClick={onOpenHistory}
        data-testid="session-history-open"
        className={`${goalMinutes == null && !editing ? PANEL_QUIET_LINK : PANEL_TEXT_LINK} -mt-1 self-start`}
      >
        <History className="size-[18px]" strokeWidth={1.75} aria-hidden />
        {t("history_all")}
      </button>
    </section>
  );
}

/**
 * The goal as a track, filled by one segment per completed session. Scaled to the goal, or to
 * the day's total once it runs past the goal, so an over-achieving day fills rather than spills.
 * Segments grow by their minutes and a spacer takes what is left of the goal, so the 3px gaps
 * come out of the track instead of pushing the last segment (often the fresh one) out of view.
 * The session just finished grows in from the left, once, as the lights come back up.
 */
function GoalStrip({
  label,
  goal,
  segments,
  freshId,
  onFreshGrown,
  reached,
}: {
  label: string;
  goal: number;
  segments: { id: string; minutes: number }[];
  freshId: string | null;
  onFreshGrown: () => void;
  reached: boolean;
}) {
  const left = goal - segments.reduce((sum, s) => sum + s.minutes, 0);
  return (
    <div
      role="img"
      aria-label={label}
      className="flex h-3 gap-[3px] overflow-hidden rounded-full bg-[var(--play-track)]"
    >
      {segments.map((segment) => (
        <span
          key={segment.id}
          data-fresh={segment.id === freshId || undefined}
          onAnimationEnd={segment.id === freshId ? onFreshGrown : undefined}
          className={`block h-full min-w-1.5 basis-0 rounded-full ${reached ? "bg-[var(--color-success)]" : "bg-[var(--play-cta)]"}${
            segment.id === freshId
              ? " origin-left animate-[session-strip-grow_0.45s_cubic-bezier(0.25,1,0.5,1)_0.2s_both] motion-reduce:animate-none"
              : ""
          }`}
          style={{ flexGrow: segment.minutes }}
        />
      ))}
      {left > 0 ? <span aria-hidden className="basis-0" style={{ flexGrow: left }} /> : null}
    </div>
  );
}

function GoalEditor({
  draft,
  saving,
  canRemove,
  onDraftChange,
  onSave,
  onCancel,
  onRemove,
}: {
  draft: number;
  saving: boolean;
  canRemove: boolean;
  onDraftChange: (next: number) => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations("session");
  const stepClass =
    "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-[var(--play-line)] bg-[var(--color-surface)] text-[var(--color-main)] transition-colors duration-150 hover:bg-[var(--color-surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          aria-label={t("goal_decrease_aria")}
          disabled={saving || draft <= GOAL_MIN}
          onClick={() => onDraftChange(Math.max(GOAL_MIN, draft - GOAL_STEP))}
          className={stepClass}
        >
          <Minus className="size-5" strokeWidth={1.75} aria-hidden />
        </button>
        <output
          aria-live="polite"
          className="min-w-24 text-center text-2xl font-extrabold tabular-nums text-[var(--color-main)]"
        >
          <DigitPopIn value={t("minutes_value", { minutes: draft })} />
        </output>
        <button
          type="button"
          aria-label={t("goal_increase_aria")}
          disabled={saving || draft >= GOAL_MAX}
          onClick={() => onDraftChange(Math.min(GOAL_MAX, draft + GOAL_STEP))}
          className={stepClass}
        >
          <Plus className="size-5" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-[18px] gap-y-2">
        <Button size="sm" variant="secondary" busy={saving} onClick={onSave}>
          {t("goal_save")}
        </Button>
        <button type="button" disabled={saving} onClick={onCancel} className={PANEL_QUIET_LINK}>
          {t("goal_cancel")}
        </button>
        {canRemove ? (
          <button type="button" disabled={saving} onClick={onRemove} className={PANEL_QUIET_LINK}>
            {t("goal_remove")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function SessionTodayCardSkeleton() {
  const t = useTranslations("session");
  return (
    <SkeletonGroup label={t("loading")} className={SESSION_CARD_CLASS}>
      <Skeleton className="h-5 w-20 rounded-[var(--radius-card)]" />
      <Skeleton className="h-8 w-32 rounded-[var(--radius-card)]" />
      <Skeleton className="h-3 w-full rounded-full" />
      <Skeleton className="h-4 w-44 rounded-[var(--radius-card)]" />
    </SkeletonGroup>
  );
}
