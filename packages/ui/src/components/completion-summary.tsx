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
      className={`flex min-h-full w-full max-w-none flex-col items-center justify-center gap-5 rounded-none border-0 bg-[var(--color-surface)] py-[max(1.5rem,env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))] lg:max-h-full lg:min-h-0 lg:w-full lg:max-w-[24rem] lg:justify-start lg:overflow-y-auto lg:overscroll-contain lg:rounded-[var(--radius-card)] lg:border lg:border-[var(--color-border)] lg:px-8 lg:py-10 lg:[box-shadow:var(--shadow-card)] ${className ?? ""}`}
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
        className="flex shrink-0 items-center justify-center"
        style={{ color: "var(--color-progress)" }}
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
