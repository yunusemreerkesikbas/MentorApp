"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ModerationTargetType, type ThreadView, type ZoneMemberStatus, type ZoneView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Chip } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { ReportButton } from "../../_components/report-button";
import { ZONE_TYPE_ICONS } from "../../_components/zone-icons";
import {
  deleteThread,
  getZone,
  isForumDisabled,
  listThreads,
  pinThread,
  postThread,
  reactThread,
  unreactThread,
} from "@/lib/forum";
import { AskComposer } from "./ask-composer";
import { JoinButton } from "./join-button";
import { QuestionListItem } from "./question-list-item";
import { RightPanel } from "./right-panel";
import { ThreadComposer } from "./thread-composer";
import { ThreadItem } from "./thread-item";
import { ZoneShellSkeleton } from "./zone-shell-skeleton";

interface Ready {
  zone: ZoneView;
  threads: ThreadView[];
  nextCursor: string | null;
  loadingMore: boolean;
}
type State =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "error"; message: string }
  | ({ status: "ready" } & Ready);

export function ZoneShell({ slug }: { slug: string }) {
  const t = useTranslations("topluluk");
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
    async (body: string) => {
      const ready = state.status === "ready" ? state : null;
      if (!ready) return;
      const created = await postThread(ready.zone.id, body);
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
      const feed = await listThreads(ready.zone.id, ready.nextCursor);
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

  const { zone, threads, nextCursor, loadingMore } = state;
  const isMember = zone.myStatus === "ACTIVE";
  const isQa = zone.type === "QA";
  const pinnedThreads = threads.filter((t) => t.isPinned).slice(0, 3);

  return (
    <div className="flex gap-0 xl:gap-5">
      {/* Feed column */}
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-6 lg:py-8">
        {/* Back link — hidden on lg+ since zone sidebar is visible */}
        <Link href="/topluluk" className="mb-4 flex items-center gap-1 text-sm lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]" style={{ color: "var(--color-secondary)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
          {t("back")}
        </Link>

        <header className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xl"
              style={{ background: "color-mix(in srgb, var(--color-chip) 18%, white)" }}
            >
              {zone.emoji ?? ZONE_TYPE_ICONS[zone.type]}
            </span>
            <div>
              <h1
                className="text-lg font-bold leading-tight"
                style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
              >
                {zone.title}
              </h1>
              <Chip>{t(`type_${zone.type.toLowerCase()}` as `type_${string}`)}</Chip>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 xl:hidden">
            <JoinButton zoneId={zone.id} myStatus={zone.myStatus} onJoined={onJoined} />
            {zone.canModerate ? (
              <Link
                href={`/topluluk/${zone.slug}/yonetim`}
                className="text-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                style={{ color: "var(--color-secondary)" }}
              >
                {t("manage_link")}
              </Link>
            ) : null}
          </div>
        </header>

        {/* Composer (members only). ANNOUNCEMENT posts may 403 for non-mods → ThreadComposer surfaces it. */}
        {isMember ? (
          isQa ? (
            <div className="mb-6">
              <AskComposer zoneId={zone.id} />
            </div>
          ) : (
            <div className="mb-6">
              <ThreadComposer
                placeholder={t("compose_placeholder")}
                submitLabel={t("compose_send")}
                onSubmit={onPost}
              />
            </div>
          )
        ) : (
          <p className="mb-6 text-sm" style={{ color: "var(--color-secondary)" }}>
            {t("compose_join_first")}
          </p>
        )}

        {threads.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: "var(--color-secondary)" }}>
            {isQa ? t("qa_empty") : t("feed_empty")}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {isQa
              ? threads.map((q) => <QuestionListItem key={q.id} question={q} />)
              : threads.map((th) => (
                  <ThreadItem
                    key={th.id}
                    thread={th}
                    onToggleReaction={(emoji, adding) => onToggleReaction(th.id, emoji, adding)}
                    actions={<ReportButton targetType={ModerationTargetType.THREAD} targetId={th.id} />}
                    canModerate={zone.canModerate}
                    onPin={(pinned) => onPinThread(th.id, pinned)}
                    onDelete={() => onDeleteThread(th.id)}
                  />
                ))}
          </div>
        )}

        {nextCursor ? (
          <div className="mt-5 flex justify-center">
            <Button variant="secondary" busy={loadingMore} onClick={() => void onLoadMore()}>
              {t("load_more")}
            </Button>
          </div>
        ) : null}
      </main>

      {/* Right panel — xl+ only */}
      <aside className="hidden xl:block xl:w-64 xl:flex-shrink-0 xl:py-6 xl:pr-5">
        <RightPanel zone={zone} pinned={pinnedThreads} />
      </aside>
    </div>
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
