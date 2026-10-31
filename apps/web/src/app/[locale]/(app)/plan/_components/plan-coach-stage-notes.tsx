"use client";

import "@fontsource-variable/caveat/wght.css";
import {
  Activity,
  BatteryMedium,
  BookOpen,
  CalendarCheck,
  CalendarRange,
  ChartColumn,
  ClipboardList,
  Compass,
  Flame,
  ListChecks,
  Sparkles,
  Target,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { CoachUsedEvidenceDto } from "@mentor/types";

/** What each kind of evidence looks like on its note. A kind the client does not know yet gets Sparkles. */
const GLYPH: Partial<Record<string, LucideIcon>> = {
  MOCK_PERFORMANCE: ClipboardList,
  WEAK_SUBJECTS: Target,
  NOTEBOOK_TOPICS: BookOpen,
  LONG_TERM_RHYTHM: Activity,
  RECENT_RHYTHM: Activity,
  SUBJECT_BALANCE: ChartColumn,
  PLAN_FOLLOW_THROUGH: ListChecks,
  STREAK: Flame,
  MOOD: BatteryMedium,
  GOAL: Compass,
  EXAM_PHASE: CalendarRange,
  TODAY_PLAN: CalendarCheck,
  TODAY_FOCUS: Timer,
  ACTION_OUTCOME: Sparkles,
};

/**
 * What the coach read, one paper note at a time, dropping onto a small pile. The pile is drawn for
 * the eye only; screen readers get every note once, as a list.
 */
export function PlanCoachStageNotes({
  notes,
  index,
  depth,
  arrived,
}: {
  notes: CoachUsedEvidenceDto[];
  index: number;
  depth: 0 | 1 | 2;
  arrived: boolean;
}) {
  const t = useTranslations("plan");
  const note = notes[index];
  if (!note) return null;

  const label = (type: string) =>
    t.has(`coach_adaptation_evidence.${type}`)
      ? t(`coach_adaptation_evidence.${type}`)
      : t("coach_adaptation_evidence.OTHER");
  const Glyph = GLYPH[note.type] ?? Sparkles;

  return (
    <>
      <div
        aria-hidden
        className={`relative mt-2 h-[168px] w-full md:max-w-[460px] ${arrived ? "pcs-leave" : ""}`}
      >
        {depth >= 2 ? <div className="pcs-sheet pcs-sheet-2" /> : null}
        {depth >= 1 ? <div className="pcs-sheet pcs-sheet-1" /> : null}
        {/* Keyed by the note, so each new one drops in. */}
        <div
          key={index}
          data-stage-note
          className="pcs-paper pcs-note-top absolute inset-0 flex flex-col gap-1.5 px-[22px] pb-[18px] pt-6"
        >
          <span className="pcs-tape" />
          <div className="flex items-center gap-2 text-[var(--pcs-label)]">
            <Glyph size={20} strokeWidth={2} />
            <span className="pcs-hand text-[26px] font-bold leading-7">
              {label(note.type)}
            </span>
          </div>
          <p className="line-clamp-4 text-base font-bold leading-[23px]">
            {note.summary}
          </p>
        </div>
      </div>
      <ul className="sr-only">
        {notes.map((item, at) => (
          <li key={at}>
            {label(item.type)}: {item.summary}
          </li>
        ))}
      </ul>
    </>
  );
}
