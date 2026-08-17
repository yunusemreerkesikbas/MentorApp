"use client";
import { LoaderCircle } from "lucide-react";

import type * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  /** Shows an inline spinner and disables the button (label stays — keep it localized at the call site). */
  busy?: boolean;
  /** Stretch to the container width (Nuton primary button is full-width 335px on mobile). */
  fullWidth?: boolean;
  /**
   * `primary` = black fill (default Nuton).
   * `secondary` = transparent + subtle border.
   * `accent` = progress/accent fill (soft primary CTAs).
   * `soft` = accent-soft well + main text (secondary companion actions).
   * `ghost` = no fill/border; light surface on hover.
   */
  variant?: "primary" | "secondary" | "accent" | "soft" | "ghost";
}

/** Inline loading spinner (thin-line, DESIGN.md §7); respects reduced motion via CSS. */
function Spinner() {
  return (
    <LoaderCircle
      size={18}
      strokeWidth={2.5}
      className="animate-spin motion-reduce:animate-none"
      aria-hidden
    />
  );
}

function variantStyles(variant: NonNullable<ButtonProps["variant"]>): {
  className: string;
  style: React.CSSProperties;
} {
  switch (variant) {
    case "secondary":
      return {
        className: "hover:bg-[color-mix(in_srgb,var(--color-surface)_60%,transparent)]",
        style: {
          backgroundColor: "transparent",
          color: "var(--color-main)",
          borderColor: "color-mix(in srgb, var(--color-main) 15%, transparent)",
          boxShadow: "none",
        },
      };
    case "accent":
      return {
        className:
          "text-white shadow-[var(--shadow-card)] hover:opacity-90 hover:shadow-[var(--shadow-card-hover)]",
        style: {
          backgroundColor: "var(--color-accent)",
          color: "#fff",
          borderColor: "var(--color-accent)",
        },
      };
    case "soft":
      return {
        className: "hover:opacity-90",
        style: {
          backgroundColor:
            "color-mix(in srgb, var(--color-accent-soft) 70%, var(--color-surface))",
          color: "var(--color-main)",
          borderColor:
            "color-mix(in srgb, var(--color-accent) 22%, transparent)",
          boxShadow: "none",
        },
      };
    case "ghost":
      return {
        className:
          "border-transparent bg-transparent hover:bg-[var(--color-surface-container)]",
        style: {
          color: "var(--color-main)",
          borderColor: "transparent",
          boxShadow: "none",
        },
      };
    default:
      return {
        className:
          "shadow-[var(--shadow-card)] hover:opacity-90 hover:shadow-[var(--shadow-card-hover)]",
        style: {
          backgroundColor: "var(--color-btn)",
          color: "var(--color-btn-label)",
          borderColor: "var(--color-btn)",
        },
      };
  }
}

/**
 * Primary button (DESIGN.md §6, node 2:770): `--color-btn` fill, radius 10,
 * Plus Jakarta Sans Bold, `--color-btn-label`. Filled variants (`primary`/`accent`) rest at `shadow-card`
 * and lift to `shadow-card-hover` on hover; all variants press to 98% scale on `:active` (DESIGN.md
 * §9 Micro layer). Loading = spinner + same (localized) label, disabled, `aria-busy`. Tokenized
 * keyboard focus ring (DESIGN.md §2.4).
 */
export function Button({
  children,
  busy,
  fullWidth,
  variant = "primary",
  disabled,
  className,
  ...rest
}: ButtonProps) {
  const look = variantStyles(variant);
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-card)] border px-6 py-3 text-base font-bold outline-none transition-[opacity,background-color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100 ${look.className} ${fullWidth ? "w-full" : "w-fit"} ${className ?? ""}`}
      style={{
        ...look.style,
        fontFamily: "var(--font-body)",
      }}
    >
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}
