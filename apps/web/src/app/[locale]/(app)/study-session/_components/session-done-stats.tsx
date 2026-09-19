"use client";

import { BookOpen, Check, Clock, Flame, Target } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FocusGoalDto } from "@mentor/types";
import { Skeleton, formatCountdown, type CompletionStat } from "@mentor/ui";

const ICON_PROPS = { size: 16, strokeWidth: 2.2 } as const;

type SessionTranslate = ReturnType<typeof useTranslations<"session">>;

export function buildSessionDoneStats({
  t,
  focusElapsed,
  streakReady,
  currentStreak,
  focusGoal,
  subject,
  planTaskAutoCompleted,
  planTaskTitle,
}: {
  t: SessionTranslate;
  focusElapsed: number;
  streakReady: boolean;
  currentStreak: number | null;
  focusGoal: FocusGoalDto | null;
  subject: string | null;
  planTaskAutoCompleted: boolean;
  planTaskTitle: string | null;
}): CompletionStat[] {
  const rows: CompletionStat[] = [
    {
      id: "time",
      icon: <Clock {...ICON_PROPS} />,
      label: t("stat_time"),
      value: formatCountdown(Math.max(0, Math.floor(focusElapsed))),
    },
  ];

  if (!streakReady) {
    rows.push({
      id: "streak",
      icon: <Flame {...ICON_PROPS} />,
      label: t("stat_streak"),
      value: <Skeleton className="h-4 w-8 rounded-[var(--radius-card)]" />,
    });
  } else if (currentStreak != null) {
    rows.push({
      id: "streak",
      icon: <Flame {...ICON_PROPS} />,
      label: t("stat_streak"),
      value: String(currentStreak),
    });
  }

  if (focusGoal?.goalMinutes != null) {
    rows.push({
      id: "goal",
      icon: <Target {...ICON_PROPS} />,
      label: t("stat_goal"),
      value: t("goal_progress", {
        done: focusGoal.focusMinutesToday,
        goal: focusGoal.goalMinutes,
      }),
    });
  } else if (subject) {
    rows.push({
      id: "subject",
      icon: <BookOpen {...ICON_PROPS} />,
      label: t("stat_subject"),
      value: subject,
    });
  } else if (planTaskAutoCompleted) {
    rows.push({
      id: "plan",
      icon: <Check {...ICON_PROPS} />,
      label: t("stat_plan_task"),
      value: planTaskTitle ?? t("history_completed"),
    });
  }

  return rows;
}
