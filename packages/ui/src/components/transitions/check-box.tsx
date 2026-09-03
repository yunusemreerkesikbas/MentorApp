"use client";

import type * as React from "react";
import { useEffect, useId, useRef } from "react";

export interface CheckBoxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  name?: string;
  value?: string;
  required?: boolean;
}

const CHECK_PATH = "M1 5.52L3.92 9.17L9.17 1";

/**
 * Accessible custom checkbox with fill + stroke-draw check.
 */
export function CheckBox({
  checked,
  onChange,
  disabled,
  className,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  name,
  value,
  required,
}: CheckBoxProps) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const len = Math.ceil(path.getTotalLength()) + 1;
    path.style.setProperty("--check-len", String(len));
  }, []);

  return (
    <>
      <button
        type="button"
        role="checkbox"
        id={inputId}
        className={`t-check${className ? ` ${className}` : ""}`}
        aria-checked={checked}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <svg viewBox="0 0 10.1668 10.1668" aria-hidden>
          <path ref={pathRef} d={CHECK_PATH} />
        </svg>
      </button>
      {name ? (
        <input
          type="checkbox"
          name={name}
          value={value}
          checked={checked}
          required={required}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          onChange={() => onChange(!checked)}
        />
      ) : null}
    </>
  );
}
