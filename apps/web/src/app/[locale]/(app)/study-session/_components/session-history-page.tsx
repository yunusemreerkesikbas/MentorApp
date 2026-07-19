"use client";

import { useCallback, useEffect, useState } from "react";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left.mjs";
import { useTranslations } from "next-intl";
import type { StudySessionDto } from "@mentor/types";
import { Button, Chip, SectionHeading } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import {
  type HistoryDatePreset,
  historyDateRange,
} from "@/lib/history-date-range";
import { listStudySessions } from "@/lib/study-sessions";
import { SessionHistoryRow } from "./session-history-row";

const HISTORY_FULL_PAGE_SIZE = 15;
const SUBJECT_DISCOVERY_PAGE_SIZE = 30;

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
 * Full-page session history at `/study-session/history` — paginated list with optional subject + date filters.
 */
export function SessionHistoryPage() {
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
          HISTORY_FULL_PAGE_SIZE,
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
        HISTORY_FULL_PAGE_SIZE,
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
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-5 py-8">
      <div className="flex flex-col gap-4">
        <Link
          href="/study-session"
          className="inline-flex min-h-[44px] w-fit items-center gap-1 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ color: "var(--color-main)" }}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {t("history_back")}
        </Link>
        <SectionHeading>{t("history_page_title")}</SectionHeading>
      </div>

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t("history_date_filter_label")}
      >
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setDatePreset(preset)}
            aria-pressed={datePreset === preset}
            className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            <Chip
              className="px-3 py-1 text-xs font-semibold uppercase"
              style={
                datePreset === preset
                  ? {
                      backgroundColor: "var(--color-main)",
                      color: "var(--color-surface)",
                    }
                  : undefined
              }
            >
              {t(`history_date_${preset}`)}
            </Chip>
          </button>
        ))}
      </div>

      {filterSubjects.length > 0 ? (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t("history_subject_filter_label")}
        >
          <button
            type="button"
            onClick={() => setSelectedSubject(null)}
            aria-pressed={selectedSubject === null}
            className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            <Chip
              className="px-3 py-1 text-xs font-semibold uppercase"
              style={
                selectedSubject === null
                  ? {
                      backgroundColor: "var(--color-main)",
                      color: "var(--color-surface)",
                    }
                  : undefined
              }
            >
              {t("history_filter_all")}
            </Chip>
          </button>
          {filterSubjects.map((subject) => (
            <button
              key={subject}
              type="button"
              onClick={() => setSelectedSubject(subject)}
              aria-pressed={selectedSubject === subject}
              className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              <Chip
                className="max-w-[9rem] truncate px-3 py-1 text-xs font-semibold uppercase"
                style={
                  selectedSubject === subject
                    ? {
                        backgroundColor: "var(--color-main)",
                        color: "var(--color-surface)",
                      }
                    : undefined
                }
              >
                {subject}
              </Chip>
            </button>
          ))}
        </div>
      ) : null}

      {state === "loading" ? (
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("history_loading")}
        </p>
      ) : null}

      {state === "error" ? (
        <p className="text-sm" style={{ color: "var(--color-secondary)" }} role="status">
          {t("history_error")}
        </p>
      ) : null}

      {state === "ready" && sessions.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {filtersActive ? t("history_empty_filtered") : t("history_empty")}
        </p>
      ) : null}

      {state === "ready" && sessions.length > 0 ? (
        <section className="flex w-full flex-col gap-3">
          <ul
            className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-white bg-white/70"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            {sessions.map((s, i) => {
              const abandoned = s.status === "ABANDONED";
              return (
                <SessionHistoryRow
                  key={s.id}
                  session={s}
                  index={i}
                  minutesLabel={t("minutes_value", {
                    minutes: Math.round(s.actualFocusSeconds / 60),
                  })}
                  statusLabel={abandoned ? t("history_abandoned") : t("history_completed")}
                />
              );
            })}
          </ul>
          {loadMoreError ? (
            <p className="text-sm" style={{ color: "var(--color-secondary)" }} role="status">
              {t("history_load_more_error")}
            </p>
          ) : null}
          {hasMore ? (
            <Button variant="secondary" fullWidth busy={loadingMore} onClick={() => void loadMore()}>
              {t("history_load_more")}
            </Button>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
