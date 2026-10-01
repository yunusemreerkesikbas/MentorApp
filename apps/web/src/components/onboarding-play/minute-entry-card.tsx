"use client";

import { useId } from "react";

export function MinuteEntryCard({
  label,
  unit,
  placeholder,
  value,
  selected,
  disabled,
  invalidMessage,
  onChange,
}: {
  label: string;
  unit: string;
  placeholder: string;
  value: number | null;
  selected: boolean;
  disabled?: boolean;
  invalidMessage?: string;
  onChange: (value: number | null) => void;
}) {
  const errorId = useId();
  const invalid =
    selected &&
    value != null &&
    (!Number.isInteger(value) || value < 10 || value > 600);
  return (
    <label
      className={`flex min-h-28 flex-col items-center justify-center gap-1 rounded-[var(--play-radius)] border-2 border-b-4 px-2 py-3 text-center ${selected ? "border-[var(--play-cta)] bg-[var(--play-selected)]" : "border-[var(--play-line)] bg-[var(--color-surface)]"}`}
    >
      <span className="text-base font-bold text-[var(--color-main)]">
        {label}
      </span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={10}
          max={600}
          step={1}
          disabled={disabled}
          value={selected && value != null ? value : ""}
          onChange={(event) =>
            onChange(
              event.target.value === "" ? null : Number(event.target.value),
            )
          }
          placeholder={placeholder}
          aria-label={label}
          aria-invalid={invalid}
          aria-describedby={invalid && invalidMessage ? errorId : undefined}
          className="w-24 rounded-[var(--play-radius)] border border-[var(--play-line)] bg-[var(--color-surface)] px-2 py-1 text-center text-xl font-bold text-[var(--color-main)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        />
        <span className="font-bold text-[var(--color-secondary)]">{unit}</span>
      </span>
      {invalid && invalidMessage ? (
        <span
          id={errorId}
          role="alert"
          className="text-xs font-semibold text-[var(--color-danger)]"
        >
          {invalidMessage}
        </span>
      ) : null}
    </label>
  );
}
