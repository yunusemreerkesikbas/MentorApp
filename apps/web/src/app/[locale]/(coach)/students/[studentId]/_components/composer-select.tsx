"use client";

import { useId } from "react";
import { MenuSelect } from "@/components/menu-select";
import { COACH_POPOVER_CLASS } from "@/components/mentorship/coach-ui";

/**
 * A labelled `MenuSelect`, the same dropdown the coach calendar's forms use.
 *
 * The menu shows the selected option's label and has no placeholder of its own, so the empty value
 * is a real first option ("Ders seçme", "Bir şablon seç").
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
  const labelId = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span
        id={labelId}
        className="text-xs font-semibold"
        style={{ color: "var(--color-secondary)", fontFamily: "var(--font-heading)" }}
      >
        {label}
      </span>
      <MenuSelect
        value={value}
        options={[{ value: "", label: placeholder }, ...options]}
        disabled={disabled}
        textSize="sm"
        aria-labelledby={labelId}
        menuClassName={COACH_POPOVER_CLASS}
        onChange={onChange}
      />
    </div>
  );
}

/** Taxonomy pickers carry the label as the value; this saves every call site the same map. */
export const labelOptions = (labels: readonly string[]): ComposerSelectOption[] =>
  labels.map((label) => ({ value: label, label }));
