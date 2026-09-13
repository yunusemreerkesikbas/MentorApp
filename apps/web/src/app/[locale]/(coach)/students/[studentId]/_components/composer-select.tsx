"use client";

import { COACH_FIELD_CLASS } from "@/components/mentorship/coach-ui";

/**
 * A native `<select>`: it opens the platform's own picker, is keyboard- and screen-reader-correct
 * for free, and costs no bundle. A combobox library for three dropdowns would never earn its weight.
 *
 * Options are `{ value, label }` pairs rather than plain strings because the template picker keys
 * on an id while the taxonomy pickers key on the label itself; one component, two shapes of data.
 */
export interface ComposerSelectOption {
  value: string;
  label: string;
}

export function ComposerSelect({
  label,
  value,
  placeholder,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: readonly ComposerSelectOption[];
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="coach-footnote font-semibold text-[var(--color-secondary)]">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={COACH_FIELD_CLASS}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Taxonomy pickers carry the label as the value; this saves every call site the same map. */
export const labelOptions = (labels: readonly string[]): ComposerSelectOption[] =>
  labels.map((label) => ({ value: label, label }));
