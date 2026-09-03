"use client";
import { Minus, Pencil, Plus } from "lucide-react";

import { useEffect, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import type { FocusGoalDto } from "@mentor/types";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import { Card, DigitPopIn, SuccessCheck } from "@mentor/ui";
import { useMentorToast } from "@/lib/mentor-toast";

const GOAL_MIN = 15;
const GOAL_MAX = 600;
const GOAL_STEP = 15;
const DEFAULT_GOAL = 120;

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
 * Daily focus goal on the /study-session idle screen: progress toward the user's own
 * minutes target, an inline ±15 editor, and a calm one-time celebration when
 * the goal is reached. XP quest feedback rides the existing done-screen toast.
 */
export function SessionFocusGoalCard({
  focusGoal,
  onGoalChange,
}: {
  focusGoal: FocusGoalDto | null;
  onGoalChange: (goalMinutes: number | null) => void;
}) {
  const t = useTranslations("session");
  const { error: showErrorToast } = useMentorToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_GOAL);
  const [saving, setSaving] = useState(false);
  // Snapshot once at mount whether today's celebration already fired (focusGoal
  // arrives async). Deriving `celebrate` purely from props + this snapshot avoids
  // both setState-in-effect and ref-in-render (react-compiler rules).
  const [celebratedAtMount] = useState(() => hasCelebratedToday());
  const goalReached =
    focusGoal?.goalMinutes != null &&
    focusGoal.focusMinutesToday >= focusGoal.goalMinutes;
  const celebrate = goalReached && !celebratedAtMount;
  useEffect(() => {
    if (celebrate) markCelebratedToday(); // persist the flag (no setState)
  }, [celebrate]);

  if (!focusGoal) return null;

  const { goalMinutes, focusMinutesToday } = focusGoal;
  const reached = goalMinutes != null && focusMinutesToday >= goalMinutes;
  const progress =
    goalMinutes != null && goalMinutes > 0
      ? Math.min(1, focusMinutesToday / goalMinutes)
      : 0;

  const save = async (value: number | null) => {
    setSaving(true);
    try {
      await usersControllerUpdateMe({ dailyFocusGoalMinutes: value });
      onGoalChange(value);
      setEditing(false);
    } catch (err) {
      showErrorToast({
        title: t("goal_save_error_title"),
        message:
          err instanceof ApiClientError ? err.body.message : t("goal_save_error_message"),
        duration: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  const stepperButton = (
    label: string,
    disabled: boolean,
    onClick: () => void,
    icon: React.ReactNode,
  ) => (
    <button
      type="button"
      aria-label={label}
      disabled={disabled || saving}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_10%,transparent)] disabled:opacity-40"
      style={{
        backgroundColor: "color-mix(in srgb, var(--color-main) 6%, transparent)",
        color: "var(--color-main)",
      }}
    >
      {icon}
    </button>
  );

  return (
    <Card className="flex flex-col gap-3 px-5 py-4 session-liquid-card">
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: "var(--color-secondary)" }}
        >
          {t("goal_title")}
        </span>
        {goalMinutes != null && !editing ? (
          <button
            type="button"
            aria-label={t("goal_edit_aria")}
            onClick={() => {
              setDraft(goalMinutes);
              setEditing(true);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_6%,transparent)]"
            style={{ color: "var(--color-secondary)" }}
          >
            <Pencil size={14} />
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-center gap-4">
            {stepperButton(
              t("goal_decrease_aria"),
              draft <= GOAL_MIN,
              () => setDraft((v) => Math.max(GOAL_MIN, v - GOAL_STEP)),
              <Minus size={16} />,
            )}
            <span
              className="min-w-20 text-center text-xl font-bold tabular-nums"
              style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
            >
              <DigitPopIn value={t("minutes_value", { minutes: draft })} />
            </span>
            {stepperButton(
              t("goal_increase_aria"),
              draft >= GOAL_MAX,
              () => setDraft((v) => Math.min(GOAL_MAX, v + GOAL_STEP)),
              <Plus size={16} />,
            )}
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save(draft)}
              className="rounded-full px-4 py-1.5 text-sm font-semibold disabled:opacity-60"
              style={{
                backgroundColor: "var(--color-progress)",
                color: "var(--color-bg)",
              }}
            >
              {t("goal_save")}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setEditing(false)}
              className="text-sm font-semibold"
              style={{ color: "var(--color-secondary)" }}
            >
              {t("goal_cancel")}
            </button>
            {goalMinutes != null ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void save(null)}
                className="text-sm font-semibold"
                style={{ color: "var(--color-secondary)" }}
              >
                {t("goal_remove")}
              </button>
            ) : null}
          </div>
        </div>
      ) : goalMinutes == null ? (
        <button
          type="button"
          onClick={() => {
            setDraft(DEFAULT_GOAL);
            setEditing(true);
          }}
          className="self-start text-sm font-semibold"
          style={{ color: "var(--color-progress)" }}
        >
          {t("goal_set_cta")}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
            >
              <DigitPopIn
                value={t("goal_progress", {
                  done: focusMinutesToday,
                  goal: goalMinutes,
                })}
              />
            </span>
            {reached ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  backgroundColor:
                    "color-mix(in srgb, var(--color-progress) 14%, transparent)",
                  color: "var(--color-main)",
                }}
              >
                <SuccessCheck
                  state="in"
                  size={16}
                  stroke="var(--color-success)"
                  style={
                    {
                      ["--check-y-amount" as string]: "6px",
                      ["--check-blur-from" as string]: "3px",
                      ["--check-rotate-from" as string]: "35deg",
                    } as CSSProperties
                  }
                />
                {t("goal_reached")}
              </span>
            ) : null}
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={goalMinutes}
            aria-valuenow={Math.min(focusMinutesToday, goalMinutes)}
            aria-label={t("goal_title")}
            style={{ backgroundColor: "var(--color-progress-track)" }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${progress * 100}%`,
                backgroundColor: "var(--color-progress)",
              }}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
