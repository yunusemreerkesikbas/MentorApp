"use client";
import { Check, ChevronDown, ListFilter } from "lucide-react";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type {
  ForumFeed,
  ForumFeedItem,
  ForumFeedScope,
  ForumFeedSort,
  ForumTagView,
} from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { MenuSelect, type MenuSelectOption } from "@/components/menu-select";
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu";
import { SegmentPillControl } from "@/components/segment-pill-control";
import { trackCommunityEvent } from "@/lib/analytics";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";
import {
  getForumFeed,
  isForumDisabled,
  listForumTags,
} from "@/lib/forum";
import { DiscoveryFeedCard } from "./discovery-feed-card";
import { PostListSkeleton } from "../../_components/post-skeleton";
import { CommunityTrendRail } from "../../_components/community-trend-rail";
import { GlobalComposer } from "./global-composer";
import {
  toForumFeedContentType,
  type FeedContentFilter,
} from "./feed-content-filter";
import {
  feedQueryToTab,
  feedTabToQuery,
  type FeedTab,
} from "./feed-tab-selection";

type Ready = ForumFeed & { status: "ready"; loadingMore: boolean };
type State =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "error"; message: string }
  | Ready;

type FeedFilterSheetHandle = {
  getValues: () => { tab: FeedTab; tag: string };
};

