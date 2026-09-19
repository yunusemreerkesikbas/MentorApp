"use client";

import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Compact play-ledge control for notebook forms. Not `<Button size="sm" className="...">`:
 * `@mentor/ui` Button has no class merge, so a smaller `h-*` is not guaranteed to win.
 */
export function NotebookCompactButton({
  variant = "primary",
  tone,
  large,
  busy,
  disabled,
  fullWidth,
  onDark,
  onClick,
  children,
}: {
  variant?: "primary" | "secondary" | "ghost";
  /** Review deck "çözebildim" — green ledge, not the blue CTA. */
  tone?: "success";
  large?: boolean;
  busy?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  onDark?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  const filled = variant === "primary";
  const success = filled && tone === "success";
  const look = success
    ? "bg-[var(--color-success)] text-[var(--color-btn-label)] shadow-[0_4px_0_color-mix(in_srgb,var(--color-success)_70%,black)]"
    : filled
      ? "bg-[var(--play-cta)] text-[var(--play-cta-ink)] shadow-[0_4px_0_var(--play-cta-edge)]"
      : onDark
        ? "border-2 border-[var(--play-scrim-ink)]/30 bg-[var(--play-scrim-ink)]/10 text-[var(--play-scrim-ink)] shadow-[0_4px_0_color-mix(in_srgb,var(--play-scrim-ink)_30%,transparent)]"
        : "border-2 border-[var(--play-line)] bg-[var(--color-surface)] text-[var(--play-selected-ink)] shadow-[0_4px_0_var(--play-line)]";
  return (
    <button
      type="button"
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      onClick={onClick}
      className={`inline-flex ${large ? "h-11" : "h-9"} cursor-pointer items-center justify-center gap-1.5 rounded-[var(--play-radius)] px-3 text-sm font-extrabold outline-none transition-[transform,box-shadow] duration-[120ms] ease-out focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[var(--play-track)] disabled:text-[var(--color-secondary)] disabled:shadow-none disabled:active:translate-y-0 motion-reduce:transition-none ${look} ${fullWidth ? "w-full" : "flex-1"}`}
    >
      {busy ? (
        <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden />
      ) : null}
      {children}
    </button>
  );
}
