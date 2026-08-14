"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Settings, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type ForumPublicPerson,
  type ForumThreadSummary,
  type ThreadView,
  type ZoneMemberStatus,
  type ZoneView,
} from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Link } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { replaceReaction } from "@/lib/forum-reactions";
import {
  bookmarkThread,
  deleteThread,
  getZoneFeed,
  isForumDisabled,
  listThreads,
  pinThread,
  postThread,
  reactThread,
  type ThreadSort,
  unreactThread,
} from "@/lib/forum";
import type { AttachmentInput } from "@mentor/validation";
import { AskComposer } from "./ask-composer";
import { JoinButton } from "./join-button";
import { QuestionListItem } from "./question-list-item";
import { ThreadComposer } from "./thread-composer";
import { CommunityPostCard } from "../../_components/community-post-card";
import { ZoneShellSkeleton } from "./zone-shell-skeleton";
import { AuthorAvatar } from "../../_components/author-avatar";
import { CommunityTrendRail } from "../../_components/community-trend-rail";
import { TabContentSkeleton } from "../../_components/tab-content-skeleton";
import { PostListSkeleton } from "../../_components/post-skeleton";

interface Ready {
  zone: ZoneView;
  threads: ThreadView[];
  nextCursor: string | null;
  loadingMore: boolean;
  switchingSort: boolean;
  sort: ThreadSort;
  contributors: ForumPublicPerson[];
  pinnedThreads: ForumThreadSummary[];
}
type State =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "error"; message: string }
  | ({ status: "ready" } & Ready);

type ZoneTab = "popular" | "recent" | "media" | "about";
const TAB_SKELETON_MIN_MS = 320;

