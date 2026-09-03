"use client";

import { useState } from "react";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

/**
 * Accessible on/off switch — CSS travel (no bounce; DESIGN.md §9).
 * `.is-init` only after first user interaction so mount does not animate.
 */
export function Toggle({
  checked,
  onChange,
  disabled,
  className,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
}: ToggleProps) {
  const [init, setInit] = useState(false);

  return (
    <button
      type="button"
      role="switch"
      id={id}
      className={["t-toggle", init ? "is-init" : "", className].filter(Boolean).join(" ")}
      data-on={checked ? "true" : "false"}
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        setInit(true);
        onChange(!checked);
      }}
    >
      <span className="t-toggle-thumb" aria-hidden />
    </button>
  );
}
