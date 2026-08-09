"use client";

import { useCallback, useEffect, useState } from "react";
import type { ForumTrendsView } from "@mentor/types";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getForumTrends } from "@/lib/forum";
import { TrendTopicList } from "./trend-topic-list";

type RailState =
  | { status: "loading" }
  | { status: "ready"; data: ForumTrendsView }
  | { status: "error" };

export function CommunityTrendRail() {
  const t = useTranslations("community");
  const [state, setState] = useState<RailState>({ status: "loading" });

  const load = useCallback(() => {
    setState({ status: "loading" });
    getForumTrends("relevant", 5)
      .then((data) => setState({ status: "ready", data }))
      .catch(() => setState({ status: "error" }));
  }, []);

  useEffect(() => {
    let active = true;
    getForumTrends("relevant", 5)
      .then((data) => {
        if (active) setState({ status: "ready", data });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <aside className="overflow-hidden rounded-2xl border border-[#dfe3ea] bg-white" aria-labelledby="community-trends-title">
      <h2 id="community-trends-title" className="px-4 pb-3 pt-4 text-xl font-extrabold tracking-[-0.025em] text-[var(--color-main)]">
        {t("trends_title")}
      </h2>

      {state.status === "loading" ? (
        <div className="space-y-4 border-t border-[#e7e9ee] px-4 py-4" aria-label={t("loading")}>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="animate-pulse space-y-2">
              <div className="h-3 w-24 rounded bg-[#eef1f5]" />
              <div className="h-4 w-36 rounded bg-[#e7ebf0]" />
              <div className="h-3 w-16 rounded bg-[#eef1f5]" />
            </div>
          ))}
        </div>
      ) : state.status === "error" ? (
        <div className="border-t border-[#e7e9ee] px-4 py-5">
          <p className="text-sm text-[var(--color-secondary)]">{t("trends_error")}</p>
          <button type="button" onClick={load} className="mt-2 min-h-11 text-sm font-bold text-[var(--community-blue-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">
            {t("refresh")}
          </button>
        </div>
      ) : state.data.items.length === 0 ? (
        <p className="border-t border-[#e7e9ee] px-4 py-6 text-sm text-[var(--color-secondary)]">{t("trends_empty")}</p>
      ) : (
        <TrendTopicList items={state.data.items} />
      )}

      <Link href="/community/trends" className="block min-h-12 border-t border-[#e7e9ee] px-4 py-3 text-sm font-bold text-[var(--community-blue-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]">
        {t("trends_more")}
      </Link>
    </aside>
  );
}
