"use client";
import { Rss } from "lucide-react";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type {
  ForumFeed,
  ForumFeedItem,
  ForumFeedScope,
  ForumFeedSort,
  ForumSearchView,
  ForumTagView,
} from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Link } from "@/i18n/navigation";
import { trackCommunityEvent } from "@/lib/analytics";
import {
  getForumFeed,
  isForumDisabled,
  listForumTags,
  searchForum,
} from "@/lib/forum";
import { DiscoveryFeedCard } from "./discovery-feed-card";
import { GlobalComposer } from "./global-composer";

type Ready = ForumFeed & { status: "ready"; loadingMore: boolean };
type State =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "error"; message: string }
  | Ready;

const SORTS: ForumFeedSort[] = ["trending", "recent", "top"];
const SCOPES: ForumFeedScope[] = ["relevant", "following"];

export function FeedShell() {
  const t = useTranslations("community");
  const searchParams = useSearchParams();
  const filterDialogRef = useRef<HTMLDialogElement>(null);
  const [scope, setScope] = useState<ForumFeedScope>("relevant");
  const [sort, setSort] = useState<ForumFeedSort>("trending");
  const [tag, setTag] = useState(searchParams.get("tag") ?? "");
  const [zoneType, setZoneType] = useState("");
  const [tags, setTags] = useState<ForumTagView[]>([]);
  const [state, setState] = useState<State>({ status: "loading" });
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [searchResult, setSearchResult] = useState<ForumSearchView | null>(null);
  const [searching, setSearching] = useState(false);
  const queryKey = `${scope}:${sort}:${tag}:${zoneType}`;

  const load = useCallback(
    (cursor?: string) =>
      getForumFeed({
        scope,
        sort,
        tag: tag || undefined,
        zoneType: zoneType || undefined,
        cursor,
      }),
    [scope, sort, tag, zoneType],
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
        else {
          setState({
            status: "error",
            message: error instanceof ApiClientError ? error.body.message : t("error"),
          });
        }
      });
    return () => {
      active = false;
    };
  }, [load, queryKey, t]);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) return;
    let active = true;
    const timer = window.setTimeout(() => {
      searchForum(q)
        .then((result) => active && setSearchResult(result))
        .catch(() => active && setSearchResult({ threads: [], tags: [], people: [] }))
        .finally(() => active && setSearching(false));
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search]);

  const setTab = (nextSort: ForumFeedSort) => {
    setState({ status: "loading" });
    setSort(nextSort);
    trackCommunityEvent("forum_feed_tab_selected", { sort: nextSort, scope });
  };

  const setFeedScope = (nextScope: ForumFeedScope) => {
    setState({ status: "loading" });
    setScope(nextScope);
    trackCommunityEvent("forum_feed_tab_selected", { sort, scope: nextScope });
  };

  const refetch = () => {
    setState({ status: "loading" });
    load()
      .then((feed) => setState({ ...feed, status: "ready", loadingMore: false }))
      .catch(() => setState({ status: "error", message: t("error") }));
  };

  const loadMore = () => {
    if (state.status !== "ready" || !state.nextCursor || state.loadingMore) return;
    const cursor = state.nextCursor;
    setState({ ...state, loadingMore: true });
    load(cursor)
      .then((feed) =>
        setState((current) =>
          current.status === "ready"
            ? {
                ...current,
                items: [...current.items, ...feed.items],
                nextCursor: feed.nextCursor,
                context: feed.context,
                loadingMore: false,
              }
            : current,
        ),
      )
      .catch(() =>
        setState((current) =>
          current.status === "ready" ? { ...current, loadingMore: false } : current,
        ),
      );
  };

  const updateItem = (id: string, next: ForumFeedItem | null) => {
    setState((current) =>
      current.status === "ready"
        ? {
            ...current,
            items: next
              ? current.items.map((item) => (item.id === id ? next : item))
              : current.items.filter((item) => item.id !== id),
          }
        : current,
    );
  };

  return (
    <main className="min-w-0 px-4 py-7 sm:px-7 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1180px]">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-[30px] font-extrabold tracking-[-0.03em] text-[#111318] sm:text-[34px]">
              <span className="grid size-10 place-items-center rounded-[10px] bg-[var(--community-blue-soft)] text-[var(--community-blue-ink)]" aria-hidden><Rss size={19} /></span>
              {t("feed_title")}
            </h1>
          </div>
        </header>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-[11px] bg-[#f0f1f4] p-1" role="tablist" aria-label={t("feed_sort_label")}>
            {SORTS.map((entry) => (
              <button
                key={entry}
                type="button"
                role="tab"
                aria-selected={sort === entry}
                onClick={() => setTab(entry)}
                className={`min-h-11 flex-none rounded-[9px] px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${sort === entry ? "bg-[var(--community-blue)] text-[#111318]" : "text-[#4f5561] hover:bg-white"}`}
              >
                {t(`feed_sort_${entry}`)}
              </button>
            ))}
          </div>

          <div className="relative min-w-[210px] flex-1">
            <label className="sr-only" htmlFor="forum-search">{t("global_search_placeholder")}</label>
            <input
              id="forum-search"
              type="search"
              value={search}
              onChange={(event) => {
                const nextSearch = event.target.value;
                setSearch(nextSearch);
                if (nextSearch.trim().length < 2) {
                  setSearchResult(null);
                  setSearching(false);
                } else {
                  setSearching(true);
                }
              }}
              placeholder={t("feed_filters")}
              className="min-h-11 w-full rounded-[10px] border border-[#e4e6eb] bg-white px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            />
            {(searching || searchResult) && search.trim().length >= 2 && (
              <SearchPopover
                result={searchResult}
                searching={searching}
                onSelectTag={(slug) => {
                  setState({ status: "loading" });
                  setTag(slug);
                  setSearch("");
                  setSearchResult(null);
                }}
              />
            )}
          </div>
          <GlobalComposer onCreated={refetch} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-[#e7e9ee] pb-4">
          <div className="flex rounded-[10px] bg-[#edeff2] p-1" aria-label={t("feed_scope_label")}>
            {SCOPES.map((entry) => (
              <button
                key={entry}
                type="button"
                aria-pressed={scope === entry}
                onClick={() => setFeedScope(entry)}
                className={`min-h-11 rounded-[8px] px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${scope === entry ? "bg-white text-[var(--community-blue-ink)]" : "text-[#6f7580] hover:text-[#343945]"}`}
              >
                {t(`feed_scope_${entry}`)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => filterDialogRef.current?.showModal()}
            className="min-h-11 rounded-[10px] border border-[#e0e3e8] bg-white px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] sm:hidden"
          >
            {t("feed_filters")}
            {(tag || zoneType) && " · 1+"}
          </button>
          <dialog
            ref={filterDialogRef}
            aria-labelledby="forum-filter-title"
            onCancel={(event) => {
              event.preventDefault();
              filterDialogRef.current?.close();
            }}
            onClick={(event) => {
              if (event.target === filterDialogRef.current) filterDialogRef.current?.close();
            }}
            className="mb-0 mt-auto w-full max-w-none rounded-t-2xl border bg-white p-0 shadow-2xl backdrop:bg-black/35 sm:hidden"
          >
            <form method="dialog" className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 id="forum-filter-title" className="text-lg font-extrabold">
                  {t("feed_filters")}
                </h2>
                <button
                  type="submit"
                  aria-label={t("close")}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                >
                  ×
                </button>
              </div>
              <label className="block text-sm font-bold">
                {t("feed_filter_tag")}
                <select
                  value={tag}
                  onChange={(event) => {
                    setState({ status: "loading" });
                    setTag(event.target.value);
                  }}
                  className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                >
                  <option value="">{t("feed_all_tags")}</option>
                  {tags.map((entry) => (
                    <option key={entry.id} value={entry.slug}>
                      #{entry.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-bold">
                {t("feed_filter_zone_type")}
                <select
                  value={zoneType}
                  onChange={(event) => {
                    setState({ status: "loading" });
                    setZoneType(event.target.value);
                  }}
                  className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                >
                  <option value="">{t("feed_all_zone_types")}</option>
                  <option value="CHAT">{t("type_chat")}</option>
                  <option value="QA">{t("type_qa")}</option>
                  <option value="ANNOUNCEMENT">{t("type_announcement")}</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setState({ status: "loading" });
                    setTag("");
                    setZoneType("");
                  }}
                  className="min-h-11 rounded-xl border bg-white px-3 text-sm font-bold"
                >
                  {t("feed_clear_filters")}
                </button>
                <button
                  type="submit"
                  className="min-h-11 rounded-xl px-3 text-sm font-bold text-white"
                  style={{ background: "var(--color-btn)" }}
                >
                  {t("feed_apply_filters")}
                </button>
              </div>
            </form>
          </dialog>
          <div className="hidden flex-wrap items-center gap-2 sm:flex">
          <select
            value={tag}
            onChange={(event) => {
              setState({ status: "loading" });
              setTag(event.target.value);
            }}
            aria-label={t("feed_filter_tag")}
            className="min-h-11 rounded-[10px] border border-[#e0e3e8] bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            <option value="">{t("feed_all_tags")}</option>
            {tags.map((entry) => (
              <option key={entry.id} value={entry.slug}>
                #{entry.name}
              </option>
            ))}
          </select>
          <select
            value={zoneType}
            onChange={(event) => {
              setState({ status: "loading" });
              setZoneType(event.target.value);
            }}
            aria-label={t("feed_filter_zone_type")}
            className="min-h-11 rounded-[10px] border border-[#e0e3e8] bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            <option value="">{t("feed_all_zone_types")}</option>
            <option value="CHAT">{t("type_chat")}</option>
            <option value="QA">{t("type_qa")}</option>
            <option value="ANNOUNCEMENT">{t("type_announcement")}</option>
          </select>
          {(tag || zoneType) && (
            <button
              type="button"
              onClick={() => {
                setState({ status: "loading" });
                setTag("");
                setZoneType("");
              }}
              className="min-h-11 rounded-xl px-3 text-sm font-bold underline-offset-4 hover:underline"
            >
              {t("feed_clear_filters")}
            </button>
          )}
          </div>
        </div>

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_304px]">
          <section aria-live="polite" aria-busy={state.status === "loading"}>
            {state.status === "loading" ? (
              <FeedSkeleton label={t("loading")} />
            ) : state.status === "disabled" ? (
              <EmptyState title={t("soon_title")} body={t("soon_desc")} />
            ) : state.status === "error" ? (
              <EmptyState title={t("feed_error_title")} body={state.message}>
                <button
                  type="button"
                  onClick={refetch}
                  className="mt-4 min-h-11 rounded-xl px-4 font-bold text-white"
                  style={{ background: "var(--color-btn)" }}
                >
                  {t("refresh")}
                </button>
              </EmptyState>
            ) : state.items.length === 0 ? (
              <EmptyState
                title={t("feed_empty_title")}
                body={
                  scope === "following"
                    ? t("following_feed_empty")
                    : t("feed_empty_filtered")
                }
              />
            ) : (
              <>
                <div className="grid gap-4">
                  {state.items.map((item) => (
                    <DiscoveryFeedCard
                      key={item.id}
                      item={item}
                      onChange={(next) => updateItem(item.id, next)}
                    />
                  ))}
                </div>
                {state.nextCursor && (
                  <div className="mt-5 flex justify-center">
                    <button
                      type="button"
                      disabled={state.loadingMore}
                      onClick={loadMore}
                      className="min-h-11 rounded-xl border bg-white px-5 font-bold disabled:opacity-50"
                    >
                      {state.loadingMore ? t("loading") : t("load_more")}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          {state.status === "ready" && (
            <aside className="hidden space-y-7 border-l border-[#e7e9ee] pl-5 xl:block" aria-label={t("feed_context_title")}>
              <ContextSection title={t("feed_active_threads")} items={state.context.activeThreads} />
              <ContextSection title={t("feed_suggested_threads")} items={state.context.suggestedThreads} />
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}

function ContextSection({
  title,
  items,
}: {
  title: string;
  items: Ready["context"]["activeThreads"];
}) {
  const t = useTranslations("community");
  if (!items.length) return null;
  return (
    <section>
      <h2 className="text-[13px] font-extrabold text-[#4c535f]">{title}</h2>
      <div className="mt-3 grid gap-3">
        {items.map((item) => {
          const href =
            item.zoneType === "QA"
              ? ({ pathname: "/community/question/[threadId]", params: { threadId: item.id } } as const)
              : ({ pathname: "/community/message/[threadId]", params: { threadId: item.id } } as const);
          return (
            <Link
              key={item.id}
              href={href}
              className="block min-h-[92px] rounded-[13px] border border-[#e7e9ee] bg-white p-4 transition-colors hover:border-[var(--community-blue-border)] hover:bg-[var(--community-blue-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              <div className="line-clamp-2 text-[13px] font-bold leading-[1.35] text-[#252933]">{item.title ?? item.bodyExcerpt}</div>
              <div className="mt-3 text-[11px] text-[#7b808a]">
                {item.zoneTitle} · {t("comment_total", { count: item.commentCount })}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function SearchPopover({
  result,
  searching,
  onSelectTag,
}: {
  result: ForumSearchView | null;
  searching: boolean;
  onSelectTag: (slug: string) => void;
}) {
  const t = useTranslations("community");
  const empty =
    result &&
    result.threads.length === 0 &&
    result.tags.length === 0 &&
    result.people.length === 0;
  return (
    <div className="absolute inset-x-0 z-30 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border bg-white p-3 shadow-xl">
      {searching && !result ? (
        <p className="p-3 text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("loading")}
        </p>
      ) : empty ? (
        <p className="p-3 text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("search_no_results_global")}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {result?.threads.length ? (
            <SearchGroup title={t("search_threads")}>
              {result.threads.map((thread) => {
                const href =
                  thread.zoneType === "QA"
                    ? ({ pathname: "/community/question/[threadId]", params: { threadId: thread.id } } as const)
                    : ({ pathname: "/community/message/[threadId]", params: { threadId: thread.id } } as const);
                return (
                  <Link key={thread.id} href={href} className="block min-h-11 rounded-lg p-2 text-sm hover:bg-black/[0.04]">
                    <span className="line-clamp-2 font-bold">{thread.title ?? thread.bodyExcerpt}</span>
                    <span className="mt-1 block text-xs" style={{ color: "var(--color-secondary)" }}>
                      {thread.zoneTitle}
                    </span>
                  </Link>
                );
              })}
            </SearchGroup>
          ) : null}
          {result?.tags.length ? (
            <SearchGroup title={t("search_tags")}>
              {result.tags.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onSelectTag(entry.slug)}
                  className="block min-h-11 w-full rounded-lg p-2 text-left text-sm font-bold hover:bg-black/[0.04]"
                >
                  #{entry.name}
                </button>
              ))}
            </SearchGroup>
          ) : null}
          {result?.people.length ? (
            <SearchGroup title={t("search_people")}>
              {result.people.map((person) => (
                <Link
                  key={person.id}
                  href={{
                    pathname: "/community/member/[username]",
                    params: { username: person.username },
                  }}
                  className="block min-h-11 rounded-lg p-2 text-sm hover:bg-black/[0.04]"
                >
                  <span className="font-bold">{person.displayName}</span>
                  <span className="ml-1" style={{ color: "var(--color-secondary)" }}>
                    @{person.username}
                  </span>
                </Link>
              ))}
            </SearchGroup>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SearchGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="px-2 text-xs font-bold text-[#656c78]">
        {title}
      </h2>
      <div className="mt-1">{children}</div>
    </section>
  );
}

function EmptyState({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed bg-white px-6 py-14 text-center">
      <h2 className="text-lg font-extrabold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: "var(--color-secondary)" }}>
        {body}
      </p>
      {children}
    </div>
  );
}

function FeedSkeleton({ label }: { label: string }) {
  return (
    <div className="grid animate-pulse gap-4" aria-label={label}>
      {[0, 1, 2].map((entry) => (
        <div key={entry} className="h-64 rounded-2xl bg-black/[0.05]" />
      ))}
    </div>
  );
}
