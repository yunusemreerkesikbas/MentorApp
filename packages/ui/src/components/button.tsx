"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** Shows a busy label and disables the button. */
  busy?: boolean;
  /** Stretch to the container width (Nuton primary button is full-width 335px on mobile). */
  fullWidth?: boolean;
}

/**
 * Primary button (DESIGN.md §6, node 2:770): black fill, radius 10,
 * Lato Bold, white label, single shadow token.
 */
export function Button({ children, busy, fullWidth, disabled, className, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      className={`rounded-[var(--radius-card)] px-6 py-3 text-base font-bold text-white transition-opacity disabled:opacity-60 ${fullWidth ? "w-full" : "w-fit"} ${className ?? ""}`}
      style={{
        backgroundColor: "var(--color-btn)",
        boxShadow: "var(--shadow-card)",
        fontFamily: "var(--font-body)",
      }}
    >
      {busy ? "Bekleyin…" : children}
    </button>
  );
}
