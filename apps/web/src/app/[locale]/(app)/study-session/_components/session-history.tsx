"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { StudySessionDto } from "@mentor/types";
import { Button } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { listStudySessions } from "@/lib/study-sessions";
import { SessionHistoryRow } from "./session-history-row";

const HISTORY_PAGE_SIZE = 5;

type LoadState = "loading" | "ready" | "error";

/**
 * "Son seanslar" — recent finalized sessions on the /study-session idle screen. Turns the captured
 * session data (subject + effort + duration) into a visible accountability loop (roadmap §255).
 */
export function SessionHistory() {
  const t = useTranslations("session");
  const [sessions, setSessions] = useState<StudySessionDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<LoadState>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await listStudySessions(1, HISTORY_PAGE_SIZE);
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
  }, []);

  const hasMore = sessions.length < total;

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setLoadMoreError(false);
    const nextPage = page + 1;
    try {
      const res = await listStudySessions(nextPage, HISTORY_PAGE_SIZE);
      setSessions((prev) => [...prev, ...res.items]);
      setTotal(res.total);
      setPage(nextPage);
    } catch {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, page]);

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
      <div className="flex items-center justify-between gap-3">
        <h2
          className="text-base font-bold"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {t("history_title")}
        </h2>
        <Link
          href="/study-session/history"
          className="shrink-0 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ color: "var(--color-main)" }}
        >
          {t("history_view_all")}
        </Link>
      </div>
      <ul
        className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_70%,transparent)]"
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
  );
}