export function FeedShell() {
  const t = useTranslations("community");
  const searchParams = useSearchParams();
  const { filterSheet } = useMentorBottomSheet();
  const filterFormRef = useRef<FeedFilterSheetHandle>(null);
  const [scope, setScope] = useState<ForumFeedScope>("relevant");
  const [sort, setSort] = useState<ForumFeedSort>("trending");
  const [tag, setTag] = useState(searchParams.get("tag") ?? "");
  const [contentFilter, setContentFilter] = useState<FeedContentFilter>("all");
  const [tags, setTags] = useState<ForumTagView[]>([]);
  const [state, setState] = useState<State>({ status: "loading" });
  const [refreshVersion, setRefreshVersion] = useState(0);
  const queryKey = `${scope}:${sort}:${tag}:${contentFilter}:${refreshVersion}`;
  const activeTab = feedQueryToTab(scope, sort);
  const feedTabs = [
    { id: "featured", label: t("feed_sort_trending") },
    { id: "recent", label: t("feed_sort_recent") },
    { id: "top", label: t("feed_sort_top") },
    { id: "following", label: t("feed_scope_following") },
  ];
  const tabOptions = feedTabs.map(({ id, label }) => ({ value: id, label }));
  const tagOptions = [
    { value: "", label: t("feed_all_tags") },
    ...tags.map((entry) => ({ value: entry.slug, label: `#${entry.slug}` })),
  ];
  const contentFilterItems = [
    { id: "all", label: t("feed_content_all") },
    { id: "posts", label: t("feed_content_posts") },
    { id: "questions", label: t("feed_content_questions") },
  ];

  const load = useCallback(
    (cursor?: string) =>
      getForumFeed({
        scope,
        sort,
        tag: tag || undefined,
        contentType: toForumFeedContentType(contentFilter),
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

  const setTab = (nextTab: string) => {
    const tab = nextTab as FeedTab;
    const { scope: nextScope, sort: nextSort } = feedTabToQuery(tab);
    setState({ status: "loading" });
    setScope(nextScope);
    setSort(nextSort);
    trackCommunityEvent("forum_feed_tab_selected", { sort: nextSort, scope: nextScope });
  };

  const openMobileFilters = async () => {
    await filterSheet({
      title: t("feed_filters"),
      applyLabel: t("feed_apply_filters"),
      children: (
        <FeedFilterSheet
          ref={filterFormRef}
          initialTab={activeTab}
          initialTag={tag}
          tagOptions={tagOptions}
          tabOptions={tabOptions}
        />
      ),
      onApply: () => {
        const values = filterFormRef.current?.getValues();
        if (!values) return;
        const query = feedTabToQuery(values.tab);
        setState({ status: "loading" });
        setScope(query.scope);
        setSort(query.sort);
        setTag(values.tag);
      },
    });
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
        <div className="flex flex-nowrap items-center gap-3 border-b border-[var(--color-border)] pb-4">
          <button
            type="button"
            aria-label={t("feed_filters")}
            onClick={() => void openMobileFilters()}
            className="relative flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-bold text-[var(--color-main)] shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] sm:hidden"
          >
            <ListFilter size={19} aria-hidden />
            {t("feed_filter_button")}
            {tag || (scope === "relevant" ? sort !== "trending" : sort !== "recent") ? (
              <span className="absolute right-2 top-2 size-2 rounded-full bg-[var(--community-blue-ink)]" aria-hidden />
            ) : null}
          </button>
          <div className="hidden sm:block">
            <PopoverMenu
              align="left"
              panelRole="listbox"
              menuClassName="w-56"
              trigger={({ open, setOpen, menuId }) => (
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={open}
                  aria-controls={open ? menuId : undefined}
                  onClick={() => setOpen(!open)}
                  className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-bold text-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                >
                  <ListFilter size={18} aria-hidden />
                  {t("feed_filter_button")}
                  <ChevronDown size={16} aria-hidden className={open ? "rotate-180" : ""} />
                </button>
              )}
            >
              {feedTabs.map((item) => (
                <PopoverMenuItem
                  key={item.id}
                  role="option"
                  selected={item.id === activeTab}
                  onClick={() => setTab(item.id)}
                >
                  <span className="flex items-center justify-between gap-3">
                    {item.label}
                    {item.id === activeTab ? <Check size={17} aria-hidden /> : null}
                  </span>
                </PopoverMenuItem>
              ))}
            </PopoverMenu>
          </div>
          <div className="ml-auto hidden flex-wrap items-center gap-2 sm:flex">
          <MenuSelect
            value={tag}
            onChange={(value) => {
              setState({ status: "loading" });
              setTag(value);
            }}
            aria-label={t("feed_filter_tag")}
            options={tagOptions}
            className="w-52"
            textSize="sm"
          />
          {tag && (
            <button
              type="button"
              onClick={() => {
                setState({ status: "loading" });
                setTag("");
              }}
              className="min-h-11 rounded-xl px-3 text-sm font-bold underline-offset-4 hover:underline"
            >
              {t("feed_clear_filters")}
            </button>
          )}
          </div>
        </div>

        <div className="mt-5 grid w-full grid-cols-[minmax(0,1fr)] items-start justify-center gap-6 xl:grid-cols-[minmax(0,600px)_300px]">
          <section className="w-full min-w-0 max-w-[600px] justify-self-center xl:justify-self-auto" aria-live="polite" aria-busy={state.status === "loading"}>
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
            <div className="mb-3 overflow-x-auto py-1">
              <SegmentPillControl
                items={contentFilterItems}
                value={contentFilter}
                onChange={(value) => {
                  setState({ status: "loading" });
                  setContentFilter(value as FeedContentFilter);
                  trackCommunityEvent("forum_feed_kind_selected", {
                    kind: value as FeedContentFilter,
                  });
                }}
                ariaLabel={t("feed_content_filter_label")}
                layoutId="community-feed-content-pill"
                idPrefix="community-feed-content"
                equalWidth
              />
            </div>
            {state.status === "loading" ? (
              <PostListSkeleton label={t("loading")} variant="card" />
            ) : state.status === "disabled" ? (
              <EmptyState title={t("soon_title")} body={t("soon_desc")} />
            ) : state.status === "error" ? (
              <EmptyState title={t("feed_error_title")} body={state.message}>
                <button
                  type="button"
                  onClick={refetch}
                  className="mt-4 min-h-11 rounded-xl px-4 font-bold text-[var(--color-btn-label)]"
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
                <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
                  {state.items.map((item) => (
                    <DiscoveryFeedCard
                      key={item.id}
                      item={item}
                      onChange={(next) => updateItem(item.id, next)}
                    />
                  ))}
                </div>
                {state.loadingMore ? (
                  <div className="mt-4">
                    <PostListSkeleton label={t("loading")} count={2} variant="card" />
                  </div>
                ) : state.nextCursor ? (
                  <div className="mt-5 flex justify-center">
                    <button
                      type="button"
                      onClick={loadMore}
                      className="min-h-11 rounded-xl border bg-[var(--color-surface)] px-5 font-bold"
                    >
                      {t("load_more")}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>

          <div className="sticky top-20 hidden xl:block">
            <CommunityTrendRail />
          </div>
        </div>
      </div>
    </main>
  );
}

const FeedFilterSheet = forwardRef<
  FeedFilterSheetHandle,
  {
    initialTag: string;
    initialTab: FeedTab;
    tabOptions: MenuSelectOption[];
    tagOptions: MenuSelectOption[];
  }
>(function FeedFilterSheet(
  { initialTab, initialTag, tabOptions, tagOptions },
  ref,
) {
  const t = useTranslations("community");
  const [draftTab, setDraftTab] = useState<FeedTab>(initialTab);
  const [draftTag, setDraftTag] = useState(initialTag);

  useImperativeHandle(ref, () => ({
    getValues: () => ({ tab: draftTab, tag: draftTag }),
  }));

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 text-sm font-bold text-[var(--color-main)]">
        {t("feed_sort_label")}
        <MenuSelect
          value={draftTab}
          onChange={(value) => setDraftTab(value as FeedTab)}
          options={tabOptions}
          aria-label={t("feed_sort_label")}
        />
      </div>
      <div className="grid gap-2 text-sm font-bold text-[var(--color-main)]">
        {t("feed_filter_tag")}
        <MenuSelect
          value={draftTag}
          onChange={setDraftTag}
          options={tagOptions}
          aria-label={t("feed_filter_tag")}
        />
      </div>
      {draftTab !== "featured" || draftTag ? (
        <button
          type="button"
          onClick={() => {
            setDraftTag("");
            setDraftTab("featured");
          }}
          className="min-h-11 justify-self-start px-1 text-sm font-bold text-[var(--community-blue-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          {t("feed_clear_filters")}
        </button>
      ) : null}
    </div>
  );
});

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
    <div className="rounded-2xl border border-dashed bg-[var(--color-surface)] px-6 py-14 text-center">
      <h2 className="text-lg font-extrabold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: "var(--color-secondary)" }}>
        {body}
      </p>
      {children}
    </div>
  );
}
