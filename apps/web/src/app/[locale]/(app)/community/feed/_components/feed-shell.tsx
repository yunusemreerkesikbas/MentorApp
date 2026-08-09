"use client";
import { ListFilter } from "lucide-react";

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

type Ready = ForumFeed & { status: "ready"; loadingMore: boolean };
type State =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "error"; message: string }
  | Ready;

type FeedTab = "featured" | "recent" | "top" | "following";
type FeedFilterSheetHandle = {
  getValues: () => { sort: ForumFeedSort; tag: string; zoneType: string };
};

export function FeedShell() {
  const t = useTranslations("community");
  const searchParams = useSearchParams();
  const { filterSheet } = useMentorBottomSheet();
  const filterFormRef = useRef<FeedFilterSheetHandle>(null);
  const [scope, setScope] = useState<ForumFeedScope>("relevant");
  const [sort, setSort] = useState<ForumFeedSort>("trending");
  const [tag, setTag] = useState(searchParams.get("tag") ?? "");
  const [zoneType, setZoneType] = useState("");
  const [tags, setTags] = useState<ForumTagView[]>([]);
  const [state, setState] = useState<State>({ status: "loading" });
  const queryKey = `${scope}:${sort}:${tag}:${zoneType}`;
  const activeTab: FeedTab = scope === "following" ? "following" : sort === "recent" ? "recent" : sort === "top" ? "top" : "featured";
  const feedTabs = [
    { id: "featured", label: t("feed_sort_trending") },
    { id: "recent", label: t("feed_sort_recent") },
    { id: "top", label: t("feed_sort_top") },
    { id: "following", label: t("feed_scope_following") },
  ];
  const mobileFeedTabs = [
    { id: "featured", label: t("feed_sort_trending") },
    { id: "following", label: t("feed_scope_following") },
  ];
  const mobileActiveTab = scope === "following" ? "following" : "featured";
  const sortOptions = [
    { value: "trending", label: t("feed_sort_trending") },
    { value: "recent", label: t("feed_sort_recent") },
    { value: "top", label: t("feed_sort_top") },
  ];
  const tagOptions = [
    { value: "", label: t("feed_all_tags") },
    ...tags.map((entry) => ({ value: entry.slug, label: `#${entry.name}` })),
  ];
  const zoneTypeOptions = [
    { value: "", label: t("feed_all_zone_types") },
    { value: "CHAT", label: t("type_chat") },
    { value: "QA", label: t("type_qa") },
    { value: "ANNOUNCEMENT", label: t("type_announcement") },
  ];

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

  const setTab = (nextTab: string) => {
    const tab = nextTab as FeedTab;
    const nextScope: ForumFeedScope = tab === "following" ? "following" : "relevant";
    const nextSort: ForumFeedSort = tab === "recent" || tab === "following" ? "recent" : tab === "top" ? "top" : "trending";
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
          initialSort={sort}
          defaultSort={scope === "following" ? "recent" : "trending"}
          initialTag={tag}
          initialZoneType={zoneType}
          tagOptions={tagOptions}
          zoneTypeOptions={zoneTypeOptions}
          sortOptions={sortOptions}
        />
      ),
      onApply: () => {
        const values = filterFormRef.current?.getValues();
        if (!values) return;
        setState({ status: "loading" });
        setSort(values.sort);
        setTag(values.tag);
        setZoneType(values.zoneType);
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
        <div className="flex flex-nowrap items-center gap-3 border-b border-[#e7e9ee] pb-4">
          <div className="min-w-0 flex-1 py-1 sm:hidden">
            <SegmentPillControl
              items={mobileFeedTabs}
              value={mobileActiveTab}
              onChange={setTab}
              ariaLabel={t("feed_sort_label")}
              layoutId="community-feed-mobile-tab-pill"
              idPrefix="community-feed-mobile-tab"
              equalWidth
            />
          </div>
          <div className="hidden min-w-0 flex-1 overflow-x-auto py-1 sm:block">
            <SegmentPillControl
              items={feedTabs}
              value={activeTab}
              onChange={setTab}
              ariaLabel={t("feed_sort_label")}
              layoutId="community-feed-tab-pill"
              idPrefix="community-feed-tab"
            />
          </div>
          <button
            type="button"
            aria-label={t("feed_filters")}
            onClick={() => void openMobileFilters()}
            className="relative flex size-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-main)] shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] sm:hidden"
          >
            <ListFilter size={19} aria-hidden />
            {tag || zoneType || (scope === "relevant" ? sort !== "trending" : sort !== "recent") ? (
              <span className="absolute right-2 top-2 size-2 rounded-full bg-[var(--community-blue-ink)]" aria-hidden />
            ) : null}
          </button>
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
          />
          <MenuSelect
            value={zoneType}
            onChange={(value) => {
              setState({ status: "loading" });
              setZoneType(value);
            }}
            aria-label={t("feed_filter_zone_type")}
            options={zoneTypeOptions}
            className="w-48"
          />
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

        <div className="mt-5 grid w-full grid-cols-[minmax(0,1fr)] items-start justify-center gap-6 xl:grid-cols-[minmax(0,600px)_300px]">
          <section className="w-full min-w-0 max-w-[600px] justify-self-center xl:justify-self-auto" aria-live="polite" aria-busy={state.status === "loading"}>
            {state.status === "loading" ? (
              <PostListSkeleton label={t("loading")} variant="card" />
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
                <div className="overflow-hidden rounded-[var(--radius-card)] border border-[#e2e5ea] bg-white">
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
                      className="min-h-11 rounded-xl border bg-white px-5 font-bold"
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
    initialSort: ForumFeedSort;
    defaultSort: ForumFeedSort;
    initialZoneType: string;
    sortOptions: MenuSelectOption[];
    tagOptions: MenuSelectOption[];
    zoneTypeOptions: MenuSelectOption[];
  }
>(function FeedFilterSheet(
  { initialSort, defaultSort, initialTag, initialZoneType, sortOptions, tagOptions, zoneTypeOptions },
  ref,
) {
  const t = useTranslations("community");
  const [draftSort, setDraftSort] = useState<ForumFeedSort>(initialSort);
  const [draftTag, setDraftTag] = useState(initialTag);
  const [draftZoneType, setDraftZoneType] = useState(initialZoneType);

  useImperativeHandle(ref, () => ({
    getValues: () => ({ sort: draftSort, tag: draftTag, zoneType: draftZoneType }),
  }));

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 text-sm font-bold text-[var(--color-main)]">
        {t("feed_sort_label")}
        <MenuSelect
          value={draftSort}
          onChange={(value) => setDraftSort(value as ForumFeedSort)}
          options={sortOptions}
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
      <div className="grid gap-2 text-sm font-bold text-[var(--color-main)]">
        {t("feed_filter_zone_type")}
        <MenuSelect
          value={draftZoneType}
          onChange={setDraftZoneType}
          options={zoneTypeOptions}
          aria-label={t("feed_filter_zone_type")}
          menuSide="top"
        />
      </div>
      {draftSort !== defaultSort || draftTag || draftZoneType ? (
        <button
          type="button"
          onClick={() => {
            setDraftTag("");
            setDraftZoneType("");
            setDraftSort(defaultSort);
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
    <div className="rounded-2xl border border-dashed bg-white px-6 py-14 text-center">
      <h2 className="text-lg font-extrabold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: "var(--color-secondary)" }}>
        {body}
      </p>
      {children}
    </div>
  );
}
