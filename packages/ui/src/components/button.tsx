"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle.mjs";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** Shows an inline spinner and disables the button (label stays — keep it localized at the call site). */
  busy?: boolean;
  /** Stretch to the container width (Nuton primary button is full-width 335px on mobile). */
  fullWidth?: boolean;
  /** `primary` = black fill (default); `secondary` = transparent + subtle border, same shape/size. */
  variant?: "primary" | "secondary";
}

/** Inline loading spinner (thin-line, DESIGN.md §7); respects reduced motion via CSS. */
function Spinner() {
  return <LoaderCircle size={18} strokeWidth={2.5} className="animate-spin motion-reduce:animate-none" aria-hidden />;
}

/**
 * Primary button (DESIGN.md §6, node 2:770): black fill, radius 10,
 * Lato Bold, white label, single shadow token. Loading = spinner + same (localized) label,
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
  const isSecondary = variant === "secondary";
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-card)] border px-6 py-3 text-base font-bold outline-none transition-[opacity,background-color] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${isSecondary ? "hover:bg-white/60" : "text-white hover:opacity-90"} ${fullWidth ? "w-full" : "w-fit"} ${className ?? ""}`}
      style={{
        backgroundColor: isSecondary ? "transparent" : "var(--color-btn)",
        color: isSecondary ? "var(--color-main)" : undefined,
        borderColor: isSecondary
          ? "color-mix(in srgb, var(--color-main) 15%, transparent)"
          : "var(--color-btn)",
        boxShadow: isSecondary ? "none" : "var(--shadow-card)",
        fontFamily: "var(--font-body)",
      }}
    >
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}
