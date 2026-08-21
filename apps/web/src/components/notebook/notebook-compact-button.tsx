"use client";

import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A smaller `Button`, shared by the notebook's own forms and overlays (`NotebookAddPanel`,
 * `NotebookReviewPanel`).
 *
 * Not `<Button className="...">`: `@mentor/ui`'s `Button` appends a caller's classes onto a fixed
 * Tailwind string with no merge utility (no `cn`/`tailwind-merge`), so a smaller `px-*`/`text-*`
 * utility isn't guaranteed to win the cascade over the component's own — Tailwind orders
 * same-category utilities by its own scale, not by source position, and the larger value usually
 * sorts later. Same visual language (radius token, focus ring, press scale), sized to match the
 * error-type pills already in the add form (`min-h-9`), which needed no such fight because they
 * were never a shared `Button`.
 */
export function NotebookCompactButton({
  variant = "primary",
  tone,
  large,
  busy,
  disabled,
  fullWidth,
  /** For `secondary`/`ghost` sitting on a photo or a dark gradient — `--color-main`/`--color-surface`
   *  read as barely-there dark-on-dark there. `primary` never needs this: it's a filled colour chip
   *  with white text regardless of what's behind it. */
  onDark,
  onClick,
  children,
}: {
  /** `ghost` has no fill or border — for a third, lower-priority action beside two real choices. */
  variant?: "primary" | "secondary" | "ghost";
  /**
   * Repaints a `primary` fill. Only `success` so far, for the review deck's "çözebildim": the
   * default `--color-btn` is pure black in the light theme and the deck's primary action sits on a
   * near-black backdrop, where it vanishes. Green also matches the label the swipe gesture reveals.
   */
  tone?: "success";
  /** 44px tall instead of 36px — for a primary action that is the whole point of its screen. */
  large?: boolean;
  busy?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  onDark?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  const primary = variant === "primary";
  const ghost = variant === "ghost";
  const primaryFill = tone === "success" ? "var(--color-success)" : "var(--color-btn)";
  return (
    <button
      type="button"
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      onClick={onClick}
      className={`inline-flex ${large ? "min-h-11" : "min-h-9"} cursor-pointer items-center justify-center gap-1.5 rounded-[var(--radius-card)] border px-3 text-sm font-semibold outline-none transition-[opacity,background-color] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100 ${primary ? "hover:opacity-90" : onDark ? "hover:bg-white/10" : "hover:bg-[color-mix(in_srgb,var(--color-surface)_60%,transparent)]"} ${fullWidth ? "w-full" : "flex-1"}`}
      style={{
        backgroundColor: primary ? primaryFill : onDark ? "rgba(255,255,255,0.08)" : "transparent",
        // `--color-btn-label` is the right label for either fill, and specifically for `success`:
        // the green inverts between themes (deep in light, pale in dark), so a hardcoded white
        // label reads at ~2:1 on the dark theme's `#6bc49a`. The token flips with it.
        color: primary
          ? "var(--color-btn-label)"
          : onDark
            ? "#ffffff"
            : "var(--color-main)",
        borderColor: primary
          ? primaryFill
          : ghost
            ? "transparent"
            : onDark
              ? "rgba(255,255,255,0.3)"
              : "color-mix(in srgb, var(--color-main) 15%, transparent)",
      }}
    >
      {busy ? (
        <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden />
      ) : null}
      {children}
    </button>
  );
}
