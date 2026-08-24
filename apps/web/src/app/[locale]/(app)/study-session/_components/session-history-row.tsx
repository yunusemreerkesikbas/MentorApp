"use client";

import { useLocale, useTranslations } from "next-intl";
import type { StudySessionDto } from "@mentor/types";
import { Chip } from "@mentor/ui";

/** Effort/mood glyphs matching the post-session check-in (1-3 -> 😩😐🙂). */
const EFFORT_EMOJI: Record<number, string> = { 1: "😩", 2: "😐", 3: "🙂" };

export interface SessionHistoryRowProps {
  session: StudySessionDto;
  index: number;
  minutesLabel: string;
  statusLabel: string;
  /** Analysis-rail density for the session sidebar / drawer. */
  compact?: boolean;
}

export function SessionHistoryRow({
  session,
  index,
  minutesLabel,
  statusLabel,
  compact = false,
}: SessionHistoryRowProps) {
  const t = useTranslations("session");
  const locale = useLocale();
  const started = new Date(session.startedAt);
  const dateLabel = started.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
  });
  const timeLabel = started.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const emoji = session.sessionMood ? EFFORT_EMOJI[session.sessionMood] : null;
  const abandoned = session.status === "ABANDONED";
  const minutes = Math.round(session.actualFocusSeconds / 60);
  const subject = session.subject?.trim() ?? "";

  if (compact) {
    return (
      <li>
        <div
          className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[10px] px-2.5 py-2"
        >
          <div className="min-w-0">
            <p
              className="truncate text-sm font-semibold"
              style={{
                color: "var(--color-main)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {minutesLabel}
              {subject ? (
                <span
                  className="ml-1.5 font-medium"
                  style={{ color: "var(--color-secondary)" }}
                >
                  {subject}
                </span>
              ) : null}
            </p>
            <p className="truncate text-xs" style={{ color: "var(--color-secondary)" }}>
              {statusLabel}
            </p>
          </div>
          <time
            dateTime={session.startedAt}
            className="shrink-0 text-right text-xs tabular-nums"
            style={{ color: "var(--color-secondary)" }}
          >
            {dateLabel}
          </time>
        </div>
      </li>
    );
  }

  return (
    <li
      className="flex items-center gap-3 px-4 py-3.5"
      style={
        index > 0
          ? {
              borderTop:
                "1px solid color-mix(in srgb, var(--color-progress-track) 65%, transparent)",
            }
          : undefined
      }
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums"
        style={{
          backgroundColor: abandoned
            ? "color-mix(in srgb, var(--color-secondary) 12%, transparent)"
            : "color-mix(in srgb, var(--color-progress) 14%, transparent)",
          color: abandoned ? "var(--color-secondary)" : "var(--color-main)",
          fontFamily: "var(--font-heading)",
        }}
        aria-hidden
      >
        {emoji ?? minutes}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: "var(--color-main)" }}
          >
            {minutesLabel}
          </span>
          {subject ? (
            <Chip className="max-w-[9rem] truncate px-2 py-0.5 text-[10px] font-bold uppercase">
              {subject}
            </Chip>
          ) : null}
          {session.planTaskTitle ? (
            <Chip
              className="max-w-[9rem] truncate px-2 py-0.5 text-[10px] font-medium normal-case"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--color-secondary) 10%, transparent)",
                color: "var(--color-secondary)",
              }}
              title={session.planTaskTitle}
              aria-label={t("history_plan_task", { title: session.planTaskTitle })}
            >
              {session.planTaskTitle}
            </Chip>
          ) : null}
        </div>
        {session.struggleNote ? (
          <p className="truncate text-xs" style={{ color: "var(--color-secondary)" }}>
            {session.struggleNote}
          </p>
        ) : (
          <p className="text-xs font-medium" style={{ color: "var(--color-secondary)" }}>
            {statusLabel}
          </p>
        )}
      </div>
      <time
        dateTime={session.startedAt}
        className="shrink-0 text-right text-[11px] tabular-nums leading-snug"
        style={{ color: "var(--color-secondary)" }}
      >
        {dateLabel}
        <br />
        {timeLabel}
      </time>
    </li>
  );
}