export function ZoneShell({ slug }: { slug: string }) {
  const t = useTranslations("community");
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<State>({ status: "loading" });
  const [activeTab, setActiveTab] = useState<ZoneTab>("recent");
  const [shareCopied, setShareCopied] = useState(false);
  const sortRequestIdRef = useRef(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await getZoneFeed(slug);
        if (active) {
          setState({
            status: "ready",
            zone: result.zone,
            threads: result.feed.items,
            nextCursor: result.feed.nextCursor,
            loadingMore: false,
            switchingSort: false,
            sort: "recent",
            contributors: result.contributors,
            pinnedThreads: result.pinnedThreads,
          });
        }
      } catch (err) {
        if (!active) return;
        if (isForumDisabled(err)) return setState({ status: "disabled" });
        setState({
          status: "error",
          message: err instanceof ApiClientError ? err.body.message : t("error"),
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [slug, t]);

  const patchReady = useCallback((fn: (r: Ready) => Ready) => {
    setState((s) => (s.status === "ready" ? { status: "ready", ...fn(s) } : s));
  }, []);

  const onJoined = useCallback(
    (status: ZoneMemberStatus) => patchReady((r) => ({ ...r, zone: { ...r.zone, myStatus: status } })),
    [patchReady],
  );

  const onLeft = useCallback(
    () => patchReady((r) => ({ ...r, zone: { ...r.zone, myStatus: null, myRole: null } })),
    [patchReady],
  );

  const onPost = useCallback(
    async (body: string, attachments: AttachmentInput[]) => {
      const ready = state.status === "ready" ? state : null;
      if (!ready) return;
      const created = await postThread(ready.zone.id, body, undefined, attachments);
      patchReady((r) => ({ ...r, threads: [created, ...r.threads] }));
    },
    [state, patchReady],
  );

  const onToggleReaction = useCallback(
    (threadId: string, nextEmoji: string | null, previousEmoji: string | null) => {
      patchReady((ready) => ({
        ...ready,
        threads: ready.threads.map((thread) =>
          thread.id === threadId ? replaceReaction(thread, nextEmoji) : thread,
        ),
      }));
      const call = nextEmoji
        ? reactThread(threadId, nextEmoji)
        : previousEmoji
          ? unreactThread(threadId, previousEmoji)
          : Promise.resolve();
      call.catch(() => {
        patchReady((ready) => ({
          ...ready,
          threads: ready.threads.map((thread) =>
            thread.id === threadId ? replaceReaction(thread, previousEmoji) : thread,
          ),
        }));
      });
    },
    [patchReady],
  );

  const onToggleBookmark = useCallback(
    (threadId: string, adding: boolean) => {
      patchReady((r) => ({
        ...r,
        threads: r.threads.map((th) => (th.id === threadId ? { ...th, myBookmarked: adding } : th)),
      }));
      bookmarkThread(threadId, adding).catch(() => {
        patchReady((r) => ({
          ...r,
          threads: r.threads.map((th) =>
            th.id === threadId ? { ...th, myBookmarked: !adding } : th,
          ),
        }));
      });
    },
    [patchReady],
  );

  const onPinThread = useCallback(
    (threadId: string, pinned: boolean) => {
      patchReady((r) => ({
        ...r,
        threads: r.threads
          .map((th) => (th.id === threadId ? { ...th, isPinned: pinned } : th))
          .sort((a, b) =>
            a.isPinned === b.isPinned
              ? b.createdAt.localeCompare(a.createdAt)
              : a.isPinned
                ? -1
                : 1,
          ),
      }));
      pinThread(threadId, pinned).catch(() => {
        patchReady((r) => ({
          ...r,
          threads: r.threads.map((th) => (th.id === threadId ? { ...th, isPinned: !pinned } : th)),
        }));
      });
    },
    [patchReady],
  );

  const onDeleteThread = useCallback(
    (threadId: string) => {
      patchReady((r) => ({ ...r, threads: r.threads.filter((th) => th.id !== threadId) }));
      void deleteThread(threadId);
    },
    [patchReady],
  );

  const onLoadMore = useCallback(async () => {
    const ready = state.status === "ready" ? state : null;
    if (!ready || !ready.nextCursor) return;
    patchReady((r) => ({ ...r, loadingMore: true }));
    try {
      const feed = await listThreads(ready.zone.id, ready.nextCursor, ready.sort);
      patchReady((r) => ({
        ...r,
        threads: [...r.threads, ...feed.items],
        nextCursor: feed.nextCursor,
        loadingMore: false,
      }));
    } catch {
      patchReady((r) => ({ ...r, loadingMore: false }));
    }
  }, [state, patchReady]);

  const onChangeSort = useCallback(
    (sort: ThreadSort) => {
      const ready = state.status === "ready" ? state : null;
      if (!ready || ready.sort === sort) return;
      const requestId = ++sortRequestIdRef.current;
      patchReady((r) => ({ ...r, sort, switchingSort: true }));
      const minimumSkeleton = new Promise<void>((resolve) => {
        window.setTimeout(resolve, TAB_SKELETON_MIN_MS);
      });
      void (async () => {
        try {
          const feed = await listThreads(ready.zone.id, undefined, sort);
          await minimumSkeleton;
          if (requestId !== sortRequestIdRef.current) return;
          patchReady((r) => ({
            ...r,
            threads: feed.items,
            nextCursor: feed.nextCursor,
            switchingSort: false,
          }));
        } catch {
          await minimumSkeleton;
          if (requestId !== sortRequestIdRef.current) return;
          patchReady((r) => ({ ...r, switchingSort: false }));
        }
      })();
    },
    [state, patchReady],
  );

  const onChangeTab = useCallback(
    (tab: ZoneTab) => {
      setActiveTab(tab);
      if (tab === "recent" || tab === "popular") onChangeSort(tab);
    },
    [onChangeSort],
  );

  const onShareZone = useCallback(async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(url);
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 1800);
  }, []);

  if (state.status === "loading") {
    return <ZoneShellSkeleton label={t("loading")} />;
  }
  if (state.status === "disabled") {
    return <Centered>{t("soon_title")}</Centered>;
  }
  if (state.status === "error") {
    return (
      <main className="px-5 py-8 lg:px-6">
        <FormError message={state.message} />
      </main>
    );
  }

  const { zone, threads, nextCursor, loadingMore, switchingSort, contributors, pinnedThreads } = state;
  const isMember = zone.myStatus === "ACTIVE";
  const isQa = zone.type === "QA";
  const visibleThreads =
    activeTab === "media"
      ? threads.filter((thread) => thread.attachments.length > 0)
      : threads;
  const memberFaces = contributors.slice(0, 5);
  const tabs: Array<{ id: ZoneTab; label: string }> = [
    { id: "popular", label: t("sort_popular") },
    { id: "recent", label: t("sort_recent") },
    { id: "media", label: t("zone_tab_media") },
    { id: "about", label: t("zone_tab_about") },
  ];

  return (
    <main className="mx-auto grid min-w-0 max-w-[924px] items-start gap-6 xl:grid-cols-[600px_300px]">
    <section className="min-w-0 bg-white sm:my-6 sm:border-x sm:border-[#e7e9ee]">
      <header>
        <div className="relative aspect-[3/1] overflow-hidden bg-[var(--community-blue-soft)]">
          <Image
            src="/img/feed.png"
            alt=""
            fill
            priority
            sizes="600px"
            className="object-cover object-[center_58%]"
          />
        </div>

        <div className="px-4 pb-4 pt-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold leading-tight tracking-[-0.03em] text-[var(--color-main)] sm:text-[28px]">
                {zone.title}
              </h1>
              <span className="mt-2 inline-flex min-h-7 items-center rounded-[10px] border border-[#dfe3ea] px-2.5 text-xs font-bold text-[var(--color-body-text)]">
                {t(`type_${zone.type.toLowerCase()}` as `type_${string}`)}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => void onShareZone()}
                aria-label={shareCopied ? t("share_copied") : t("zone_share")}
                title={shareCopied ? t("share_copied") : t("zone_share")}
                className="community-post-action grid size-11 place-items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              >
                <Share2 size={19} aria-hidden />
              </button>
              {zone.canModerate ? (
                <Link
                  href={{ pathname: "/community/[slug]/management", params: { slug: zone.slug } }}
                  aria-label={t("manage_link")}
                  title={t("manage_link")}
                  className="community-post-action grid size-11 place-items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                >
                  <Settings size={19} aria-hidden />
                </Link>
              ) : null}
              <JoinButton
                zoneId={zone.id}
                myStatus={zone.myStatus}
                myRole={zone.myRole}
                joinPolicy={zone.joinPolicy}
                onJoined={onJoined}
                onLeft={onLeft}
              />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            {memberFaces.length > 0 ? (
              <div className="flex -space-x-2" aria-hidden>
                {memberFaces.map((person) => (
                  <span key={person.id} className="rounded-full ring-2 ring-white">
                    <AuthorAvatar name={person.displayName} src={person.avatarUrl} size={28} />
                  </span>
                ))}
              </div>
            ) : null}
            <p className="text-sm font-bold text-[var(--color-main)] tabular-nums">
              {t("members", { count: zone.memberCount })}
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-4 border-y border-[#e7e9ee]" role="tablist" aria-label={t("sort_label") }>
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChangeTab(tab.id)}
              className="relative min-h-14 px-2 text-sm font-bold text-[var(--color-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]"
            >
              <span className={active ? "text-[var(--color-main)]" : undefined}>{tab.label}</span>
              {active ? (
                <motion.span
                  layoutId="community-zone-tab-indicator"
                  className="absolute inset-x-4 bottom-0 h-1 rounded-full bg-[var(--community-blue-ink)]"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 30 }}
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="popLayout" initial={false}>
      {activeTab === "about" ? (
        <motion.section
          key="about"
          initial={reduceMotion ? false : { opacity: 0, x: 34, scale: 0.985 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -24, scale: 0.99 }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 30 }}
          className="space-y-7 px-5 py-6"
          aria-labelledby="zone-about-title"
        >
          <div>
            <h2 id="zone-about-title" className="text-lg font-extrabold text-[var(--color-main)]">{t("zone_tab_about")}</h2>
            <p className="mt-2 text-[15px] leading-6 text-[var(--color-body-text)]">
              {zone.description ?? t("zone_about_empty")}
            </p>
          </div>
          {contributors.length > 0 ? (
            <div>
              <h2 className="text-sm font-extrabold text-[var(--color-main)]">{t("zone_contributors")}</h2>
              <div className="mt-3 grid gap-1 sm:grid-cols-2">
                {contributors.map((person) => (
                  <Link
                    key={person.id}
                    href={{ pathname: "/community/member/[username]", params: { username: person.username } }}
                    className="flex min-h-12 items-center gap-3 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                  >
                    <AuthorAvatar name={person.displayName} src={person.avatarUrl} size={32} />
                    <span className="truncate text-sm font-bold text-[var(--color-body-text)]">{person.displayName}</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          {pinnedThreads.length > 0 ? (
            <div>
              <h2 className="text-sm font-extrabold text-[var(--color-main)]">{t("pinned_posts")}</h2>
              <div className="mt-3 divide-y divide-[#e7e9ee] border-y border-[#e7e9ee]">
                {pinnedThreads.map((thread) => (
                  <p key={thread.id} className="py-3 text-sm font-bold text-[var(--color-body-text)]">
                    {thread.title ?? thread.bodyExcerpt}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </motion.section>
      ) : (
        <motion.div
          key={activeTab}
          initial={reduceMotion ? false : { opacity: 0, x: 34, scale: 0.985 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -24, scale: 0.99 }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 30 }}
          className="divide-y divide-[#e7e9ee] border-b border-[#e7e9ee]"
        >
          {switchingSort && (activeTab === "recent" || activeTab === "popular") ? (
            <TabContentSkeleton label={t("loading")} variant="feed" />
          ) : (
          <>
          {activeTab !== "media" ? (
            isMember ? (
              isQa ? (
                <div className="p-4"><AskComposer zoneId={zone.id} /></div>
              ) : (
                <ThreadComposer
                  placeholder={t("compose_placeholder")}
                  submitLabel={t("compose_send")}
                  onSubmit={onPost}
                  zoneId={zone.id}
                />
              )
            ) : (
              <p className="px-4 py-4 text-sm text-[var(--color-secondary)]">{t("compose_join_first")}</p>
            )
          ) : null}

          {visibleThreads.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-[var(--color-secondary)]">
              {activeTab === "media" ? t("zone_media_empty") : isQa ? t("qa_empty") : t("feed_empty")}
            </p>
          ) : isQa ? (
            <div className="grid gap-3 p-4">
              {visibleThreads.map((question) => <QuestionListItem key={question.id} question={question} />)}
            </div>
          ) : (
            visibleThreads.map((thread) => (
              <CommunityPostCard
                key={thread.id}
                thread={thread}
                onToggleReaction={(nextEmoji, previousEmoji) =>
                  onToggleReaction(thread.id, nextEmoji, previousEmoji)
                }
                onToggleBookmark={(adding) => onToggleBookmark(thread.id, adding)}
                canModerate={zone.canModerate}
                onPin={(pinned) => onPinThread(thread.id, pinned)}
                onDelete={() => onDeleteThread(thread.id)}
                onReplyCountChange={(delta) =>
                  patchReady((ready) => ({
                    ...ready,
                    threads: ready.threads.map((entry) =>
                      entry.id === thread.id
                        ? { ...entry, commentCount: Math.max(0, entry.commentCount + delta) }
                        : entry,
                    ),
                  }))
                }
                clickable
              />
            ))
          )}
          </>
          )}
        </motion.div>
      )}
      </AnimatePresence>

      {activeTab !== "about" && nextCursor ? (
        loadingMore ? (
          <PostListSkeleton label={t("loading")} count={2} />
        ) : (
        <div className="flex justify-center p-5">
          <button
            type="button"
            onClick={() => void onLoadMore()}
            className="min-h-11 rounded-[10px] border border-[#dfe3ea] bg-white px-5 font-bold"
          >
            {t("load_more")}
          </button>
        </div>
        )
      ) : null}
    </section>
    <div className="sticky top-20 hidden pt-6 xl:block">
      <CommunityTrendRail />
    </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[40vh] w-full max-w-3xl items-center justify-center px-5 py-8">
      <p style={{ color: "var(--color-secondary)" }}>{children}</p>
    </main>
  );
}
