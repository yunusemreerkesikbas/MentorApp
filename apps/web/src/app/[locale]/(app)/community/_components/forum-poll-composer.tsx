"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ForumPollInput } from "@mentor/validation";
import { durationParts, durationToMinutes, type PollDurationParts } from "./poll-duration";

export const DEFAULT_FORUM_POLL: ForumPollInput = {
  options: ["", ""],
  durationMinutes: 1_440,
};

export function ForumPollComposer({
  value,
  onChange,
  onRemove,
  disabled = false,
}: {
  value: ForumPollInput;
  onChange: (value: ForumPollInput) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const t = useTranslations("community");
  const parts = durationParts(value.durationMinutes);

  const setDuration = (patch: Partial<PollDurationParts>) => {
    const next = { ...parts, ...patch };
    onChange({
      ...value,
      durationMinutes: durationToMinutes(next),
    });
  };

  return (
    <fieldset className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <legend className="px-1 text-sm font-bold text-[var(--color-main)]">{t("poll_title")}</legend>
      <div className="grid gap-3">
        {value.options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <label className="sr-only" htmlFor={`poll-option-${index}`}>
              {t("poll_option_label", { number: index + 1 })}
            </label>
            <input
              id={`poll-option-${index}`}
              value={option}
              maxLength={25}
              disabled={disabled}
              onChange={(event) => {
                const options = [...value.options];
                options[index] = event.target.value;
                onChange({ ...value, options });
              }}
              placeholder={t("poll_option_placeholder", { number: index + 1 })}
              className="min-h-11 min-w-0 flex-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-main)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            />
            {value.options.length > 2 ? (
              <button
                type="button"
                disabled={disabled}
                aria-label={t("poll_remove_option", { number: index + 1 })}
                onClick={() =>
                  onChange({
                    ...value,
                    options: value.options.filter((_, optionIndex) => optionIndex !== index),
                  })
                }
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--color-secondary)] hover:bg-[var(--color-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              >
                <X size={18} aria-hidden />
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {value.options.length < 4 ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ ...value, options: [...value.options, ""] })}
          className="mt-2 flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-bold text-[var(--community-blue-ink)] hover:bg-[var(--community-blue-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <Plus size={17} aria-hidden /> {t("poll_add_option")}
        </button>
      ) : null}

      <div className="mt-3 border-t border-[var(--color-border)] pt-3">
        <p className="text-sm font-bold text-[var(--color-main)]">{t("poll_duration")}</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <DurationSelect
            label={t("poll_days")}
            value={parts.days}
            values={Array.from({ length: 8 }, (_, index) => index)}
            onChange={(days) => setDuration(days === 7 ? { days, hours: 0, minutes: 0 } : { days })}
            disabled={disabled}
          />
          <DurationSelect
            label={t("poll_hours")}
            value={parts.hours}
            values={Array.from({ length: 24 }, (_, index) => index)}
            onChange={(hours) => setDuration({ hours })}
            disabled={disabled || parts.days === 7}
          />
          <DurationSelect
            label={t("poll_minutes")}
            value={parts.minutes}
            values={[0, 5, 10, 15, 20, 30, 45, 59]}
            onChange={(minutes) => setDuration({ minutes })}
            disabled={disabled || parts.days === 7}
          />
        </div>
        {value.durationMinutes < 5 ? (
          <p role="alert" className="mt-2 text-sm text-[var(--color-error)]">
            {t("poll_duration_error")}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        className="mt-3 min-h-11 w-full border-t border-[var(--color-border)] pt-3 text-sm font-bold text-[var(--color-error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      >
        {t("poll_remove")}
      </button>
    </fieldset>
  );
}

function DurationSelect({
  label,
  value,
  values,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  values: number[];
  onChange: (value: number) => void;
  disabled: boolean;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-[var(--color-secondary)]">
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-h-11 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-sm text-[var(--color-main)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      >
        {values.map((entry) => (
          <option key={entry} value={entry}>{entry}</option>
        ))}
      </select>
    </label>
  );
}
