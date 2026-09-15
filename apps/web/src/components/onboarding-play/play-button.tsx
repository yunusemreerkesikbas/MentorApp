"use client";

import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

export type PlayButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  /** Keeps the fill and shows a spinner; the caller still guards against a second tap. */
  busy?: boolean;
};

const LOOK = {
  primary:
    "bg-[var(--play-cta)] text-[var(--play-cta-ink)] shadow-[0_4px_0_var(--play-cta-edge)]",
  secondary:
    "border-2 border-[var(--play-line)] bg-[var(--color-surface)] text-[var(--play-selected-ink)] shadow-[0_4px_0_var(--play-line)]",
} as const;

/** Play-surface CTA (DESIGN.md §2.5 `.onboarding-play-theme`): a 4px ledge the press sinks into. */
export function PlayButton({
  variant = "primary",
  busy = false,
  type = "button",
  className = "",
  children,
  ...rest
}: PlayButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      aria-busy={busy || undefined}
      className={`inline-flex h-14 w-full items-center justify-center gap-2 rounded-[var(--play-radius)] px-6 text-lg font-extrabold outline-none transition-[transform,box-shadow] duration-[120ms] ease-out focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[var(--play-track)] disabled:text-[var(--color-secondary)] disabled:shadow-none disabled:active:translate-y-0 motion-reduce:transition-none ${busy ? "pointer-events-none" : ""} ${LOOK[variant]} ${className}`}
    >
      {busy ? (
        <LoaderCircle size={20} strokeWidth={2.5} className="animate-spin motion-reduce:animate-none" aria-hidden />
      ) : null}
      {children}
    </button>
  );
}
