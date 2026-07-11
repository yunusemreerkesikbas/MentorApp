"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { CoachingAnalysisDto, TodayPanelResponse } from "@mentor/types";
import { coachingControllerGetToday, http } from "@mentor/api-client";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { Link } from "@/i18n/navigation";

interface BriefData {
  today: TodayPanelResponse | null;
  analysis: CoachingAnalysisDto | null;
}

interface SuggestionChip {
  label: string;
  seed: string;
}

/**
 * Rule-based daily brief + suggestion chips on the /koc hub (no LLM call — data comes from the
 * existing /coaching/today + /coaching/analysis endpoints; chips deep-link via the ?seed= composer
 * pre-fill that already exists on /koc/chat).
 */
export function KocHubBrief() {
  const t = useTranslations("coach.hub");
  const tCoach = useTranslations("coach");
  const reduceMotion = useReducedMotion();
  const [data, setData] = useState<BriefData | null>(null);

  useEffect(() => {
    let active = true;
    // Both fetches are defensive: the brief simply doesn't render what it can't load
    // (analysis 400s when examType is missing — that's a normal state, not an error).
    Promise.all([
      coachingControllerGetToday().catch(() => null),
      http<CoachingAnalysisDto>("/v1/coaching/analysis").catch(() => null),
    ]).then(([today, analysis]) => {
      if (active) setData({ today: today as TodayPanelResponse | null, analysis });
    });
    return () => {
      active = false;
    };
  }, []);

  // Loading: hold the layout with placeholders so the CTA block doesn't jump when data lands.
  if (data === null) {
    return (
      <SkeletonGroup label={tCoach("loading")} className="flex flex-col gap-3">
        <Skeleton className="h-14 w-full rounded-[var(--radius-card)]" />
        <div className="flex gap-2">
          <Skeleton className="h-11 w-32 rounded-full" />
          <Skeleton className="h-11 w-28 rounded-full" />
        </div>
      </SkeletonGroup>
    );
  }

  if (!data.today) return null;

  const { today, analysis } = data;
  const total = today.tasks.length;
  const done = today.tasks.filter((task) => task.status === "DONE").length;
  const streakDays = today.streak.currentStreak;
  const nextFocus = analysis?.nextFocus ?? null;
  const firstPending = today.tasks.find((task) => task.status !== "DONE") ?? null;

  const chips: SuggestionChip[] = [];
  if (nextFocus) {
    chips.push({
      label: t("chip_focus", { subject: nextFocus.subjectName }),
      seed: t("seed_focus", { subject: nextFocus.subjectName }),
    });
  }
  if (firstPending) {
    chips.push({
      label: t("chip_task"),
      seed: t("seed_task", { title: firstPending.title }),
    });
  } else if (total > 0) {
    chips.push({ label: t("chip_done_day"), seed: t("seed_done_day") });
  } else {
    chips.push({ label: t("chip_plan_day"), seed: t("seed_plan_day") });
  }
  if (streakDays > 0) {
    chips.push({
      label: t("chip_streak"),
      seed: t("seed_streak", { days: streakDays }),
    });
  }

  const summaryParts = [
    total > 0
      ? t("brief_plan", { done, total })
      : t("brief_plan_empty"),
    ...(streakDays > 0 ? [t("brief_streak", { days: streakDays })] : []),
  ];

  return (
    <motion.div
      className="flex flex-col gap-3"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      <div
        className="rounded-[var(--radius-card)] bg-white/90 px-4 py-3 shadow-[var(--shadow-card)]"
        style={{ color: "var(--color-main)" }}
      >
        <p className="text-sm font-bold">{summaryParts.join(" · ")}</p>
        {nextFocus ? (
          <p
            className="mt-1 text-[13px]"
            style={{ color: "var(--color-secondary)" }}
          >
            {nextFocus.message}
          </p>
        ) : null}
      </div>

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t("suggestions_label")}
      >
        {chips.slice(0, 3).map((chip) => (
          <Link
            key={chip.label}
            href={`/koc/chat?seed=${encodeURIComponent(chip.seed)}`}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-full bg-white/90 px-4 text-sm font-bold shadow-[var(--shadow-card)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            style={{ color: "var(--color-progress)" }}
          >
            {chip.label}
          </Link>
        ))}
      </div>
    </motion.div>
  );
}
