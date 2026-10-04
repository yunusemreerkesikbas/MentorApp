"use client";

import { BookOpen, Check, GraduationCap } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Whose task it is: the coach's cap on the coach's ink, or the student's own book, muted. Shared by
 * the plan card and the planner's day list, so the two never draw the same task two ways.
 */
export function TaskMark({ byCoach }: { byCoach: boolean }) {
  const t = useTranslations("mentorship");
  return byCoach ? (
    <span
      role="img"
      aria-label={t("plan_mark_coach")}
      className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--coach-accent)] text-[var(--color-bg)]"
    >
      <GraduationCap className="size-4" aria-hidden />
    </span>
  ) : (
    <span
      role="img"
      aria-label={t("plan_mark_own")}
      className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--color-surface-container)] text-[var(--color-secondary)]"
    >
      <BookOpen className="size-4" aria-hidden />
    </span>
  );
}

/** "✓ Tamam" in the success ink, or a quiet "Bekliyor". */
export function TaskStatus({ done }: { done: boolean }) {
  const t = useTranslations("mentorship");
  return done ? (
    <span className="inline-flex shrink-0 items-center gap-1 text-caption font-extrabold text-[var(--color-success)]">
      <Check className="size-4" strokeWidth={3} aria-hidden />
      {t("task_status_DONE")}
    </span>
  ) : (
    <span className="shrink-0 text-caption font-bold text-[var(--color-secondary)]">{t("task_status_PENDING")}</span>
  );
}
