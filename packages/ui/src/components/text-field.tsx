"use client";

import type * as React from "react";
import { useId, useState } from "react";
import Eye from "lucide-react/dist/esm/icons/eye.mjs";
import EyeOff from "lucide-react/dist/esm/icons/eye-off.mjs";

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Field-level error: sets `aria-invalid`, danger border, and a described message below. */
  error?: string | null;
  /** On a `type="password"` field, renders a show/hide toggle with these localized labels. */
  revealLabels?: { show: string; hide: string };
}

/**
 * Text field (DESIGN.md §6, node 2:722): translucent white fill + 1px border, radius 10,
 * shadow token; label 12px secondary; value 16px body. State vocabulary (DESIGN.md §2.4):
 * tokenized focus ring, danger border + described message on `error`, 44px min touch target,
 * optional password reveal.
 */
export function TextField({
  label,
  className,
  error,
  revealLabels,
  type,
  id,
  ...rest
}: TextFieldProps) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const errorId = `${inputId}-error`;
  const isPassword = type === "password";
  const [revealed, setRevealed] = useState(false);
  const showToggle = isPassword && revealLabels != null;
  const effectiveType = isPassword && revealed ? "text" : type;

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
      <div className="relative">
        <input
          {...rest}
          id={inputId}
          type={effectiveType}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`min-h-11 w-full rounded-[var(--radius-card)] border bg-white/50 px-5 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${showToggle ? "pr-12" : ""}`}
          style={{
            color: "var(--color-body)",
            boxShadow: "var(--shadow-card)",
            fontFamily: "var(--font-body)",
            borderColor: error ? "var(--color-danger)" : "#ffffff",
          }}
        />
        {showToggle ? (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? revealLabels.hide : revealLabels.show}
            aria-pressed={revealed}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[var(--radius-card)] outline-none transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
            style={{ color: "var(--color-secondary)" }}
          >
            {revealed ? (
              <EyeOff size={20} strokeWidth={2} aria-hidden />
            ) : (
              <Eye size={20} strokeWidth={2} aria-hidden />
            )}
          </button>
        ) : null}
      </div>
      {error ? (
        <span
          id={errorId}
          role="alert"
          className="text-sm"
          style={{ color: "var(--color-danger)" }}
        >
          {error}
        </span>
      ) : null}
    </label>
  );
}
