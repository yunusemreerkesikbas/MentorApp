"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { StudySessionDto } from "@mentor/types";
import { Chip } from "@mentor/ui";
import { listStudySessions } from "@/lib/study-sessions";

/** Effort/mood glyphs matching the post-session check-in (1-3 -> 😩😐🙂). */
const EFFORT_EMOJI: Record<number, string> = { 1: "😩", 2: "😐", 3: "🙂" };

type LoadState = "loading" | "ready" | "error";

/**
 * "Son seanslar" — recent finalized sessions on the /seans idle screen. Turns the captured
 * session data (subject + effort + duration) into a visible accountability loop (roadmap §255).
 */
export function SessionHistory() {
  const t = useTranslations("session");
  const locale = useLocale();
  const [sessions, setSessions] = useState<StudySessionDto[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await listStudySessions(1, 5);
        if (!active) return;
        setSessions(res.items);
        setState("ready");
      } catch {
        if (!active) return;
        setState("error");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  if (state === "loading") return null;

  if (state === "error") {
    return (
      <p className="text-sm" style={{ color: "var(--color-secondary)" }} role="status">
        {t("history_error")}
      </p>
    );
  }

  if (sessions.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("history_empty")}
      </p>
    );
  }

  return (
    <section className="flex w-full flex-col gap-3">
      <h2
        className="text-base font-bold"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        {t("history_title")}
      </h2>
      <ul
        className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-white bg-white/70"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        {sessions.map((s, i) => {
          const minutes = Math.round(s.actualFocusSeconds / 60);
          const started = new Date(s.startedAt);
          const dateLabel = started.toLocaleDateString(locale, {
            day: "2-digit",
            month: "short",
          });
          const timeLabel = started.toLocaleTimeString(locale, {
            hour: "2-digit",
            minute: "2-digit",
          });
          const emoji = s.sessionMood ? EFFORT_EMOJI[s.sessionMood] : null;
          const abandoned = s.status === "ABANDONED";
          const statusLabel = abandoned
            ? t("history_abandoned")
            : t("history_completed");
          return (
            <li
              key={s.id}
              className="flex items-center gap-3 px-4 py-3.5"
              style={
                i > 0
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
                  color: abandoned
                    ? "var(--color-secondary)"
                    : "var(--color-main)",
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
                    {t("minutes_value", { minutes })}
                  </span>
                  {s.subject && (
                    <Chip className="max-w-[9rem] truncate px-2 py-0.5 text-[10px] font-bold uppercase">
                      {s.subject}
                    </Chip>
                  )}
                </div>
                {s.struggleNote ? (
                  <p
                    className="truncate text-xs"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    {s.struggleNote}
                  </p>
                ) : (
                  <p
                    className="text-xs font-medium"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    {statusLabel}
                  </p>
                )}
              </div>
              <time
                dateTime={s.startedAt}
                className="shrink-0 text-right text-[11px] tabular-nums leading-snug"
                style={{ color: "var(--color-secondary)" }}
              >
                {dateLabel}
                <br />
                {timeLabel}
              </time>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
