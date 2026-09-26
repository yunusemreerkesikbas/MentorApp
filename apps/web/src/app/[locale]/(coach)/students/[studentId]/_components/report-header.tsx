"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Ellipsis } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { MentorshipStudentReportDto } from "@mentor/types";
import { Skeleton } from "@mentor/ui";
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu";
import { Link } from "@/i18n/navigation";
import { CoachCheck } from "@/components/mentorship/coach-check";
import { COACH_FAST } from "@/components/mentorship/coach-motion";
import { daysSinceMark, isAttended } from "../../../_components/attention";
import { sortFlags } from "../../../_components/flag-order";
import { formatDate } from "../../../_components/mentorship-format";
import { RiskChip } from "../../../_components/risk-chip";
import {
  nextInRound,
  parseRoundOrder,
  readRoundOrderRaw,
  type RoundNext,
} from "../../../_components/round-order";
import { StudentAvatar } from "../../../_components/student-avatar";

const noSubscription = () => () => {};

const PILL =
  "inline-flex min-h-11 items-center gap-2.5 rounded-full border border-[var(--play-line)] bg-[var(--color-surface)] py-1 pl-1.5 pr-2 shadow-[0_2px_0_var(--play-line)] outline-none [--glow-base:0_2px_0_var(--play-line)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";

/**
 * Who this is and what the rules flagged, with the acts that belong to the whole student: the
 * coach's mark, the weekly archive, and ending the link behind the overflow button.
 *
 * "Sıradaki" walks the round the roster saved in this tab. A report opened from a link, a
 * notification or another tab has no round behind it, and then the header says nothing.
 *
 * Marking the student here is a small moment (Durak F): the mark draws its ✓, "Bugün baktın" rises
 * in, and the "Sıradaki" pill rings once, since that is where the round goes on.
 */
export function ReportHeader({
  studentId,
  report,
  failed,
  today,
  marking,
  ending,
  showArchive,
  onToggleAttention,
  onOpenArchive,
  onEndLink,
}: {
  studentId: string;
  /** Null while the report loads: the way back and "Sıradaki" never wait for it. */
  report: MentorshipStudentReportDto | null;
  /** The report did not load; the page says so below, and the header keeps only the way back. */
  failed: boolean;
  /** Europe/Istanbul `yyyy-mm-dd`. */
  today: string;
  marking: boolean;
  ending: boolean;
  showArchive: boolean;
  onToggleAttention: (attended: boolean) => void;
  onOpenArchive: () => void;
  onEndLink: () => void;
}) {
  const t = useTranslations("mentorship");
  const raw = useSyncExternalStore(noSubscription, readRoundOrderRaw, () => null);
  const next = useMemo(() => nextInRound(parseRoundOrder(raw), studentId), [raw, studentId]);
  // Only a mark made on this screen animates; the one the report loaded with is simply there.
  const [pressed, setPressed] = useState(false);
  const glow = pressed && report !== null && isAttended(report);
  const toggle = (attended: boolean) => {
    setPressed(true);
    onToggleAttention(attended);
  };

  return (
    <header className="flex flex-col gap-2">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
        <Link
          href="/students"
          transitionTypes={["nav-back"]}
          className="-ml-1 inline-flex min-h-11 items-center gap-0.5 rounded-[var(--radius-card)] pr-2 text-body-sm font-extrabold text-[var(--play-selected-ink)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <ChevronLeft className="size-5" aria-hidden />
          {t("report_back")}
        </Link>
        {/* Top right on a wide screen. On a phone the header's hanging lamp covers that corner, so
            the link moves beside the coach's mark, which is where the round moves on from anyway. */}
        {next ? (
          <div className="hidden lg:block">
            <RoundNextLink next={next} glow={glow} />
          </div>
        ) : null}
      </div>

      {report ? (
        <Identity
          report={report}
          next={next}
          today={today}
          pressed={pressed}
          glow={glow}
          marking={marking}
          ending={ending}
          showArchive={showArchive}
          onToggleAttention={toggle}
          onOpenArchive={onOpenArchive}
          onEndLink={onEndLink}
        />
      ) : failed ? null : (
        <div className="flex items-center gap-4" aria-hidden>
          <Skeleton className="size-14 shrink-0 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-56 max-w-full rounded-[var(--radius-card)]" />
            <Skeleton className="h-5 w-40 rounded-[var(--radius-card)]" />
          </div>
        </div>
      )}
    </header>
  );
}

/**
 * "Sıradaki: Ece ›" on the round, "Turun sonu ›" back to the roster on its last stop. Not "tur
 * tamam": the coach may have marked nobody on the way, and the roster would still say who waits.
 */
