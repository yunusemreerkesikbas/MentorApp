"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ForumPublicPerson, ForumThreadSummary, ThreadView, ZoneMemberStatus, ZoneView } from "@mentor/types";
import type { AttachmentInput, ForumPollInput } from "@mentor/validation";
import { ApiClientError } from "@mentor/api-client";
import { Link } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import {
  PANEL_CARD,
  PANEL_CARD_TITLE,
  PANEL_GRID_CLASS,
  PANEL_MAIN_CLASS,
  PANEL_QUIET_LINK,
} from "@/components/panel/panel-styles";
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
import { AuthorAvatar } from "../../_components/author-avatar";
import { CommunityPostCard } from "../../_components/community-post-card";
import { CommunityPresenceCard } from "../../_components/community-presence";
import { COMMUNITY_CARD_FLUSH, COMMUNITY_ROW_LIST } from "../../_components/community-row";
import { PostListSkeleton } from "../../_components/post-skeleton";
import { AskComposer } from "./ask-composer";
import { QuestionListItem } from "./question-list-item";
import { ThreadComposer } from "./thread-composer";
import { ZONE_TABPANEL_ID, ZoneHeader, type ZoneTab } from "./zone-header";
import { ZoneShellSkeleton } from "./zone-shell-skeleton";

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
type State = { status: "loading" } | { status: "disabled" } | { status: "error"; message: string } | ({ status: "ready" } & Ready);

/** Keeps a sort switch from flashing its skeleton for a single frame. */
const TAB_SKELETON_MIN_MS = 320;

/**
 * A room on the panel frame: its header card, the composer for members, then the posts (or
 * questions) in one card; the rail holds who is studying now and the room's contributors.
 */
