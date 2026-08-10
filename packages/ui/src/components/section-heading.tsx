import type * as React from "react";

export interface SectionHeadingProps {
  children: React.ReactNode;
  /** Optional action placed immediately beside the title (e.g. add “+”). */
  action?: React.ReactNode;
  /** Optional supporting line under the title (Plus Jakarta Sans 14 secondary). */
  subtitle?: React.ReactNode;
  /** Heading level — keeps the document outline correct per screen. Default h2. */
  as?: "h2" | "h3";
  className?: string;
}

/**
 * Section heading (DESIGN.md §3 — H2 Plus Jakarta Sans 20/SemiBold #111, §6 layout).
 * Presentational/server-safe: title + optional inline action, optional subtitle.
 */
export function SectionHeading({
  children,
  action,
  subtitle,
  as = "h2",
  className,
}: SectionHeadingProps) {
  const Tag = as;
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <div className="flex items-center gap-1">
        <Tag
          className="text-xl leading-tight font-semibold"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {children}
        </Tag>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {subtitle ? (
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
