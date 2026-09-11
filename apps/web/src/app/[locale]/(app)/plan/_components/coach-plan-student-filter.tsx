"use client";

import type { MentorshipRosterRowDto } from "@mentor/types";
import { useTranslations } from "next-intl";
import { UserAvatar } from "@/components/user-avatar";

export function CoachPlanStudentFilter({
  roster,
  studentId,
  onStudent,
}: {
  roster: readonly MentorshipRosterRowDto[];
  studentId: string | null;
  onStudent: (studentId: string | null) => void;
}) {
  const t = useTranslations("coachPlan");

  return (
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
      {avatar ? (
        <UserAvatar
          name={avatar.studentDisplayName}
          src={avatar.avatarUrl}
          size={28}
        />
      ) : null}
      {label}
    </button>
  );
}
