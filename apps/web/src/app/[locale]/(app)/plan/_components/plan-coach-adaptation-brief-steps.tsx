"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  PLAN_ADAPTATION_MINUTES_MAX,
  PLAN_ADAPTATION_MINUTES_MIN,
} from "@mentor/validation";
import { PlayGridCard, PlayOptionRow } from "@/components/onboarding-play/play-choice";
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
    <div role="group" aria-label={title} className="flex flex-col gap-3">
      {rhythmWeekdays.length > 0 ? (
        <p className="text-sm font-medium text-[var(--color-secondary)]">
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
  const isPreset = (PLAN_ADAPTATION_MINUTE_CHOICES as readonly number[]).includes(minutes ?? -1);
  // A goal like 45 dk has no card; it starts in the field instead.
  const [draft, setDraft] = useState(() => (minutes != null && !isPreset ? String(minutes) : ""));
  return (
    <div className="flex flex-col gap-4 pt-3">
      <div role="radiogroup" aria-label={title} className="grid grid-cols-2 gap-3">
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
            onSelect={() => {
              setDraft("");
              onSelect(choice);
            }}
          />
        ))}
      </div>
      <label className="flex flex-col gap-2">
        <span className="text-base font-bold text-[var(--color-main)]">
          {t("coach_adaptation_minutes_custom_label")}
        </span>
        <span className="flex items-center gap-3">
          <input
            type="number"
            inputMode="numeric"
            min={PLAN_ADAPTATION_MINUTES_MIN}
            max={PLAN_ADAPTATION_MINUTES_MAX}
            step={5}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              onSelect(event.target.value === "" ? null : Number(event.target.value));
            }}
            placeholder={t("coach_adaptation_minutes_custom_placeholder")}
            className={`min-h-12 ${FIELD}`}
          />
          <span className="text-base font-bold text-[var(--color-secondary)]">
            {t("coach_adaptation_minutes_unit")}
          </span>
        </span>
      </label>
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
