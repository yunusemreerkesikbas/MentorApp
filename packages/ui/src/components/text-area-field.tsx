"use client";

import type * as React from "react";
import { useId } from "react";

export interface TextAreaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string | null;
  /** Optional hint below the field (e.g. character count). */
  hint?: string | null;
}

/**
 * Multiline field — same visual vocabulary as TextField (DESIGN.md §6).
 */
export function TextAreaField({
  label,
  className,
  error,
  hint,
  id,
  ...rest
}: TextAreaFieldProps) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const errorId = `${inputId}-error`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const describedBy =
    [error ? errorId : null, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <label
      htmlFor={inputId}
      className={`flex flex-col gap-1 ${className ?? ""}`}
    >
      <span
        className="text-xs font-semibold"
        style={{
          color: "var(--color-secondary)",
          fontFamily: "var(--font-heading)",
        }}
      >
        {label}
      </span>
      <textarea
        {...rest}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="min-h-[88px] w-full resize-y rounded-[var(--radius-card)] border bg-[var(--color-surface-translucent)] px-5 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{
          color: "var(--color-body)",
          boxShadow: "var(--shadow-card)",
          fontFamily: "var(--font-body)",
          borderColor: error ? "var(--color-danger)" : "var(--color-border)",
        }}
      />
      {error ? (
        <span
          id={errorId}
          role="alert"
          className="text-sm"
          style={{ color: "var(--color-danger)" }}
        >
          {error}
        </span>
      ) : hint ? (
        <span
          id={hintId}
          className="text-xs"
          style={{
            color: "var(--color-secondary)",
            fontFamily: "var(--font-body)",
          }}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}
