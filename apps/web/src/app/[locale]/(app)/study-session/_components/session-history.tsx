"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { StudySessionDto } from "@mentor/types";
import { Skeleton, skeletonStaggerStyle } from "@mentor/ui";
import {
  type HistoryDatePreset,
  historyDateRange,
} from "@/lib/history-date-range";
import { listStudySessions } from "@/lib/study-sessions";
import { HistoryFilterSelect } from "@/components/history-side-panel";
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

/** "Bugün" / "Dün" / "28 Ağustos" — a heading, so the year is noise until it is not today. */
function dayLabel(
  dayKey: string,
  locale: string,
  t: (key: string) => string,
): string {
  const day = new Date(dayKey);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (day.toDateString() === today.toDateString()) return t("history_date_today");
  if (day.toDateString() === yesterday.toDateString()) return t("history_day_yesterday");
  return day.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    // A session from last year would otherwise read as this year's same date.
    ...(day.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }),
  });
}

/**
 * Sessions bucketed by the day they started, newest day first.
 *
 * The rail used to repeat the date on every row, which made four half-finished 0-minute
 * sessions from the same afternoon look like four copies of one row. The date belongs to the
 * day, not to each attempt — hoisting it frees the row to show the time instead, which is the
 * thing that actually tells them apart.
 *
 * Bucketed by LOCAL calendar day (`toDateString`), not by a UTC slice: a 01:30 session is
 * still last night to the person who sat through it.
 */
function groupByDay(items: StudySessionDto[]): { key: string; items: StudySessionDto[] }[] {
  const groups: { key: string; items: StudySessionDto[] }[] = [];
  for (const item of items) {
    const key = new Date(item.startedAt).toDateString();
    const last = groups[groups.length - 1];
    // The API already returns newest-first, so a run of the same day is always contiguous.
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  }
  return groups;
}

/**
 * Finalized sessions for the /study-session history rail / drawer.
 * Pagination and date/subject filters stay inside the sidebar — there is no history page.
 */
export function SessionHistory() {
  const t = useTranslations("session");
  const locale = useLocale();
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
      {/*
        Two native selects instead of two wrapping chip rows. In a 288px rail the chips took
        four lines before a single session was visible — the filters were bigger than the
        thing being filtered. A `<select>` is one line, opens the platform's own picker
        (already keyboard- and screen-reader-correct, and a proper sheet on a phone), and
        grows for free as subjects accumulate, which is exactly where the chip row got worse.
      */}
      <div className="flex gap-1.5">
        <HistoryFilterSelect
          label={t("history_date_filter_label")}
          value={datePreset}
          onChange={(value) => setDatePreset(value as HistoryDatePreset)}
          options={DATE_PRESETS.map((preset) => ({
            value: preset,
            label: t(`history_date_${preset}`),
          }))}
          testId="history-filter-date"
        />
        {filterSubjects.length > 0 ? (
          <HistoryFilterSelect
            label={t("history_subject_filter_label")}
            value={selectedSubject ?? ""}
            onChange={(value) => setSelectedSubject(value === "" ? null : value)}
            options={[
              { value: "", label: t("history_filter_all") },
              ...filterSubjects.map((subject) => ({ value: subject, label: subject })),
            ]}
            testId="history-filter-subject"
          />
        ) : null}
      </div>

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
          <div className="flex flex-col gap-3">
            {groupByDay(sessions).map((group) => (
              <section key={group.key} className="flex flex-col gap-0.5">
                <h3
                  className="px-2.5 pb-0.5 text-[11px] font-bold uppercase tracking-wide"
                  style={{ color: "var(--color-secondary)", fontFamily: "var(--font-heading)" }}
                >
                  {dayLabel(group.key, locale, t)}
                </h3>
                <ul className="flex flex-col gap-0.5">
                  {group.items.map((s, i) => {
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
                        statusLabel={
                          abandoned ? t("history_abandoned") : t("history_completed")
                        }
                      />
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
          {loadMoreError ? (
            <p className="px-1 text-sm" style={{ color: "var(--color-secondary)" }} role="status">
              {t("history_load_more_error")}
            </p>
          ) : null}
          {/* A quiet continuation of the list, not a call to action. A full-width filled
              button at the bottom of a sidebar competes with "Başla" across the page for the
              same attention, and this only reveals eight more rows. */}
          {hasMore ? (
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void loadMore()}
              className="mt-1 inline-flex min-h-9 cursor-pointer items-center justify-center gap-1 self-center rounded-full px-3 text-xs font-bold transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--color-main)_6%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-50 motion-reduce:transition-none"
              style={{ color: "var(--color-secondary)" }}
            >
              {t("history_load_more")}
              <ChevronDown
                className={`size-4 ${loadingMore ? "animate-pulse" : ""}`}
                strokeWidth={2.5}
                aria-hidden
              />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

