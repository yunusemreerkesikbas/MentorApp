"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { DailyNextActionKind, TodayPanelResponse } from "@mentor/types";
import { coachingControllerGetToday } from "@mentor/api-client";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { buildStudySessionHrefFromPlanTask } from "@/lib/plan-study-session-link";
import { trackCoachEvent } from "@/lib/analytics";

interface CoachHubBriefProps {
  onLoaded?: (kind: DailyNextActionKind) => void;
}

/** Rule-based single next step from the existing daily panel endpoint. */
export function CoachHubBrief({ onLoaded }: CoachHubBriefProps) {
  const t = useTranslations("coach.hub");
  const tCoach = useTranslations("coach");
  const reduceMotion = useReducedMotion();
  const [today, setToday] = useState<TodayPanelResponse | null | undefined>();

  useEffect(() => {
    let active = true;
    coachingControllerGetToday()
      .then((result) => {
        if (!active) return;
        const panel = result as unknown as TodayPanelResponse;
        setToday(panel);
        onLoaded?.(panel.nextAction.kind);
      })
      .catch(() => {
        if (active) setToday(null);
      });
    return () => {
      active = false;
    };
  }, [onLoaded]);

  if (today === undefined) {
    return (
      <SkeletonGroup label={tCoach("loading")}>
        <Skeleton className="h-28 w-full rounded-[var(--radius-card)]" />
      </SkeletonGroup>
    );
  }

  if (!today) return null;

  const { nextAction } = today;
  const task = nextAction.taskId
    ? today.tasks.find((item) => item.id === nextAction.taskId)
    : null;
  const href =
    nextAction.kind === "START_TASK" && task
      ? buildStudySessionHrefFromPlanTask(task, "coach")
      : nextAction.kind === "ADD_TASK"
        ? { pathname: "/plan" as const, query: { add: "1", source: "coach" } }
        : null;

  return (
    <motion.section
      className="rounded-[var(--radius-card)] bg-white/90 px-4 py-4 shadow-[var(--shadow-card)]"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      aria-labelledby="coach-next-action-title"
      data-testid="coach-next-action"
    >
      <h3
        id="coach-next-action-title"
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
    </motion.section>
  );
}
