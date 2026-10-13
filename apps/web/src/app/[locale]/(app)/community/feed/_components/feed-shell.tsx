"use client";

import { Info } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ForumFeed, ForumFeedItem, ForumFeedScope, ForumFeedSort, ForumTagView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import {
  PANEL_CARD,
  PANEL_GRID_CLASS,
  PANEL_MAIN_CLASS,
  PANEL_QUIET_LINK,
} from "@/components/panel/panel-styles";
import { trackCommunityEvent } from "@/lib/analytics";
import { getForumFeed, isForumDisabled, listForumTags } from "@/lib/forum";
import { SessionBuddyCard } from "../../../study-session/_components/session-buddy-card";
import { CommunityPresenceCard } from "../../_components/community-presence";
import { CommunityTrendRail } from "../../_components/community-trend-rail";
import { COMMUNITY_CARD_FLUSH } from "../../_components/community-row";
import { PostListSkeleton } from "../../_components/post-skeleton";
import { DiscoveryFeedCard } from "./discovery-feed-card";
import { GlobalComposer } from "./global-composer";
import { readFeedContentFilter, toForumFeedContentQuery, type FeedContentFilter } from "./feed-content-filter";
import { feedQueryToTab, feedTabToQuery, readFeedTab, type FeedTab } from "./feed-tab-selection";
import { FeedToolbar } from "./feed-toolbar";

type Ready = ForumFeed & { status: "ready"; loadingMore: boolean };
type State = { status: "loading" } | { status: "disabled" } | { status: "error"; message: string } | Ready;

/**
 * Akış on the panel frame: controls, the composer, then the posts in one card; the rail holds who is
 * studying now, your buddy and (when there are any) trending tags. A quiet "Öne çıkan" comes back as
 * the newest posts from the server, and the page says so.
 */
