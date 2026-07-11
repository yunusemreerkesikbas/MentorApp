"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { PuhuImage, type PuhuSizeToken, type PuhuVariant } from "@/components/puhu-image";

export type EmptyStateProps = {
  /** Short encouraging title (localized at call site). */
  title: string;
  /** Optional supporting line. */
  description?: string;
  /** Subject soft-3D under `/visuals/…`. Omit or fail → pastel placeholder. */
  visualSrc?: string;
  visualAlt?: string;
  /** Optional companion beside / under the visual. */
  puhuVariant?: PuhuVariant;
  puhuSize?: PuhuSizeToken | number;
  /** Single primary action (button or link). */
  action?: ReactNode;
  className?: string;
};

/**
 * Empty / nudge block (DESIGN.md §8, §10).
 * Asset-ready: drop files into `public/visuals/`; missing src keeps layout via blob placeholder.
 */
export function EmptyState({
  title,
  description,
  visualSrc,
  visualAlt = "",
  puhuVariant,
  puhuSize = "lg",
  action,
  className,
}: EmptyStateProps) {
  const [visualFailed, setVisualFailed] = useState(false);
  const showVisual = Boolean(visualSrc) && !visualFailed;
  /** Placeholder only when there is no usable visual and no Puhu (DESIGN.md §8). */
  const showPlaceholder = !showVisual && !puhuVariant;

  return (
    <div
      className={`flex flex-col items-center gap-4 px-5 py-8 text-center ${className ?? ""}`}
      style={{ fontFamily: "var(--font-body)" }}
    >
      <div className="relative flex items-end justify-center gap-2">
        {showVisual ? (
          <Image
            src={visualSrc!}
            alt={visualAlt}
            width={160}
            height={160}
            className="h-auto w-[160px] max-w-full"
            onError={() => setVisualFailed(true)}
          />
        ) : null}
        {showPlaceholder ? <PastelPlaceholder /> : null}
        {puhuVariant ? (
          <div className={showVisual ? "-mb-1" : undefined}>
            <PuhuImage variant={puhuVariant} size={puhuSize} />
          </div>
        ) : null}
      </div>

      <div className="flex max-w-sm flex-col gap-2">
        <h3
          className="text-lg font-bold leading-snug text-wrap-balance"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {title}
        </h3>
        {description ? (
          <p className="text-sm leading-relaxed text-pretty" style={{ color: "var(--color-secondary)" }}>
            {description}
          </p>
        ) : null}
      </div>

      {action ? <div className="mt-1 w-full max-w-xs">{action}</div> : null}
    </div>
  );
}

/** Soft pastel stand-in when `/visuals/` asset is not uploaded yet (DESIGN.md §8). */
function PastelPlaceholder() {
  return (
    <div
      aria-hidden
      className="relative h-[120px] w-[120px] overflow-hidden rounded-[var(--radius-card)]"
      style={{
        backgroundColor: "var(--color-accent-soft)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <span
        className="absolute -top-4 -left-4 h-20 w-20 rounded-full opacity-50 blur-2xl"
        style={{ backgroundColor: "#FF2DAB" }}
      />
      <span
        className="absolute -right-2 bottom-0 h-24 w-24 rounded-full opacity-70 blur-2xl"
        style={{ backgroundColor: "#9BC1FB" }}
      />
      <span
        className="absolute top-1/3 left-1/4 h-16 w-16 rounded-full opacity-60 blur-xl"
        style={{ backgroundColor: "#BDEBFF" }}
      />
    </div>
  );
}