function RoundNextLink({ next, glow }: { next: RoundNext; glow: boolean }) {
  const t = useTranslations("mentorship");
  const className = `${PILL} ${glow ? "coach-glow" : ""}`;
  if (next.kind === "complete") {
    return (
      <Link href="/students" transitionTypes={["nav-forward"]} className={className} data-testid="round-next">
        <span
          aria-hidden
          className="grid size-8 place-items-center rounded-full bg-[var(--coach-accent)] text-[var(--color-bg)]"
        >
          <Check className="size-4" strokeWidth={3} />
        </span>
        <span className="text-sm font-extrabold text-[var(--color-main)]">{t("round_node_end_open")}</span>
        <ChevronRight className="size-4.5 text-[var(--color-secondary)]" aria-hidden />
      </Link>
    );
  }
  return (
    <Link
      href={{ pathname: "/students/[studentId]", params: { studentId: next.studentId } }}
      transitionTypes={["nav-forward"]}
      aria-label={t("next_aria", { name: next.name })}
      className={className}
      data-testid="round-next"
    >
      <StudentAvatar name={next.name} src={null} size={32} />
      <span className="flex flex-col leading-tight">
        <span className="text-xs font-extrabold text-[var(--color-secondary)]">{t("round_node_next")}</span>
        <span className="text-sm font-extrabold text-[var(--color-main)]">{next.name}</span>
      </span>
      <ChevronRight className="size-4.5 text-[var(--color-secondary)]" aria-hidden />
    </Link>
  );
}

function Identity({
  report,
  next,
  today,
  pressed,
  glow,
  marking,
  ending,
  showArchive,
  onToggleAttention,
  onOpenArchive,
  onEndLink,
}: {
  report: MentorshipStudentReportDto;
  next: RoundNext | null;
  today: string;
  /** The coach pressed the mark on this screen: its ✓ draws. */
  pressed: boolean;
  glow: boolean;
  marking: boolean;
  ending: boolean;
  showArchive: boolean;
  onToggleAttention: (attended: boolean) => void;
  onOpenArchive: () => void;
  onEndLink: () => void;
}) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  const attended = isAttended(report);
  const meta = [
    report.studentExamType,
    report.acceptedAt ? t("my_coach_since", { date: formatDate(report.acceptedAt, locale) }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const days = attended ? daysSinceMark(report.attendedAt!, today) : 0;
  const seen =
    days <= 0 ? t("row_seen_today") : days === 1 ? t("row_seen_yesterday") : t("row_seen_days_ago", { count: days });

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <StudentAvatar name={report.studentDisplayName} src={null} size={56} />
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="break-words text-title font-extrabold leading-tight text-[var(--color-main)] sm:text-display">
            {report.studentDisplayName}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
            {meta ? <span className="text-body-sm font-semibold text-[var(--color-secondary)]">{meta}</span> : null}
            {sortFlags(report.riskFlags).map((flag) => (
              <RiskChip key={flag} flag={flag} />
            ))}
            {/* When the coach looked: said here, so the toggle can keep one name in both states. */}
            <AnimatePresence initial={false}>
              {attended ? (
                <motion.span
                  key="seen"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={COACH_FAST}
                  className="inline-flex items-center gap-1 text-body-sm font-extrabold text-[var(--coach-accent-ink)]"
                >
                  <CoachCheck draw={pressed} className="size-4" />
                  {seen}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {/* A calm student has nothing to mark; a mark that still counts can be taken back. */}
        {report.riskFlags.length > 0 || attended ? (
          <button
            type="button"
            aria-pressed={attended}
            disabled={marking}
            onClick={() => onToggleAttention(!attended)}
            data-testid="report-attention"
            className={`inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-4 text-body-sm font-extrabold outline-none transition-[color,background-color,border-color,scale] duration-150 ease-[var(--ease-smooth-out)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] active:scale-95 disabled:cursor-wait motion-reduce:transition-none ${
              attended
                ? "border-[var(--coach-accent)] bg-[var(--coach-accent)] text-[var(--color-bg)]"
                : "border-[var(--play-line)] bg-[var(--color-surface)] text-[var(--color-main)] hover:border-[var(--coach-accent)]"
            }`}
          >
            <CoachCheck key={String(attended)} draw={attended && pressed} className="size-4.5" />
            {t("attention_mark")}
          </button>
        ) : null}
        <PopoverMenu
          align="right"
          menuClassName="w-60 py-1"
          trigger={({ open, setOpen, menuId }) => (
            <button
              type="button"
              aria-label={t("report_more_actions")}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls={open ? menuId : undefined}
              onClick={() => setOpen(!open)}
              className="grid size-11 cursor-pointer place-items-center rounded-full border border-[var(--play-line)] bg-[var(--color-surface)] text-[var(--color-main)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              <Ellipsis className="size-5" aria-hidden />
            </button>
          )}
        >
          {showArchive ? <PopoverMenuItem onClick={onOpenArchive}>{t("report_menu_archive")}</PopoverMenuItem> : null}
          <PopoverMenuItem danger disabled={ending} onClick={onEndLink}>
            {t("report_end_link")}
          </PopoverMenuItem>
        </PopoverMenu>
        {next ? (
          <div className="ml-auto lg:hidden">
            <RoundNextLink next={next} glow={glow} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
