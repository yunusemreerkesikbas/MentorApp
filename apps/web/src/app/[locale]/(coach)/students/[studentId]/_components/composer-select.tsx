"use client";

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
    <label className="grid gap-1 text-xs font-semibold" style={{ color: "var(--color-secondary)" }}>
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-sm text-[var(--color-main)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-60"
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
