"use client";
import { LoaderCircle } from "lucide-react";

import type * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  /** Shows an inline spinner and disables the button (label stays — keep it localized at the call site). */
  busy?: boolean;
  /** Stretch to the container width. */
  fullWidth?: boolean;
  /**
   * Sizing:
   * - `md` (default): play CTA, 56px, ExtraBold.
   * - `sm`: same ledge, 44px, for dialog rows.
   */
  size?: "sm" | "md";
  /**
   * `primary` / `accent` = filled play ledge.
   * `secondary` / `soft` / `ghost` = outline play ledge.
   */
  variant?: "primary" | "secondary" | "accent" | "soft" | "ghost";
}

const FILLED =
  "bg-[var(--play-cta)] text-[var(--play-cta-ink)] shadow-[0_4px_0_var(--play-cta-edge)]";
const OUTLINE =
  "border-2 border-[var(--play-line)] bg-[var(--color-surface)] text-[var(--play-selected-ink)] shadow-[0_4px_0_var(--play-line)]";

function Spinner({ size = 20 }: { size?: number }) {
  return (
    <LoaderCircle
      size={size}
      strokeWidth={2.5}
      className="animate-spin motion-reduce:animate-none"
      aria-hidden
    />
  );
}

/**
 * Play-ledge CTA (DESIGN.md §6). Press sinks into a 4px edge. Loading = spinner + same
 * (localized) label, disabled, `aria-busy`. Keyboard focus ring: DESIGN.md §2.4.
 */
export function Button({
  children,
  busy,
  fullWidth,
  size = "md",
  variant = "primary",
  disabled,
  className,
  ...rest
}: ButtonProps) {
  const filled = variant === "primary" || variant === "accent";
  const sizeStyles =
    size === "sm" ? "h-11 px-4 text-sm font-extrabold" : "h-14 px-6 text-lg font-extrabold";
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[var(--play-radius)] outline-none transition-[transform,box-shadow] duration-[120ms] ease-out focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[var(--play-track)] disabled:text-[var(--color-secondary)] disabled:shadow-none disabled:active:translate-y-0 motion-reduce:transition-none ${sizeStyles} ${filled ? FILLED : OUTLINE} ${fullWidth ? "w-full" : "w-fit"} ${className ?? ""}`}
    >
      {busy ? <Spinner size={size === "sm" ? 16 : 20} /> : null}
      {children}
    </button>
  );
}