export function FeedShell() {
  const t = useTranslations("community");
  const searchParams = useSearchParams();
  const [scope, setScope] = useState<ForumFeedScope>(
    () => feedTabToQuery(readFeedTab(searchParams.get("sort"))).scope,
  );
  const [sort, setSort] = useState<ForumFeedSort>(
    () => feedTabToQuery(readFeedTab(searchParams.get("sort"))).sort,
  );
  const [tag, setTag] = useState(searchParams.get("tag") ?? "");
  const [contentFilter, setContentFilter] = useState<FeedContentFilter>(() =>
    readFeedContentFilter(searchParams.get("content")),
  );
  const [tags, setTags] = useState<ForumTagView[]>([]);
  const [state, setState] = useState<State>({ status: "loading" });
  const [refreshVersion, setRefreshVersion] = useState(0);
  const queryKey = `${scope}:${sort}:${tag}:${contentFilter}:${refreshVersion}`;

  const load = useCallback(
    (cursor?: string) =>
      getForumFeed({
        scope,
        sort,
        tag: tag || undefined,
        ...toForumFeedContentQuery(contentFilter),
        cursor,
      }),
    [scope, sort, tag, contentFilter],
  );

  useEffect(() => {
    listForumTags()
      .then((result) => setTags(result.filter((item) => item.isActive)))
      .catch(() => setTags([]));
  }, []);

  useEffect(() => {
    let active = true;
    load()
      .then((feed) => {
        if (active) setState({ ...feed, status: "ready", loadingMore: false });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (isForumDisabled(error)) setState({ status: "disabled" });
        else setState({ status: "error", message: error instanceof ApiClientError ? error.body.message : t("error") });
      });
    return () => {
      active = false;
    };
  }, [load, queryKey, t]);

  // Re-selecting the current tab, chip or tag leaves the query unchanged, so nothing reloads: the
  // skeleton set here would then stay for good. Only a real change resets the list.
  const setTab = (tab: FeedTab) => {
    const next = feedTabToQuery(tab);
    if (next.scope === scope && next.sort === sort) return;
    setState({ status: "loading" });
    setScope(next.scope);
    setSort(next.sort);
    trackCommunityEvent("forum_feed_tab_selected", { sort: next.sort, scope: next.scope });
  };

  const loadMore = () => {
    if (state.status !== "ready" || !state.nextCursor || state.loadingMore) return;
    const cursor = state.nextCursor;
    setState({ ...state, loadingMore: true });
    load(cursor)
      .then((feed) =>
        setState((current) =>
          current.status === "ready"
            ? { ...current, items: [...current.items, ...feed.items], nextCursor: feed.nextCursor, context: feed.context, loadingMore: false }
            : current,
        ),
      )
      .catch(() => setState((current) => (current.status === "ready" ? { ...current, loadingMore: false } : current)));
  };

  const updateItem = (id: string, next: ForumFeedItem | null) => {
    setState((current) =>
      current.status === "ready"
        ? {
            ...current,
            items: next ? current.items.map((item) => (item.id === id ? next : item)) : current.items.filter((item) => item.id !== id),
          }
        : current,
    );
  };

  // Waiting questions always come newest first (server rule), so that is not a fallback to explain.
  const fellBack =
    state.status === "ready" &&
    sort === "trending" &&
    contentFilter !== "waiting" &&
    state.effectiveSort === "recent" &&
    state.items.length > 0;

  return (
    <main className={PANEL_MAIN_CLASS}>
      <h1 className="sr-only text-display font-extrabold tracking-[-0.01em] text-[var(--color-main)] lg:not-sr-only">
        {t("feed_title")}
      </h1>
      <div className={PANEL_GRID_CLASS}>
        <section className="flex min-w-0 flex-col gap-4" aria-live="polite" aria-busy={state.status === "loading"}>
          <FeedToolbar
            tab={feedQueryToTab(scope, sort)}
            tag={tag}
            tags={tags}
            content={contentFilter}
            onTab={setTab}
            onTag={(next) => {
              if (next === tag) return;
              setState({ status: "loading" });
              setTag(next);
            }}
            onContent={(next) => {
              if (next === contentFilter) return;
              setState({ status: "loading" });
              setContentFilter(next);
              trackCommunityEvent("forum_feed_kind_selected", { kind: next });
            }}
          />
          <GlobalComposer
            onCreated={() => {
              setScope("relevant");
              setSort("recent");
              setTag("");
              setContentFilter("all");
              setState({ status: "loading" });
              setRefreshVersion((current) => current + 1);
            }}
          />
          {fellBack ? (
            <p className="flex items-center gap-2 text-caption font-bold text-[var(--color-secondary)]">
              <Info size={16} className="shrink-0" aria-hidden />
              {t("feed_fallback_recent")}
            </p>
          ) : null}
          {state.status === "loading" ? (
            <PostListSkeleton label={t("loading")} variant="card" />
          ) : state.status === "disabled" ? (
            <FeedNotice title={t("soon_title")} body={t("soon_desc")} />
          ) : state.status === "error" ? (
            <FeedNotice title={t("feed_error_title")} body={state.message}>
              <button
                type="button"
                onClick={() => {
                  setState({ status: "loading" });
                  setRefreshVersion((v) => v + 1);
                }}
                className={PANEL_QUIET_LINK}
              >
                {t("refresh")}
              </button>
            </FeedNotice>
          ) : state.items.length === 0 ? (
            <FeedNotice
              title={contentFilter === "waiting" ? t("feed_waiting_empty_title") : t("feed_empty_title")}
              body={
                contentFilter === "waiting"
                  ? t("feed_waiting_empty")
                  : scope === "following"
                    ? t("following_feed_empty")
                    : t("feed_empty_filtered")
              }
            />
          ) : (
            <>
              <div className={COMMUNITY_CARD_FLUSH}>
                {state.items.map((item) => (
                  <DiscoveryFeedCard key={item.id} item={item} onChange={(next) => updateItem(item.id, next)} />
                ))}
              </div>
              {state.loadingMore ? (
                <PostListSkeleton label={t("loading")} count={2} variant="card" />
              ) : state.nextCursor ? (
                <button type="button" onClick={loadMore} className={`${PANEL_QUIET_LINK} self-center`}>
                  {t("load_more")}
                </button>
              ) : null}
            </>
          )}
        </section>
        <aside className="flex min-w-0 flex-col gap-5" aria-label={t("hub_rail_label")}>
          <CommunityPresenceCard />
          <SessionBuddyCard className={`${PANEL_CARD} flex flex-col gap-3`} partnerOnly />
          <CommunityTrendRail />
        </aside>
      </div>
    </main>
  );
}

function FeedNotice({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className={`${PANEL_CARD} flex flex-col items-center gap-1 px-6 py-10 text-center`}>
      <h2 className="text-base font-extrabold text-[var(--color-main)]">{title}</h2>
      <p className="max-w-md text-body-sm font-semibold text-[var(--color-secondary)]">{body}</p>
      {children}
    </div>
  );
}