export function ZoneShell({ slug }: { slug: string }) {
  const t = useTranslations("community");
  const [state, setState] = useState<State>({ status: "loading" });
  const [activeTab, setActiveTab] = useState<ZoneTab>("recent");
  const sortRequestIdRef = useRef(0);

  useEffect(() => {
    let active = true;
    getZoneFeed(slug)
      .then((result) => {
        if (!active) return;
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
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (isForumDisabled(err)) setState({ status: "disabled" });
        else setState({ status: "error", message: err instanceof ApiClientError ? err.body.message : t("error") });
      });
    return () => {
      active = false;
    };
  }, [slug, t]);

  const patchReady = useCallback((fn: (r: Ready) => Ready) => {
    setState((s) => (s.status === "ready" ? { status: "ready", ...fn(s) } : s));
  }, []);

  const patchThread = useCallback(
    (threadId: string, fn: (thread: ThreadView) => ThreadView) =>
      patchReady((r) => ({ ...r, threads: r.threads.map((th) => (th.id === threadId ? fn(th) : th)) })),
    [patchReady],
  );

  const onPost = useCallback(
    async (body: string, attachments: AttachmentInput[], poll?: ForumPollInput) => {
      if (state.status !== "ready") return;
      const created = await postThread(state.zone.id, body, undefined, attachments, undefined, poll);
      patchReady((r) => ({ ...r, threads: [created, ...r.threads] }));
    },
    [state, patchReady],
  );

  const onToggleReaction = (threadId: string, nextEmoji: string | null, previousEmoji: string | null) => {
    patchThread(threadId, (th) => replaceReaction(th, nextEmoji));
    const call = nextEmoji
      ? reactThread(threadId, nextEmoji)
      : previousEmoji
        ? unreactThread(threadId, previousEmoji)
        : Promise.resolve();
    call.catch(() => patchThread(threadId, (th) => replaceReaction(th, previousEmoji)));
  };

  const onToggleBookmark = (threadId: string, adding: boolean) => {
    patchThread(threadId, (th) => ({ ...th, myBookmarked: adding }));
    bookmarkThread(threadId, adding).catch(() => patchThread(threadId, (th) => ({ ...th, myBookmarked: !adding })));
  };

  const onPinThread = (threadId: string, pinned: boolean) => {
    patchReady((r) => ({
      ...r,
      threads: r.threads
        .map((th) => (th.id === threadId ? { ...th, isPinned: pinned } : th))
        .sort((a, b) => (a.isPinned === b.isPinned ? b.createdAt.localeCompare(a.createdAt) : a.isPinned ? -1 : 1)),
    }));
    pinThread(threadId, pinned).catch(() => patchThread(threadId, (th) => ({ ...th, isPinned: !pinned })));
  };

  const onDeleteThread = (threadId: string) => {
    patchReady((r) => ({ ...r, threads: r.threads.filter((th) => th.id !== threadId) }));
    void deleteThread(threadId);
  };

  const onLoadMore = async () => {
    if (state.status !== "ready" || !state.nextCursor) return;
    const { zone, nextCursor, sort } = state;
    patchReady((r) => ({ ...r, loadingMore: true }));
    try {
      const feed = await listThreads(zone.id, nextCursor, sort);
      patchReady((r) => ({ ...r, threads: [...r.threads, ...feed.items], nextCursor: feed.nextCursor, loadingMore: false }));
    } catch {
      patchReady((r) => ({ ...r, loadingMore: false }));
    }
  };

  const onChangeTab = (tab: ZoneTab) => {
    setActiveTab(tab);
    if (tab === "about" || state.status !== "ready" || state.sort === tab) return;
    const zoneId = state.zone.id;
    const requestId = ++sortRequestIdRef.current;
    patchReady((r) => ({ ...r, sort: tab, switchingSort: true }));
    const minimumSkeleton = new Promise<void>((resolve) => window.setTimeout(resolve, TAB_SKELETON_MIN_MS));
    void (async () => {
      try {
        const feed = await listThreads(zoneId, undefined, tab);
        await minimumSkeleton;
        if (requestId !== sortRequestIdRef.current) return;
        patchReady((r) => ({ ...r, threads: feed.items, nextCursor: feed.nextCursor, switchingSort: false }));
      } catch {
        await minimumSkeleton;
        if (requestId === sortRequestIdRef.current) patchReady((r) => ({ ...r, switchingSort: false }));
      }
    })();
  };

  if (state.status === "loading") return <ZoneShellSkeleton label={t("loading")} />;
  if (state.status === "disabled" || state.status === "error") {
    return (
      <main className={PANEL_MAIN_CLASS}>
        {state.status === "error" ? (
          <FormError message={state.message} />
        ) : (
          <p className="text-body-sm font-semibold text-[var(--color-secondary)]">{t("soon_title")}</p>
        )}
      </main>
    );
  }

  const { zone, threads, nextCursor, loadingMore, switchingSort, contributors, pinnedThreads } = state;
  const isMember = zone.myStatus === "ACTIVE";
  const isQa = zone.type === "QA";

  return (
    <main className={PANEL_MAIN_CLASS}>
      <div className={PANEL_GRID_CLASS}>
        <div className="flex min-w-0 flex-col gap-5">
          <ZoneHeader
            zone={zone}
            people={contributors}
            tab={activeTab}
            onTab={onChangeTab}
            onJoined={(status: ZoneMemberStatus) => patchReady((r) => ({ ...r, zone: { ...r.zone, myStatus: status } }))}
            onLeft={() => patchReady((r) => ({ ...r, zone: { ...r.zone, myStatus: null, myRole: null } }))}
          />

          <div
            id={ZONE_TABPANEL_ID}
            role="tabpanel"
            aria-labelledby={`zone-tab-${activeTab}`}
            className="flex min-w-0 flex-col gap-5"
          >
          {activeTab === "about" ? (
            <ZoneAbout zone={zone} pinned={pinnedThreads} />
          ) : (
            <>
              {isMember || zone.canModerate ? (
                isQa ? (
                  <AskComposer zone={zone} />
                ) : (
                  <div className={COMMUNITY_CARD_FLUSH}>
                    <ThreadComposer
                      placeholder={t("compose_placeholder")}
                      submitLabel={t("compose_send")}
                      onSubmit={onPost}
                      zoneId={zone.id}
                      audience={zone}
                      allowPoll={zone.type === "CHAT" || (zone.type === "ANNOUNCEMENT" && zone.canModerate)}
                    />
                  </div>
                )
              ) : null}

              {switchingSort ? (
                <PostListSkeleton label={t("loading")} count={3} variant="card" />
              ) : threads.length === 0 ? (
                <p className={`${PANEL_CARD} px-6 py-10 text-center text-body-sm font-semibold text-[var(--color-secondary)]`}>
                  {isQa ? t("qa_empty") : t("feed_empty")}
                </p>
              ) : (
                <div className={`${COMMUNITY_CARD_FLUSH} ${isQa ? "divide-y divide-[var(--color-border)]" : ""}`}>
                  {isQa
                    ? threads.map((question) => <QuestionListItem key={question.id} question={question} />)
                    : threads.map((thread) => (
                        <CommunityPostCard
                          key={thread.id}
                          thread={thread}
                          onToggleReaction={(nextEmoji, previousEmoji) => onToggleReaction(thread.id, nextEmoji, previousEmoji)}
                          onToggleBookmark={(adding) => onToggleBookmark(thread.id, adding)}
                          canModerate={zone.canModerate}
                          onPin={(pinned) => onPinThread(thread.id, pinned)}
                          onDelete={() => onDeleteThread(thread.id)}
                          onReplyCountChange={(delta) =>
                            patchThread(thread.id, (th) => ({ ...th, commentCount: Math.max(0, th.commentCount + delta) }))
                          }
                          clickable
                        />
                      ))}
                </div>
              )}

              {nextCursor ? (
                loadingMore ? (
                  <PostListSkeleton label={t("loading")} count={2} />
                ) : (
                  <button type="button" onClick={() => void onLoadMore()} className={`${PANEL_QUIET_LINK} self-center`}>
                    {t("load_more")}
                  </button>
                )
              ) : null}
            </>
          )}
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-5" aria-label={t("zone_tab_about")}>
          <CommunityPresenceCard />
          <ZoneContributors people={contributors} />
        </aside>
      </div>
    </main>
  );
}

