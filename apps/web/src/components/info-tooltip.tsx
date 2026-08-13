"use client";
import { Info } from "lucide-react";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

export interface InfoTooltipProps {
  /** The longer explanation, shown on hover/focus/tap. */
  text: string;
  className?: string;
}

/**
 * Info icon beside a heading — reveals a longer explanation on hover/focus (desktop) or
 * tap (touch), instead of always-on subtitle copy crowding the layout.
 */
export function InfoTooltip({ text, className }: InfoTooltipProps) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span className={`relative inline-flex ${className ?? ""}`}>
      <button
        type="button"
        aria-label={t("info_label")}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full outline-none transition-colors hover:bg-black/[0.05] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
      >
        <Info
          className="size-3.5"
          style={{ color: "var(--color-secondary)" }}
          strokeWidth={2.25}
          aria-hidden
        />
      </button>
      {open ? (
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 w-64 -translate-x-1/2 text-pretty rounded-[var(--radius-card)] px-3 py-2 text-xs leading-relaxed"
          style={{
            background: "#ffffff",
            color: "var(--color-body)",
            boxShadow: "var(--shadow-card)",
            fontFamily: "var(--font-body)",
          }}
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
