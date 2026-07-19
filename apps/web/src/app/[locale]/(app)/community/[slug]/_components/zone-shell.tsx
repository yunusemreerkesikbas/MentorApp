"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { type ThreadView, type ZoneMemberStatus, type ZoneView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { ZONE_TYPE_ICONS } from "../../_components/zone-icons";
import {
  bookmarkThread,
  deleteThread,
  getZone,
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

interface Ready {
  zone: ZoneView;
  threads: ThreadView[];
  nextCursor: string | null;
  loadingMore: boolean;
  sort: ThreadSort;
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
        const zone = await getZone(slug);
        const feed = await listThreads(zone.id);
        if (active) {
          setState({
            status: "ready",
            zone,
            threads: feed.items,
            nextCursor: feed.nextCursor,
            loadingMore: false,
            sort: "recent",
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

  const { zone, threads, nextCursor, loadingMore, sort } = state;
  const isMember = zone.myStatus === "ACTIVE";
  const isQa = zone.type === "QA";

  return (
    <main className="mx-auto min-w-0 max-w-2xl px-4 py-6 lg:px-8 lg:py-8">
      {/* Back link — hidden on lg+ since zone sidebar is visible */}
      <Link href="/community" className="mb-4 flex items-center gap-1 text-sm lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]" style={{ color: "var(--color-secondary)" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
        {t("back")}
      </Link>

      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-2xl"
            style={{ background: "color-mix(in srgb, var(--color-chip) 18%, white)" }}
          >
            {zone.emoji ?? ZONE_TYPE_ICONS[zone.type]}
          </span>
          <div className="min-w-0">
            {/* Eyebrow category — plain uppercase label, not a button (Trending Topics layout) */}
            <p
              className="text-[10px] font-semibold uppercase"
              style={{ color: "var(--color-secondary)", letterSpacing: "0.08em" }}
            >
              {t(`type_${zone.type.toLowerCase()}` as `type_${string}`)}
            </p>
            <h1
              className="text-xl font-bold leading-tight sm:text-2xl"
              style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
            >
              {zone.title}
            </h1>
            <p className="mt-0.5 text-xs" style={{ color: "var(--color-secondary)" }}>
              {t("members", { count: zone.memberCount })}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <JoinButton zoneId={zone.id} myStatus={zone.myStatus} onJoined={onJoined} />
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
                      background: active ? "var(--color-main)" : "transparent",
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
          <div className="divide-y divide-[rgba(0,0,0,0.08)] border-b" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
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
          <Button variant="secondary" busy={loadingMore} onClick={() => void onLoadMore()}>
            {t("load_more")}
          </Button>
        </div>
      ) : null}
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
