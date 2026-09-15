"use client";

import { CalendarDays, History, StickyNote } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MentorshipStudentReportDto } from "@mentor/types";
import { Button } from "@mentor/ui";
import {
  CoachFollowupsSummary,
  type CoachFollowups,
} from "@/components/mentorship/coach-followups-card";
import { MOBILE_TAB_BAR_STICKY_BOTTOM_CLASS } from "@/lib/app-shell";
import { CoachNoteCard } from "./coach-note-card";

export type ReportPanel = "plan" | "note" | "followups";

/**
 * What the coach can do, beside what they are reading (xl and up). Sticky, so the note and the
 * follow-ups stay in reach while the status column scrolls.
 */
export function ReportActionRail({
  report,
  followups,
  onNoteSaved,
  onCreateFollowup,
  onOpenHistory,
  onPlanWeek,
}: {
  report: MentorshipStudentReportDto;
  followups: CoachFollowups;
  onNoteSaved: () => void;
  onCreateFollowup: () => void;
  onOpenHistory: () => void;
  onPlanWeek: () => void;
}) {
  const t = useTranslations("mentorship");
  return (
    <aside aria-label={t("report_actions_label")} className="sticky top-6 hidden flex-col gap-4 xl:flex">
      <CoachNoteCard
        key={report.studentId}
        studentId={report.studentId}
        note={report.coachNote}
        onSaved={onNoteSaved}
      />
      <CoachFollowupsSummary
        resource={followups}
        onCreate={onCreateFollowup}
        onOpenHistory={onOpenHistory}
      />
      <Button type="button" fullWidth onClick={onPlanWeek}>
        <CalendarDays aria-hidden size={18} strokeWidth={2} />
        {t("report_plan_week")}
      </Button>
    </aside>
  );
}

const BAR_ITEM_CLASS =
  "coach-body flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[var(--radius-card)] px-3 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";

/**
 * Below xl the rail becomes a bar floating above the tab pill, and each action opens the panel.
 *
 * The short visible labels sit inside longer accessible names ("Not" in "Öğrenciye notun"), so a
 * voice user can say what they see and the names match the rail's controls on a wide screen.
 */
export function ReportActionBar({
  followupsEnabled,
  onOpen,
}: {
  followupsEnabled: boolean;
  onOpen: (panel: ReportPanel) => void;
}) {
  const t = useTranslations("mentorship");
  return (
    <div
      role="group"
      aria-label={t("report_actions_label")}
      className={`fixed inset-x-3 z-10 mb-3 flex gap-1.5 rounded-[var(--radius-card)] bg-[var(--color-surface)] p-1.5 shadow-[var(--shadow-card)] ring-1 ring-[var(--color-surface-container)] lg:left-[calc(var(--app-sidebar-width)+0.75rem)] xl:hidden ${MOBILE_TAB_BAR_STICKY_BOTTOM_CLASS}`}
    >
      <button
        type="button"
        aria-label={t("note_title")}
        onClick={() => onOpen("note")}
        className={`${BAR_ITEM_CLASS} bg-[var(--color-surface-container)] text-[var(--color-main)]`}
      >
        <StickyNote aria-hidden size={17} strokeWidth={2} />
        {t("report_bar_note")}
      </button>
      {followupsEnabled ? (
        <button
          type="button"
          aria-label={t("followup_history_title")}
          onClick={() => onOpen("followups")}
          className={`${BAR_ITEM_CLASS} bg-[var(--color-surface-container)] text-[var(--color-main)]`}
        >
          <History aria-hidden size={17} strokeWidth={2} />
          {t("report_bar_followups")}
        </button>
      ) : null}
      <button
        type="button"
        aria-label={t("report_plan_week")}
        onClick={() => onOpen("plan")}
        className={`${BAR_ITEM_CLASS} bg-[var(--color-btn)] text-[var(--color-btn-label)]`}
      >
        <CalendarDays aria-hidden size={17} strokeWidth={2} />
        {t("report_bar_plan")}
      </button>
    </div>
  );
}