function ZoneContributors({ people }: { people: ForumPublicPerson[] }) {
  const t = useTranslations("community");
  if (people.length === 0) return null;
  return (
    <section className={`${PANEL_CARD} flex flex-col gap-1`} aria-labelledby="zone-contributors-title">
      <h2 id="zone-contributors-title" className={PANEL_CARD_TITLE}>
        {t("zone_contributors")}
      </h2>
      <div className={COMMUNITY_ROW_LIST}>
        {people.slice(0, 5).map((person) => (
          <Link
            key={person.id}
            href={{ pathname: "/community/member/[username]", params: { username: person.username } }}
            className="flex min-h-12 items-center gap-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]"
          >
            <AuthorAvatar name={person.displayName} src={person.avatarUrl} size={32} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-extrabold text-[var(--color-main)]">{person.displayName}</span>
              <span className="truncate text-caption font-semibold text-[var(--color-secondary)]">@{person.username}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ZoneAbout({ zone, pinned }: { zone: ZoneView; pinned: ForumThreadSummary[] }) {
  const t = useTranslations("community");
  return (
    <section className={`${PANEL_CARD} flex flex-col gap-5`} aria-labelledby="zone-about-title">
      <div className="flex flex-col gap-2">
        <h2 id="zone-about-title" className={PANEL_CARD_TITLE}>
          {t("zone_tab_about")}
        </h2>
        <p className="text-body-sm font-semibold text-[var(--color-body)]">{zone.description ?? t("zone_about_empty")}</p>
      </div>
      {pinned.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-extrabold text-[var(--color-main)]">{t("pinned_posts")}</h3>
          <div className={COMMUNITY_ROW_LIST}>
            {pinned.map((thread) => (
              <p key={thread.id} className="py-3 text-body-sm font-bold text-[var(--color-body)]">
                {thread.title ?? thread.bodyExcerpt}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
