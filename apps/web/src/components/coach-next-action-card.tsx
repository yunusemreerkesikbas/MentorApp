"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import type { TodayPanelResponse } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import { trackCoachEvent } from "@/lib/analytics";
import { buildStudySessionHrefFromPlanTask } from "@/lib/plan-study-session-link";

interface CoachNextActionCardProps {
  today: TodayPanelResponse;
  surface: "dashboard" | "coach";
}

/** Presentational daily action card. Its parent owns and supplies the today payload. */
export function CoachNextActionCard({
  today,
  surface,
}: CoachNextActionCardProps) {
  const t = useTranslations("coach.hub");
  const { nextAction } = today;
  const task = nextAction.taskId
    ? today.tasks.find((item) => item.id === nextAction.taskId)
    : null;
  const href =
    nextAction.kind === "START_TASK" && task
      ? buildStudySessionHrefFromPlanTask(task, surface)
      : nextAction.kind === "ADD_TASK"
        ? {
            pathname: "/plan" as const,
            query: { add: "1", source: surface },
          }
        : null;

  useEffect(() => {
    trackCoachEvent("coach_next_action_impression", {
      surface,
      next_action_kind: nextAction.kind,
    });
  }, [nextAction.kind, surface]);

  return (
    <section
      className="rounded-[var(--radius-card)] bg-white/90 px-4 py-4 shadow-[var(--shadow-card)]"
      aria-labelledby={`coach-next-action-title-${surface}`}
      data-testid="coach-next-action"
    >
      <h3
        id={`coach-next-action-title-${surface}`}
        className="text-base font-bold"
        style={{
          color: "var(--color-main)",
          fontFamily: "var(--font-heading)",
        }}
      >
        {nextAction.title}
      </h3>
      <p className="mt-1 text-sm" style={{ color: "var(--color-secondary)" }}>
        {nextAction.message}
      </p>
      {href ? (
        <Link
          onClick={() =>
            trackCoachEvent("coach_next_action_click", {
              surface,
              next_action_kind: nextAction.kind,
            })
          }
          href={href}
          className="mt-3 inline-flex min-h-11 items-center rounded-[var(--radius-button)] bg-[var(--color-progress)] px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
        >
          {t(
            nextAction.kind === "START_TASK"
              ? "next_action_start"
              : "next_action_add",
          )}
        </Link>
      ) : null}
    </section>
  );
}
