"use client";

import { useLocale, useTranslations } from "next-intl";
import { PlayGridCard, PlayOptionRow } from "@/components/onboarding-play/play-choice";
import { MinuteEntryCard } from "@/components/onboarding-play/minute-entry-card";
import {
  PLAN_ADAPTATION_MINUTE_CHOICES,
  PLAN_ADAPTATION_NOTE_MAX,
  type PlanWindowDay,
} from "./plan-coach-adaptation-brief-note";

const FIELD =
  "w-full rounded-[var(--play-radius)] border-2 border-[var(--play-line)] bg-[var(--color-surface)] px-4 py-3 text-base text-[var(--color-main)] outline-none focus:border-[var(--play-cta)]";

/** Step bodies of the "Koçla planla" wizard; the shell owns state and navigation. */

export function BriefWeekdaysStep({
  title,
  window,
  selected,
  rhythmWeekdays,
  onToggle,
}: {
  title: string;
  window: readonly PlanWindowDay[];
  selected: readonly number[];
  /** The weekdays the student studied on most; badged so a pre-pick never looks arbitrary. */
  rhythmWeekdays: readonly number[];
  onToggle: (weekday: number) => void;
}) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" });
  const dayMonth = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" });
  return (
    <div role="group" aria-label={title} className="grid gap-3 lg:grid-cols-2">
      {rhythmWeekdays.length > 0 ? (
        <p className="text-sm font-medium text-[var(--color-secondary)] lg:col-span-2">
          {t("coach_adaptation_days_rhythm")}
        </p>
      ) : null}
      {window.map((day, dayIndex) => {
        const when =
          dayIndex === 0
            ? t("coach_adaptation_today")
            : dayIndex === 1
              ? t("coach_adaptation_tomorrow")
              : dayMonth.format(day.date);
        return (
          <PlayOptionRow
            key={day.weekday}
            multiple
            index={dayIndex}
            label={weekday.format(day.date)}
            sub={
              rhythmWeekdays.includes(day.weekday)
                ? `${when} · ${t("coach_adaptation_rhythm_badge")}`
                : when
            }
            selected={selected.includes(day.weekday)}
            onSelect={() => onToggle(day.weekday)}
          />
        );
      })}
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
  onSelect: (minutes: number | null) => void;
}) {
  const t = useTranslations("plan");
  const custom = minutes != null && !(PLAN_ADAPTATION_MINUTE_CHOICES as readonly number[]).includes(minutes);
  return (
    <div className="pt-3">
      <div role="group" aria-label={title} className="grid grid-cols-2 gap-3">
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
        <MinuteEntryCard
          label={t("coach_adaptation_minutes_custom_label")}
          unit={t("coach_adaptation_minutes_unit")}
          value={minutes}
          selected={custom}
          onChange={onSelect}
        />
      </div>
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
        className={`min-h-32 resize-y ${FIELD}`}
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
