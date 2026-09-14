"use client";

import { ChevronLeft, Ellipsis } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { MentorshipStudentReportDto } from "@mentor/types";
import { COACH_POPOVER_CLASS } from "@/components/mentorship/coach-ui";
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu";
import { Link } from "@/i18n/navigation";
import { formatDate } from "../../../_components/mentorship-format";
import { NoRiskChip, RiskChip } from "../../../_components/risk-chip";
import { AttentionButton } from "../../_components/attention-button";

/**
 * Who this is and what the rules flagged, with the two acts that belong to the whole student rather
 * than to one section: "İlgilendim" and ending the link.
 *
 * Ending the link sits behind the overflow button. It is rare and irreversible, and as a full-width
 * button at the foot of the page it was the last thing a coach read about every student.
 */
export function ReportHeader({
  report,
  marking,
  ending,
  onToggleAttention,
  onEndLink,
}: {
  report: MentorshipStudentReportDto;
  marking: boolean;
  ending: boolean;
  onToggleAttention: (attended: boolean) => void;
  onEndLink: () => void;
}) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  const meta = [
    report.acceptedAt ? t("my_coach_since", { date: formatDate(report.acceptedAt, locale) }) : null,
    report.studentExamType,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <header className="flex flex-col gap-2">
      <Link
        href="/students"
        className="coach-body -ml-1.5 inline-flex min-h-11 items-center gap-0.5 self-start rounded-[var(--radius-card)] pr-2 font-medium text-[var(--coach-accent-text)] outline-none transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
      >
        <ChevronLeft aria-hidden size={20} strokeWidth={2} />
        {t("report_back")}
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="coach-large-title text-[var(--color-main)]">{report.studentDisplayName}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {meta ? <span className="coach-body text-[var(--color-secondary)]">{meta}</span> : null}
            <div className="flex flex-wrap items-center gap-1.5">
              {report.riskFlags.length === 0 ? (
                <NoRiskChip />
              ) : (
                report.riskFlags.map((flag) => <RiskChip key={flag} flag={flag} />)
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* The same mark as on the roster card, offered here because this is the screen a coach
              is on when they finish acting. A calm student has nothing to mark. */}
          {report.riskFlags.length > 0 && (
            <AttentionButton
              size="sm"
              attendedAt={report.attendedAt}
              busy={marking}
              onToggle={onToggleAttention}
            />
          )}
          <PopoverMenu
            align="right"
            // The menu portals to <body>, outside the themed subtree; the class brings the tokens.
            menuClassName={`${COACH_POPOVER_CLASS} w-56 py-1`}
            trigger={({ open, setOpen, menuId }) => (
              <button
                type="button"
                aria-label={t("report_more_actions")}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                onClick={() => setOpen(!open)}
                className="grid size-11 cursor-pointer place-items-center rounded-[var(--radius-card)] bg-[var(--color-surface-container)] text-[var(--color-main)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              >
                <Ellipsis aria-hidden size={20} strokeWidth={2} />
              </button>
            )}
          >
            <PopoverMenuItem danger disabled={ending} onClick={onEndLink}>
              {t("report_end_link")}
            </PopoverMenuItem>
          </PopoverMenu>
        </div>
      </div>
    </header>
  );
}
