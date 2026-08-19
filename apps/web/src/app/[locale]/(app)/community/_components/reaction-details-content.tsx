"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  FORUM_REACTION_EMOJIS,
  type ForumReactionEmoji,
  type ReactionUserView,
} from "@mentor/types";
import { listReactionUsers } from "@/lib/forum";
import { AuthorAvatar } from "./author-avatar";
import { AuthorLink } from "./author-link";

const REACTION_PAGE_SIZE = 20;

interface ReactionDetailsContentProps {
  targetType: "THREAD" | "POST";
  targetId: string;
  initialCounts: Record<string, number>;
}

export function ReactionDetailsContent({
  targetType,
  targetId,
  initialCounts,
}: ReactionDetailsContentProps) {
  const t = useTranslations("community");
  const reduceMotion = useReducedMotion();
  const [filter, setFilter] = useState<ForumReactionEmoji | null>(null);
  const [items, setItems] = useState<ReactionUserView[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retryKey, setRetryKey] = useState(0);
  const requestSequence = useRef(0);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    const requestId = ++requestSequence.current;
    void listReactionUsers(targetType, targetId, {
      page: 1,
      pageSize: REACTION_PAGE_SIZE,
      ...(filter ? { emoji: filter } : {}),
    })
      .then((response) => {
        if (requestId !== requestSequence.current) return;
        setItems(response.items);
        setTotal(response.total);
        setPage(response.page);
        setStatus("ready");
      })
      .catch(() => {
        if (requestId !== requestSequence.current) return;
        setStatus("error");
      });
  }, [filter, retryKey, targetId, targetType]);

  const handleLoadMore = async () => {
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    const requestId = ++requestSequence.current;
    setStatus("loading");
    try {
      const response = await listReactionUsers(targetType, targetId, {
        page: page + 1,
        pageSize: REACTION_PAGE_SIZE,
        ...(filter ? { emoji: filter } : {}),
      });
      if (requestId !== requestSequence.current) return;
      setItems((current) => [...current, ...response.items]);
      setTotal(response.total);
      setPage(response.page);
      setStatus("ready");
    } catch {
      if (requestId !== requestSequence.current) return;
      setStatus("error");
    } finally {
      loadingMoreRef.current = false;
    }
  };

  const handleFilter = (nextFilter: ForumReactionEmoji | null) => {
    if (nextFilter === filter) return;
    setItems([]);
    setStatus("loading");
    setFilter(nextFilter);
  };

  const activeFilters = FORUM_REACTION_EMOJIS.filter((emoji) => (initialCounts[emoji] ?? 0) > 0);
  const overallTotal = activeFilters.reduce((sum, emoji) => sum + (initialCounts[emoji] ?? 0), 0);

  return (
    <div className="flex min-h-0 flex-col">
      <div
        role="group"
        aria-label={t("reactions_title")}
        className="mentor-scrollarea flex shrink-0 gap-1 overflow-x-auto border-b"
        style={{ borderColor: "color-mix(in srgb, var(--color-main) 10%, transparent)" }}
      >
        <button
          type="button"
          aria-pressed={filter === null}
          onClick={() => handleFilter(null)}
          className="relative min-h-11 shrink-0 px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{
            color: filter === null ? "var(--color-main)" : "var(--color-secondary)",
          }}
        >
          {t("reactions_all")} {overallTotal}
          {filter === null ? (
            <motion.span
              layoutId={`reaction-filter-indicator-${targetId}`}
              className="absolute inset-x-3 bottom-0 h-0.5 rounded-full"
              style={{ background: "var(--color-main)" }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
              aria-hidden
            />
          ) : null}
        </button>
        {activeFilters.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-pressed={filter === emoji}
            onClick={() => handleFilter(emoji)}
            className="relative flex min-h-11 shrink-0 items-center gap-1.5 px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{
              color: filter === emoji ? "var(--color-main)" : "var(--color-secondary)",
            }}
          >
            <span className="text-lg" aria-hidden>{emoji}</span>
            <span className="tabular-nums">{initialCounts[emoji]}</span>
            {filter === emoji ? (
              <motion.span
                layoutId={`reaction-filter-indicator-${targetId}`}
                className="absolute inset-x-3 bottom-0 h-0.5 rounded-full"
                style={{ background: "var(--color-main)" }}
                transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
                aria-hidden
              />
            ) : null}
          </button>
        ))}
      </div>

      <div
        className="mentor-scrollarea h-72 min-h-0 overflow-y-auto py-2 lg:h-80"
        onScroll={(event) => {
          const viewport = event.currentTarget;
          const nearEnd = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 64;
          if (nearEnd && status === "ready" && items.length < total) {
            void handleLoadMore();
          }
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={filter ?? "all"}
            className="min-h-full"
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
          >
            {status === "loading" && items.length === 0 ? (
              <div role="status" aria-label={t("reactions_loading")} className="grid gap-2">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="flex items-center gap-3 py-2">
                    <span className="mentor-skeleton-shimmer size-10 rounded-full" />
                    <span className="mentor-skeleton-shimmer h-4 w-36 rounded-[var(--radius-card)]" />
                  </div>
                ))}
              </div>
            ) : null}

            {status === "error" && items.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">
                <span
                  className="flex size-11 items-center justify-center rounded-full"
                  style={{ background: "var(--color-surface-container)", color: "var(--color-secondary)" }}
                  aria-hidden
                >
                  <AlertCircle size={20} />
                </span>
                <p className="max-w-64 text-sm leading-6" style={{ color: "var(--color-secondary)" }}>
                  {t("reactions_error")}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStatus("loading");
                    setRetryKey((current) => current + 1);
                  }}
                  className="min-h-11 rounded-[var(--radius-card)] px-5 text-sm font-semibold transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_6%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
                  style={{ background: "var(--color-surface-container)", color: "var(--color-main)" }}
                >
                  {t("refresh")}
                </button>
              </div>
            ) : null}

            {status === "ready" && items.length === 0 ? (
              <p className="py-8 text-center text-sm" style={{ color: "var(--color-secondary)" }}>
                {t("reactions_empty")}
              </p>
            ) : null}

            {items.map((user) => (
              <div key={user.userId} className="flex min-h-14 items-center gap-3 py-2">
                <AuthorLink username={user.username}>
                  <AuthorAvatar name={user.displayName} size={40} src={user.avatarUrl} />
                </AuthorLink>
                <AuthorLink username={user.username} className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold" style={{ color: "var(--color-main)" }}>
                    {user.displayName || t("unknown_author")}
                  </span>
                  {user.username ? (
                    <span className="block truncate text-xs" style={{ color: "var(--color-secondary)" }}>
                      @{user.username}
                    </span>
                  ) : null}
                </AuthorLink>
                <span className="flex size-9 items-center justify-center rounded-full text-lg" style={{ background: "var(--color-soft)" }} aria-label={user.emoji}>
                  {user.emoji}
                </span>
              </div>
            ))}

            {status === "loading" && items.length > 0 ? (
              <p role="status" className="py-3 text-center text-sm" style={{ color: "var(--color-secondary)" }}>
                {t("reactions_loading")}
              </p>
            ) : null}

            {status === "error" && items.length > 0 ? (
              <div className="flex items-center justify-center gap-2 py-3 text-sm">
                <span style={{ color: "var(--color-secondary)" }}>{t("reactions_error")}</span>
                <button
                  type="button"
                  onClick={() => void handleLoadMore()}
                  className="min-h-11 px-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                  style={{ color: "var(--color-main)" }}
                >
                  {t("refresh")}
                </button>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
