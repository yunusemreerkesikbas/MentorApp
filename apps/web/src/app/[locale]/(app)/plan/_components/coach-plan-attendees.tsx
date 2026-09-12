"use client";

import type { MentorshipRosterRowDto } from "@mentor/types";
import { CheckBox } from "@mentor/ui";
import { useTranslations } from "next-intl";
import { UserAvatar } from "@/components/user-avatar";

export function CoachPlanAttendees({
  roster,
  selectedIds,
  readOnly = false,
  onChange,
}: {
  roster: readonly MentorshipRosterRowDto[];
  selectedIds: readonly string[];
  readOnly?: boolean;
  onChange: (ids: string[]) => void;
}) {
  const t = useTranslations("coachPlan");
  const selected = new Set(selectedIds);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend
        className="text-sm font-semibold"
        style={{ color: "var(--color-main)" }}
      >
        {t("attendees")}
      </legend>
      <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
        {readOnly
          ? t("attendees_read_only")
          : selected.size === 0
            ? t("attendees_empty")
            : t("attendees_selected", { count: selected.size })}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {roster.map((student) => {
          const checked = selected.has(student.studentId);
          const labelId = `attendee-${student.studentId}`;
          return (
            <div
              key={student.studentId}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-card)] border px-3 py-2"
              style={{
                borderColor: checked
                  ? "var(--color-focus-ring)"
                  : "var(--color-border)",
                backgroundColor: "var(--color-surface)",
                color: "var(--color-main)",
              }}
              onClick={(event) => {
                if (readOnly) return;
                if ((event.target as HTMLElement).closest('[role="checkbox"]')) return;
                onChange(
                  checked
                    ? selectedIds.filter((id) => id !== student.studentId)
                    : [...selectedIds, student.studentId],
                );
              }}
            >
              <CheckBox
                checked={checked}
                disabled={readOnly}
                aria-labelledby={labelId}
                onChange={(next) => {
                  onChange(
                    next
                      ? [...selectedIds, student.studentId]
                      : selectedIds.filter((id) => id !== student.studentId),
                  );
                }}
              />
              <UserAvatar
                name={student.studentDisplayName}
                src={student.avatarUrl}
                size={32}
              />
              <span id={labelId} className="text-sm font-medium">
                {student.studentDisplayName}
              </span>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
