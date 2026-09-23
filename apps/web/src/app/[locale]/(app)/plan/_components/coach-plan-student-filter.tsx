"use client";

import type { MentorshipRosterRowDto } from "@mentor/types";
import { ChevronDown } from "lucide-react";
import { useId } from "react";
import { useTranslations } from "next-intl";
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu";
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
  const headingId = useId();
  const valueId = useId();
  const selected = roster.find((student) => student.studentId === studentId) ?? null;
  const label = selected?.studentDisplayName ?? t("all_students");

  return (
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="mb-2 text-sm font-semibold"
        style={{ color: "var(--color-main)" }}
      >
        {t("student_filter")}
      </h2>
      <PopoverMenu
        align="left"
        matchTriggerWidth
        panelRole="listbox"
        menuClassName="py-0"
        trigger={({ open, setOpen, menuId }) => (
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? menuId : undefined}
            aria-labelledby={`${headingId} ${valueId}`}
            onClick={() => setOpen(!open)}
            className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-[var(--radius-card)] border px-3 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
              color: "var(--color-main)",
            }}
          >
            {selected ? (
              <UserAvatar
                name={selected.studentDisplayName}
                src={selected.avatarUrl}
                size={28}
              />
            ) : null}
            <span id={valueId} className="min-w-0 flex-1 truncate">
              {label}
            </span>
            <ChevronDown
              aria-hidden
              size={18}
              strokeWidth={2}
              className={`shrink-0 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
              style={{ color: "var(--color-secondary)" }}
            />
          </button>
        )}
      >
        <div className="max-h-64 overflow-y-auto py-1">
          <PopoverMenuItem
            role="option"
            selected={selected === null}
            className={selected === null ? "!bg-[var(--play-selected)]" : undefined}
            onClick={() => onStudent(null)}
          >
            {t("all_students")}
          </PopoverMenuItem>
          {roster.map((student) => (
            <PopoverMenuItem
              key={student.studentId}
              role="option"
              selected={student.studentId === studentId}
              className={
                student.studentId === studentId ? "!bg-[var(--play-selected)]" : undefined
              }
              onClick={() => onStudent(student.studentId)}
            >
              <span className="flex items-center gap-2">
                <UserAvatar
                  name={student.studentDisplayName}
                  src={student.avatarUrl}
                  size={28}
                />
                <span className="min-w-0 truncate">{student.studentDisplayName}</span>
              </span>
            </PopoverMenuItem>
          ))}
        </div>
      </PopoverMenu>
    </section>
  );
}
