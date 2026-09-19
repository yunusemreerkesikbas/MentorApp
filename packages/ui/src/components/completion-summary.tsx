"use client";

import type * as React from "react";
import { CompletionStars } from "./completion-stars.js";

export interface CompletionStat {
  id: string;
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

export interface CompletionSummaryProps {
  title: string;
  /** Localized star row name. */
  starsLabel: string;
  filled: number;
  total?: number;
  stats?: CompletionStat[];
  /** Optional status between title and stats (e.g. a short-session hint). */
  status?: React.ReactNode;
  /** Heading level for the title. Session done uses `h1`; reuse defaults to `h2`. */
  titleAs?: "h1" | "h2";
  titleId?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Shared "completed" surface: stars, title, optional stat rows, then caller chrome.
 * No i18n and no scoring — pass copy and `filled` in.
 */
export function CompletionSummary({
  title,
  starsLabel,
  filled,
  total = 3,
  stats,
  status,
  titleAs = "h2",
  titleId,
  children,
  className,
}: CompletionSummaryProps) {
  const TitleTag = titleAs;

  return (
    <div
      className={`flex w-full max-w-[24rem] flex-col items-center gap-5 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-8 sm:px-8 sm:py-10 ${className ?? ""}`}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <CompletionStars filled={filled} total={total} label={starsLabel} />
      <TitleTag
        id={titleId}
        className="text-center text-xl font-bold"
        style={{
          color: "var(--color-main)",
          fontFamily: "var(--font-heading)",
          textWrap: "balance",
        }}
      >
        {title}
      </TitleTag>
      {status}
      {stats && stats.length > 0 ? (
        <ul className="flex w-full flex-col gap-2">
          {stats.map((stat) => (
            <li key={stat.id}>
              <CompletionStatRow stat={stat} />
            </li>
          ))}
        </ul>
      ) : null}
      {children}
    </div>
  );
}

function CompletionStatRow({ stat }: { stat: CompletionStat }) {
  return (
    <div
      className="flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-card)] border px-4 py-3"
      style={{ borderColor: "var(--color-border)" }}
    >
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--color-progress) 16%, transparent)",
          color: "var(--color-progress)",
        }}
      >
        {stat.icon}
      </span>
      <span
        className="min-w-0 flex-1 text-left text-sm font-medium"
        style={{
          color: "var(--color-secondary)",
          fontFamily: "var(--font-body)",
        }}
      >
        {stat.label}
      </span>
      <span
        className="shrink-0 text-sm font-bold tabular-nums"
        style={{
          color: "var(--color-main)",
          fontFamily: "var(--font-heading)",
        }}
      >
        {stat.value}
      </span>
    </div>
  );
}

export { CompletionStars } from "./completion-stars.js";
export type { CompletionStarsProps } from "./completion-stars.js";
