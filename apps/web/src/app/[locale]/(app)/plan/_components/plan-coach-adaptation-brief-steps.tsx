"use client";

import { useTranslations } from "next-intl";
import { PlayGridCard, PlayOptionRow } from "@/components/onboarding-play/play-choice";
import {
  PLAN_ADAPTATION_DAY_CHOICES,
  PLAN_ADAPTATION_MINUTE_CHOICES,
  PLAN_ADAPTATION_NOTE_MAX,
  PLAN_ADAPTATION_SUBJECT_CAP,
} from "./plan-coach-adaptation-brief-note";

/** Step bodies of the "Koçla planla" wizard; the shell owns state and navigation. */

export function BriefDaysStep({
  title,
  days,
  rhythmDays,
  onSelect,
}: {
  title: string;
  days: number | null;
  /** The student's own weekly rhythm, badged so a default never looks arbitrary. */
  rhythmDays: number | null;
  onSelect: (days: number) => void;
}) {
  const t = useTranslations("plan");
  return (
    <div role="radiogroup" aria-label={title} className="grid grid-cols-2 gap-3 pt-3">
      {PLAN_ADAPTATION_DAY_CHOICES.map((choice, choiceIndex) => (
        <PlayGridCard
          key={choice}
          index={choiceIndex}
          label={t("coach_adaptation_days_unit")}
          badge={choice === rhythmDays ? t("coach_adaptation_rhythm_badge") : undefined}
          art={<ChoiceFigure value={String(choice)} selected={days === choice} />}
          selected={days === choice}
          onSelect={() => onSelect(choice)}
        />
      ))}
    </div>
  );
}

export function BriefMinutesStep({
  title,
  minutes,
  goalMinutes,
  rhythmMinutes,
  onSelect,
}: {
  title: string;
  minutes: number | null;
  goalMinutes: number | null;
  rhythmMinutes: number | null;
  onSelect: (minutes: number) => void;
}) {
  const t = useTranslations("plan");
  return (
    <div role="radiogroup" aria-label={title} className="grid grid-cols-2 gap-3 pt-3">
      {PLAN_ADAPTATION_MINUTE_CHOICES.map((choice, choiceIndex) => (
        <PlayGridCard
          key={choice}
          index={choiceIndex}
          label={t("coach_adaptation_minutes_unit")}
          badge={
            choice === goalMinutes
              ? t("coach_adaptation_minutes_badge")
              : choice === rhythmMinutes
                ? t("coach_adaptation_rhythm_badge")
                : undefined
          }
          art={<ChoiceFigure value={String(choice)} selected={minutes === choice} />}
          selected={minutes === choice}
          onSelect={() => onSelect(choice)}
        />
      ))}
    </div>
  );
}

export function BriefSubjectsStep({
  title,
  loaded,
  options,
  selected,
  suggested,
  onToggle,
}: {
  title: string;
  loaded: boolean;
  options: ReadonlyArray<{ slug: string; name: string }>;
  selected: readonly string[];
  /** Names the coach suggested from the student's own mocks and notebook. */
  suggested: ReadonlySet<string>;
  onToggle: (name: string) => void;
}) {
  const t = useTranslations("plan");
  if (!loaded) {
    return (
      <p className="text-base font-medium text-[var(--color-secondary)]">{t("loading")}</p>
    );
  }
  return (
    <div role="group" aria-label={title} className="flex flex-col gap-3">
      {options.map((subject, subjectIndex) => (
        <PlayOptionRow
          key={subject.slug}
          multiple
          index={subjectIndex}
          label={subject.name}
          sub={
            suggested.has(subject.name.toLocaleLowerCase("tr-TR"))
              ? t("coach_adaptation_suggested")
              : undefined
          }
          selected={selected.includes(subject.name)}
          disabled={
            !selected.includes(subject.name) &&
            selected.length >= PLAN_ADAPTATION_SUBJECT_CAP
          }
          onSelect={() => onToggle(subject.name)}
        />
      ))}
    </div>
  );
}

export function BriefNoteStep({
  note,
  onChange,
}: {
  note: string;
  onChange: (note: string) => void;
}) {
  const t = useTranslations("plan");
  return (
    <label className="flex flex-col gap-2">
      <span className="sr-only">{t("coach_adaptation_note_label")}</span>
      <textarea
        value={note}
        onChange={(event) =>
          onChange(event.target.value.slice(0, PLAN_ADAPTATION_NOTE_MAX))
        }
        placeholder={t("coach_adaptation_note_placeholder")}
        maxLength={PLAN_ADAPTATION_NOTE_MAX}
        rows={4}
        className="min-h-32 w-full resize-y rounded-[var(--play-radius)] border-2 border-[var(--play-line)] bg-[var(--color-surface)] px-4 py-3 text-base text-[var(--color-main)] outline-none focus:border-[var(--play-cta)]"
      />
      <span className="text-sm font-medium text-[var(--color-secondary)]">
        {t("coach_adaptation_note_hint", { count: note.length })}
      </span>
    </label>
  );
}

function ChoiceFigure({ value, selected }: { value: string; selected: boolean }) {
  return (
    <span
      className={`text-3xl font-extrabold tabular-nums ${selected ? "text-[var(--play-selected-ink)]" : "text-[var(--color-main)]"}`}
    >
      {value}
    </span>
  );
}
