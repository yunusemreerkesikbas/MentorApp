"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ForumTrendScope, ForumTrendsView } from "@mentor/types";
import { useTranslations } from "next-intl";
import { getForumTrends } from "@/lib/forum";
import { TrendTopicList } from "../../_components/trend-topic-list";
import { TabContentSkeleton } from "../../_components/tab-content-skeleton";

type State =
  | { status: "loading"; examType: string | null }
  | { status: "ready"; data: ForumTrendsView }
  | { status: "error"; examType: string | null };

export function TrendsShell() {
  const t = useTranslations("community");
  const reduceMotion = useReducedMotion();
  const [scope, setScope] = useState<ForumTrendScope>("relevant");
  const [state, setState] = useState<State>({ status: "loading", examType: null });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    getForumTrends(scope, 30)
      .then((data) => {
        if (active) setState({ status: "ready", data });
      })
      .catch(() => {
        if (active) {
          setState((current) => ({
            status: "error",
            examType: current.status === "ready" ? current.data.examType : current.examType,
          }));
        }
      });
    return () => {
      active = false;
    };
  }, [retryKey, scope]);

  const selectScope = useCallback((nextScope: ForumTrendScope) => {
    setState((current) => ({
      status: "loading",
      examType: current.status === "ready" ? current.data.examType : current.examType,
    }));
    setScope(nextScope);
  }, []);

  const examType = state.status === "ready" ? state.data.examType : state.examType;
  const tabs: Array<{ scope: ForumTrendScope; label: string }> = [
    { scope: "relevant", label: t("trends_explore") },
    ...(examType ? [{ scope: "exam" as const, label: t("trends_exam") }] : []),
    { scope: "general", label: t("trends_general") },
  ];

  return (
    <main className="mx-auto min-w-0 max-w-[600px] bg-white sm:my-6 sm:border-x sm:border-[#e7e9ee]">
      <header className="border-b border-[#e7e9ee] px-4 pb-4 pt-5">
        <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-[var(--color-main)]">{t("trends_title")}</h1>
        <p className="mt-1 text-sm text-[var(--color-secondary)]">{t("trends_subtitle")}</p>
      </header>

      <div className={`grid border-b border-[#e7e9ee] ${tabs.length === 3 ? "grid-cols-3" : "grid-cols-2"}`} role="tablist" aria-label={t("trends_title")}>
        {tabs.map((tab) => {
          const active = scope === tab.scope;
          return (
            <button key={tab.scope} type="button" role="tab" aria-selected={active} onClick={() => selectScope(tab.scope)} className="relative min-h-14 px-3 text-sm font-bold text-[var(--color-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]">
              <span className={active ? "text-[var(--color-main)]" : undefined}>{tab.label}</span>
              {active ? (
                <motion.span
                  layoutId="community-trends-tab-indicator"
                  className="absolute inset-x-6 bottom-0 h-1 rounded-full bg-[var(--community-blue-ink)]"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 29 }}
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={scope}
        initial={reduceMotion ? false : { opacity: 0, x: 36, scale: 0.985 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -26, scale: 0.99 }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 370, damping: 30 }}
      >
      {state.status === "loading" ? (
        <TabContentSkeleton label={t("loading")} variant="trends" />
      ) : state.status === "error" ? (
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-[var(--color-secondary)]">{t("trends_error")}</p>
          <button type="button" onClick={() => {
            setState({ status: "loading", examType });
            setRetryKey((key) => key + 1);
          }} className="mt-2 min-h-11 text-sm font-bold text-[var(--community-blue-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">{t("refresh")}</button>
        </div>
      ) : state.data.items.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-[var(--color-secondary)]">{t("trends_empty")}</p>
      ) : (
        <TrendTopicList items={state.data.items} />
      )}
      </motion.div>
      </AnimatePresence>
    </main>
  );
}
