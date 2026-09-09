"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MentorshipRosterRowDto } from "@mentor/types";
import { useTranslations } from "next-intl";
import { UserAvatar } from "@/components/user-avatar";
import type { CoachPlanScale } from "@/lib/coach-plan-calendar";

export function CoachPlanToolbar({
  scale,
  dateLabel,
  roster,
  studentId,
  onScale,
  onStudent,
  onPrevious,
  onNext,
  onToday,
}: {
  scale: CoachPlanScale;
  dateLabel: string;
  roster: readonly MentorshipRosterRowDto[];
  studentId: string | null;
  onScale: (scale: CoachPlanScale) => void;
  onStudent: (studentId: string | null) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const t = useTranslations("coachPlan");

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-main)" }}>
            {t("title")}
          </h1>
          <p className="mt-1" style={{ color: "var(--color-secondary)" }}>
            {t("subtitle")}
          </p>
        </div>
        <div
          className="flex rounded-[var(--radius-card)] p-1"
          style={{ backgroundColor: "var(--color-surface-container)" }}
          aria-label={t("scale_label")}
        >
          {(["week", "month"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onScale(value)}
              aria-pressed={scale === value}
              className="min-h-11 rounded-[var(--radius-card)] px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{
                backgroundColor: scale === value ? "var(--color-surface)" : "transparent",
                color: "var(--color-main)",
                boxShadow: scale === value ? "var(--shadow-card)" : "none",
              }}
            >
              {t(value)}
            </button>
          ))}
        </div>
      </header>

      <section aria-labelledby="coach-plan-student-filter">
        <h2
          id="coach-plan-student-filter"
          className="mb-2 text-sm font-semibold"
          style={{ color: "var(--color-main)" }}
        >
          {t("student_filter")}
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <FilterButton
            active={studentId === null}
            label={t("all_students")}
            onClick={() => onStudent(null)}
          />
          {roster.map((student) => (
            <FilterButton
              key={student.studentId}
              active={studentId === student.studentId}
              label={student.studentDisplayName}
              onClick={() => onStudent(student.studentId)}
              avatar={student}
            />
          ))}
        </div>
      </section>

      <nav className="flex items-center justify-between gap-3" aria-label={t("date_navigation")}>
        <button
          type="button"
          onClick={onPrevious}
          aria-label={t("previous")}
          className="flex size-11 items-center justify-center rounded-[var(--radius-card)] border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ borderColor: "var(--color-border)", color: "var(--color-main)" }}
        >
          <ChevronLeft aria-hidden size={22} />
        </button>
        <div className="text-center">
          <p className="font-semibold" style={{ color: "var(--color-main)" }}>{dateLabel}</p>
          <button
            type="button"
            onClick={onToday}
            className="min-h-11 px-3 text-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ color: "var(--color-secondary)" }}
          >
            {t("today")}
          </button>
        </div>
        <button
          type="button"
          onClick={onNext}
          aria-label={t("next")}
          className="flex size-11 items-center justify-center rounded-[var(--radius-card)] border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ borderColor: "var(--color-border)", color: "var(--color-main)" }}
        >
          <ChevronRight aria-hidden size={22} />
        </button>
      </nav>
    </>
  );
}

function FilterButton({
  active,
  label,
  avatar,
  onClick,
}: {
  active: boolean;
  label: string;
  avatar?: MentorshipRosterRowDto;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex min-h-11 shrink-0 items-center gap-2 rounded-[var(--radius-card)] border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      style={{
        backgroundColor: active ? "var(--color-btn)" : "var(--color-surface)",
        borderColor: "var(--color-border)",
        color: active ? "var(--color-btn-label)" : "var(--color-main)",
      }}
    >
      {avatar && (
        <UserAvatar
          name={avatar.studentDisplayName}
          src={avatar.avatarUrl}
          size={28}
        />
      )}
      {label}
    </button>
  );
}
