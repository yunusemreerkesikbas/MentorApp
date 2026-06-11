import type { ReactNode } from "react";

export interface SectionHeadingProps {
  children: ReactNode;
  /** Optional trailing slot (e.g. an "add" link/button) aligned to the right. */
  action?: ReactNode;
  /** Optional supporting line under the title (Lato 14 secondary). */
  subtitle?: ReactNode;
  /** Heading level — keeps the document outline correct per screen. Default h2. */
  as?: "h2" | "h3";
  className?: string;
}

/**
 * Section heading (DESIGN.md §3 — H2 League Spartan 20/SemiBold #111, §6 layout).
 * Presentational/server-safe: title on the left, optional action on the right.
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
    <div className={`flex items-end justify-between gap-3 ${className ?? ""}`}>
      <div className="flex flex-col gap-1">
        <Tag
          className="text-xl leading-tight font-semibold"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {children}
        </Tag>
        {subtitle ? (
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
