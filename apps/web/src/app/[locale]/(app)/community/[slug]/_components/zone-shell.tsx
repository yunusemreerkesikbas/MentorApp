"use client";

import { useCallback, useEffect, useState } from "react";
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
import { ZONE_TYPE_ICONS } from "../../_components/zone-icons";
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
import { ThreadItem } from "./thread-item";
import { ZoneShellSkeleton } from "./zone-shell-skeleton";
import { AuthorAvatar } from "../../_components/author-avatar";

interface Ready {
  zone: ZoneView;
  threads: ThreadView[];
  nextCursor: string | null;
  loadingMore: boolean;
  sort: ThreadSort;
  contributors: ForumPublicPerson[];
  pinnedThreads: ForumThreadSummary[];
}
type State =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "error"; message: string }
  | ({ status: "ready" } & Ready);

export function ZoneShell({ slug }: { slug: string }) {
  const t = useTranslations("community");
  const [state, setState] = useState<State>({ status: "loading" });

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
    (threadId: string, emoji: string, adding: boolean) => {
      // optimistic
      patchReady((r) => ({ ...r, threads: r.threads.map((th) => applyReaction(th, threadId, emoji, adding)) }));
      const call = adding ? reactThread(threadId, emoji) : unreactThread(threadId, emoji);
      call.catch(() => {
        // revert on failure
        patchReady((r) => ({
          ...r,
          threads: r.threads.map((th) => applyReaction(th, threadId, emoji, !adding)),
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
      // Native confirm (no modal infra). Note: an un-reported inline delete has no in-UI restore
      // path today (restore lives on the report queue) — a mod's own-deletions view is a later slice.
      if (!window.confirm(t("delete_confirm"))) return;
      patchReady((r) => ({ ...r, threads: r.threads.filter((th) => th.id !== threadId) }));
      void deleteThread(threadId);
    },
    [patchReady, t],
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
      // Keep the current list visible while the new order loads (no flash of empty).
      patchReady((r) => ({ ...r, sort, loadingMore: true }));
      listThreads(ready.zone.id, undefined, sort)
        .then((feed) =>
          patchReady((r) => ({
            ...r,
            threads: feed.items,
            nextCursor: feed.nextCursor,
            loadingMore: false,
          })),
        )
        .catch(() => patchReady((r) => ({ ...r, loadingMore: false })));
    },
    [state, patchReady],
  );

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

  const { zone, threads, nextCursor, loadingMore, sort, contributors, pinnedThreads } = state;
  const isMember = zone.myStatus === "ACTIVE";
  const isQa = zone.type === "QA";
  const zoneTone =
    zone.type === "QA"
      ? "bg-[#fff0ed] text-[#c94f3d]"
      : zone.type === "ANNOUNCEMENT"
        ? "bg-[#eaf7f0] text-[#2f8f63]"
        : "bg-[var(--community-blue-soft)] text-[var(--community-blue-ink)]";

  return (
    <main className="mx-auto min-w-0 max-w-[1180px] px-4 py-5 sm:px-7 lg:px-8 lg:py-6">
      <nav aria-label={t("breadcrumb_label")} className="mb-5 flex min-h-11 items-center gap-2 border-b border-[#eceef2] pb-4 text-[13px] text-[#7b808a]">
        <Link href="/community" className="font-semibold text-[#373c47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">{t("title")}</Link>
        <span aria-hidden>›</span>
        <span aria-current="page" className="truncate">{zone.title}</span>
      </nav>

      <header className="mb-5 flex items-start justify-between gap-3 border-b border-[#eceef2] pb-5">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[10px] text-xl ${zoneTone}`}
          >
            {zone.emoji ?? ZONE_TYPE_ICONS[zone.type]}
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-[#6c727e]">
              {t(`type_${zone.type.toLowerCase()}` as `type_${string}`)}
            </p>
            <h1 className="text-xl font-extrabold leading-tight tracking-[-0.025em] text-[#171a22] sm:text-2xl">
              {zone.title}
            </h1>
            <p className="mt-0.5 text-xs text-[#7b808a]">
              {t("members", { count: zone.memberCount })}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <JoinButton
            zoneId={zone.id}
            myStatus={zone.myStatus}
            myRole={zone.myRole}
            joinPolicy={zone.joinPolicy}
            onJoined={onJoined}
            onLeft={onLeft}
          />
          {zone.canModerate ? (
            <Link
              href={{
                pathname: "/community/[slug]/management",
                params: { slug: zone.slug },
              }}
              aria-label={t("manage_link")}
              title={t("manage_link")}
              className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{ borderColor: "rgba(0,0,0,0.10)", color: "var(--color-secondary)" }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
          ) : null}
        </div>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_304px]">
        <div className="min-w-0">
        {isQa ? (
          <>
            {/* Composer (members only). */}
            {isMember ? (
              <div className="mb-6">
                <AskComposer zoneId={zone.id} />
              </div>
            ) : (
              <p className="mb-6 text-sm" style={{ color: "var(--color-secondary)" }}>
                {t("compose_join_first")}
              </p>
            )}
            {threads.length === 0 ? (
              <p className="py-8 text-center text-sm" style={{ color: "var(--color-secondary)" }}>
                {t("qa_empty")}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {threads.map((q) => (
                  <QuestionListItem key={q.id} question={q} />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
          {/* Sort toggle — recent (cursor) vs popular (top by likes+comments). */}
          {threads.length > 0 && (
            <div className="mb-3 flex items-center gap-1" role="tablist" aria-label={t("sort_label")}>
              {(["recent", "popular"] as const).map((s) => {
                const active = sort === s;
                return (
                  <button
                    key={s}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onChangeSort(s)}
                    className="rounded-full px-3 py-1 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                    style={{
                      background: active ? "var(--color-btn)" : "transparent",
                      color: active ? "#fff" : "var(--color-secondary)",
                    }}
                  >
                    {t(`sort_${s}` as "sort_recent" | "sort_popular")}
                  </button>
                );
              })}
            </div>
          )}
          {/* Flat feed — no card chrome, just border-b dividers directly on the page (Figma 1:262/1:270/1:281). */}
          <div className="divide-y divide-[#eceef2] border-b border-[#eceef2] bg-white">
            {/* Composer (members only). ANNOUNCEMENT posts may 403 for non-mods → ThreadComposer surfaces it. */}
            {isMember ? (
              <ThreadComposer
                placeholder={t("compose_placeholder")}
                submitLabel={t("compose_send")}
                onSubmit={onPost}
                zoneId={zone.id}
              />
            ) : (
              <p className="px-3 py-4 text-sm" style={{ color: "var(--color-secondary)" }}>
                {t("compose_join_first")}
              </p>
            )}

            {threads.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm" style={{ color: "var(--color-secondary)" }}>
                {t("feed_empty")}
              </p>
            ) : (
              threads.map((th) => (
                <ThreadItem
                  key={th.id}
                  thread={th}
                  onToggleReaction={(emoji, adding) => onToggleReaction(th.id, emoji, adding)}
                  onToggleBookmark={(adding) => onToggleBookmark(th.id, adding)}
                  canModerate={zone.canModerate}
                  onPin={(pinned) => onPinThread(th.id, pinned)}
                  onDelete={() => onDeleteThread(th.id)}
                  clickable
                />
              ))
            )}
          </div>
          </>
        )}

      {nextCursor ? (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void onLoadMore()}
            className="min-h-11 rounded-xl border bg-white px-5 font-bold disabled:opacity-50"
          >
            {loadingMore ? t("loading") : t("load_more")}
          </button>
        </div>
      ) : null}
        </div>
        {(contributors.length > 0 || pinnedThreads.length > 0) && (
          <aside className="hidden space-y-7 border-l border-[#e7e9ee] pl-5 xl:block" aria-label={t("zone_context_title")}>
            {contributors.length > 0 && (
              <section>
                <h2 className="text-[13px] font-extrabold text-[#4c535f]">{t("zone_contributors")}</h2>
                <div className="mt-3 grid gap-1">
                  {contributors.map((person) => (
                    <Link
                      key={person.id}
                      href={{
                        pathname: "/community/member/[username]",
                        params: { username: person.username },
                      }}
                      className="flex min-h-11 items-center gap-3 rounded-[9px] px-2 py-2 text-sm font-bold text-[#343945] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                    >
                      <AuthorAvatar name={person.displayName} src={person.avatarUrl} size={32} />
                      <span className="truncate">{person.displayName}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            {pinnedThreads.length > 0 && (
              <section>
                <h2 className="text-[13px] font-extrabold text-[#4c535f]">{t("pinned_posts")}</h2>
                <div className="mt-3 grid gap-3">
                  {pinnedThreads.map((thread) => {
                    const href =
                      thread.zoneType === "QA"
                        ? ({
                            pathname: "/community/question/[threadId]",
                            params: { threadId: thread.id },
                          } as const)
                        : ({
                            pathname: "/community/message/[threadId]",
                            params: { threadId: thread.id },
                          } as const);
                    return (
                      <Link
                        key={thread.id}
                        href={href}
                        className="block min-h-[72px] rounded-[12px] border border-[#e7e9ee] bg-white p-3 text-sm font-bold text-[#343945] shadow-[0_1px_5px_rgb(18_24_39_/_3%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                      >
                        <span className="line-clamp-2">{thread.title ?? thread.bodyExcerpt}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </aside>
        )}
      </div>
    </main>
  );
}

/** Apply a reaction toggle to one thread's local counts/mine (optimistic). */
function applyReaction(th: ThreadView, threadId: string, emoji: string, adding: boolean): ThreadView {
  if (th.id !== threadId) return th;
  const count = th.reactionCounts[emoji] ?? 0;
  const counts = { ...th.reactionCounts, [emoji]: Math.max(0, count + (adding ? 1 : -1)) };
  if (counts[emoji] === 0) delete counts[emoji];
  const mine = adding ? [...th.myReactions, emoji] : th.myReactions.filter((e) => e !== emoji);
  return { ...th, reactionCounts: counts, myReactions: mine };
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[40vh] w-full max-w-3xl items-center justify-center px-5 py-8">
      <p style={{ color: "var(--color-secondary)" }}>{children}</p>
    </main>
  );
}
