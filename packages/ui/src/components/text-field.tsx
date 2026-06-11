"use client";

import type { InputHTMLAttributes } from "react";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

/**
 * Text field (DESIGN.md §6, node 2:722): translucent white fill + 1px white border,
 * radius 10, shadow token; floating label 12px secondary; value 16px body.
 */
export function TextField({ label, className, ...rest }: TextFieldProps) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span
        className="text-xs font-semibold"
        style={{ color: "var(--color-secondary)", fontFamily: "var(--font-heading)" }}
      >
        {label}
      </span>
      <input
        {...rest}
        className="rounded-[var(--radius-card)] border border-white bg-white/50 px-5 py-3 text-base outline-none focus:ring-2"
        style={{
          color: "var(--color-body)",
          boxShadow: "var(--shadow-card)",
          fontFamily: "var(--font-body)",
        }}
      />
    </label>
  );
}
