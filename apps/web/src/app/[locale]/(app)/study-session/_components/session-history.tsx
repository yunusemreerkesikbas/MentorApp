"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { StudySessionDto } from "@mentor/types";
import { Button, Skeleton, skeletonStaggerStyle } from "@mentor/ui";
import {
  type HistoryDatePreset,
  historyDateRange,
} from "@/lib/history-date-range";
import { listStudySessions } from "@/lib/study-sessions";
import { SessionHistoryRow } from "./session-history-row";

const HISTORY_PAGE_SIZE = 8;
const SUBJECT_DISCOVERY_PAGE_SIZE = 30;
const SKELETON_ROWS = 6;

const DATE_PRESETS: HistoryDatePreset[] = ["all", "today", "7d", "30d"];

type LoadState = "loading" | "ready" | "error";

function distinctSubjects(items: StudySessionDto[]): string[] {
  const subjects: string[] = [];
  for (const item of items) {
    const subject = item.subject?.trim();
    if (subject && !subjects.includes(subject)) {
      subjects.push(subject);
    }
  }
  return subjects;
}

/**
 * Finalized sessions for the /study-session history rail / drawer.
 * Pagination and date/subject filters stay inside the sidebar — there is no history page.
 */
export function SessionHistory() {
  const t = useTranslations("session");
  const [sessions, setSessions] = useState<StudySessionDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<HistoryDatePreset>("all");
  const [filterSubjects, setFilterSubjects] = useState<string[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadSubjects() {
      try {
        const res = await listStudySessions(1, SUBJECT_DISCOVERY_PAGE_SIZE);
        if (!active) return;
        setFilterSubjects(distinctSubjects(res.items));
      } catch {
        // Filter chips are optional — list still works without them.
      }
    }
    void loadSubjects();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setState("loading");
      try {
        const { from, to } = historyDateRange(datePreset);
        const res = await listStudySessions(
          1,
          HISTORY_PAGE_SIZE,
          selectedSubject ?? undefined,
          from,
          to,
        );
        if (!active) return;
        setSessions(res.items);
        setTotal(res.total);
        setPage(1);
        setLoadMoreError(false);
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
  }, [selectedSubject, datePreset]);

  const hasMore = sessions.length < total;
  const filtersActive = selectedSubject != null || datePreset !== "all";

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setLoadMoreError(false);
    const nextPage = page + 1;
    try {
      const { from, to } = historyDateRange(datePreset);
      const res = await listStudySessions(
        nextPage,
        HISTORY_PAGE_SIZE,
        selectedSubject ?? undefined,
        from,
        to,
      );
      setSessions((prev) => [...prev, ...res.items]);
      setTotal(res.total);
      setPage(nextPage);
    } catch {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [datePreset, hasMore, loadingMore, page, selectedSubject]);

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label={t("history_date_filter_label")}
      >
        {DATE_PRESETS.map((preset) => (
          <FilterChip
            key={preset}
            pressed={datePreset === preset}
            onClick={() => setDatePreset(preset)}
            label={t(`history_date_${preset}`)}
          />
        ))}
      </div>

      {filterSubjects.length > 0 ? (
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label={t("history_subject_filter_label")}
        >
          <FilterChip
            pressed={selectedSubject === null}
            onClick={() => setSelectedSubject(null)}
            label={t("history_filter_all")}
          />
          {filterSubjects.map((subject) => (
            <FilterChip
              key={subject}
              pressed={selectedSubject === subject}
              onClick={() => setSelectedSubject(subject)}
              label={subject}
              truncate
            />
          ))}
        </div>
      ) : null}

      {state === "loading" ? (
        <div className="flex flex-col gap-0.5" aria-hidden>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div
              key={index}
              className="grid min-h-10 grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-2 px-2.5 py-2"
              style={skeletonStaggerStyle(index)}
            >
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-24 rounded-[var(--radius-card)]" />
                <Skeleton className="h-3 w-16 rounded-[var(--radius-card)]" />
              </div>
              <Skeleton className="h-3 w-12 justify-self-end rounded-[var(--radius-card)]" />
            </div>
          ))}
        </div>
      ) : null}

      {state === "error" ? (
        <p className="px-1 py-2 text-sm" style={{ color: "var(--color-secondary)" }} role="status">
          {t("history_error")}
        </p>
      ) : null}

      {state === "ready" && sessions.length === 0 ? (
        <p className="px-1 py-2 text-sm" style={{ color: "var(--color-secondary)" }}>
          {filtersActive ? t("history_empty_filtered") : t("history_empty")}
        </p>
      ) : null}

      {state === "ready" && sessions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-0.5">
            {sessions.map((s, i) => {
              const abandoned = s.status === "ABANDONED";
              return (
                <SessionHistoryRow
                  key={s.id}
                  session={s}
                  index={i}
                  compact
                  minutesLabel={t("minutes_value", {
                    minutes: Math.round(s.actualFocusSeconds / 60),
                  })}
                  statusLabel={abandoned ? t("history_abandoned") : t("history_completed")}
                />
              );
            })}
          </ul>
          {loadMoreError ? (
            <p className="px-1 text-sm" style={{ color: "var(--color-secondary)" }} role="status">
              {t("history_load_more_error")}
            </p>
          ) : null}
          {hasMore ? (
            <Button variant="secondary" fullWidth busy={loadingMore} onClick={() => void loadMore()}>
              {t("history_load_more")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FilterChip({
  pressed,
  onClick,
  label,
  truncate = false,
}: {
  pressed: boolean;
  onClick: () => void;
  label: string;
  truncate?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`cursor-pointer rounded-[var(--radius-card)] border px-2.5 py-1 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${truncate ? "max-w-[7.5rem] truncate" : ""}`}
      style={{
        backgroundColor: pressed
          ? "var(--color-main)"
          : "color-mix(in srgb, var(--color-chip) 30%, transparent)",
        color: pressed ? "var(--color-surface)" : "var(--color-chip-text)",
        borderColor: pressed
          ? "var(--color-main)"
          : "color-mix(in srgb, var(--color-chip-text) 18%, transparent)",
        fontFamily: "var(--font-body)",
      }}
    >
      {label}
    </button>
  );
}
