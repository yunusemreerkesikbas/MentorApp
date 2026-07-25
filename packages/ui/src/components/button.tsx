"use client";

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle.mjs";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
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
  return <LoaderCircle size={18} strokeWidth={2.5} className="animate-spin motion-reduce:animate-none" aria-hidden />;
}

function variantStyles(
  variant: NonNullable<ButtonProps["variant"]>,
): { className: string; style: CSSProperties } {
  switch (variant) {
    case "secondary":
      return {
        className: "hover:bg-white/60",
        style: {
          backgroundColor: "transparent",
          color: "var(--color-main)",
          borderColor: "color-mix(in srgb, var(--color-main) 15%, transparent)",
          boxShadow: "none",
        },
      };
    case "accent":
      return {
        className: "text-white hover:opacity-90",
        style: {
          backgroundColor: "var(--color-accent)",
          color: "#fff",
          borderColor: "var(--color-accent)",
          boxShadow: "var(--shadow-card)",
        },
      };
    case "soft":
      return {
        className: "hover:opacity-90",
        style: {
          backgroundColor:
            "color-mix(in srgb, var(--color-accent-soft) 70%, #fff)",
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
        className: "text-white hover:opacity-90",
        style: {
          backgroundColor: "var(--color-btn)",
          color: "#fff",
          borderColor: "var(--color-btn)",
          boxShadow: "var(--shadow-card)",
        },
      };
  }
}

/**
 * Primary button (DESIGN.md §6, node 2:770): black fill, radius 10,
 * Nunito Sans Bold, white label, single shadow token. Loading = spinner + same (localized) label,
 * disabled, `aria-busy`. Tokenized keyboard focus ring (DESIGN.md §2.4).
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
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-card)] border px-6 py-3 text-base font-bold outline-none transition-[opacity,background-color] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${look.className} ${fullWidth ? "w-full" : "w-fit"} ${className ?? ""}`}
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
