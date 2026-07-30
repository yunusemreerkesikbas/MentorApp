import type * as React from "react";
import { Card } from "./card.js";

export interface DataCardSource {
  /** Authority label, e.g. "ÖSYM". */
  label: string;
  /** Optional source link (opens in a new tab). */
  url?: string;
  /** Pre-localized prefix, e.g. "Kaynak:" / "Source:" (i18n lives in the app). */
  prefix?: string;
}

export interface DataCardProps {
  /** Small label above the value (Nunito Sans 12 secondary, uppercased). */
  label?: string;
  /** Headline value — the authoritative fact (Nunito Sans, large). */
  value: React.ReactNode;
  /** Supporting line under the value (Nunito Sans 14 secondary). */
  caption?: React.ReactNode;
  /** Leading visual (icon/emoji), sized by the caller. */
  icon?: React.ReactNode;
  /** Trust attribution rendered as a subtle footer (guardrail #1 — verified source). */
  source?: DataCardSource;
  /** Extra content (e.g. a progress bar) rendered below the value block. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Data card (DESIGN.md §2.2/§6 translucent surface; AGENTS §4 #1 "data card render").
 * Renders an authoritative fact verbatim with optional source attribution — no paraphrase.
 * Built on `Card` so it inherits the single shadow + 10px radius tokens.
 */
export function DataCard({
  label,
  value,
  caption,
  icon,
  source,
  children,
  className,
}: DataCardProps) {
  return (
    <Card className={className}>
      <div className="flex items-start gap-4">
        {icon ? <div className="shrink-0">{icon}</div> : null}
        <div className="flex min-w-0 flex-col gap-1">
          {label ? (
            <span
              className="text-xs font-semibold tracking-wide uppercase"
              style={{
                color: "var(--color-secondary)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {label}
            </span>
          ) : null}
          <div
            className="text-3xl leading-tight font-bold"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {value}
          </div>
          {caption ? (
            <p className="text-sm" style={{ color: "var(--color-body)" }}>
              {caption}
            </p>
          ) : null}
          {children}
          {source ? (
            <p
              className="mt-2 text-xs"
              style={{ color: "var(--color-secondary)" }}
            >
              {source.prefix ? `${source.prefix} ` : null}
              {source.url ? (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2"
                  style={{ color: "var(--color-secondary)" }}
                >
                  {source.label} ↗
                </a>
              ) : (
                <span className="font-semibold">{source.label}</span>
              )}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
