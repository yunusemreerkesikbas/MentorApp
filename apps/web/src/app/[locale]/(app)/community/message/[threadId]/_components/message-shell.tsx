"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/form";
import { useRouter } from "@/i18n/navigation";
import { PANEL_CARD_TITLE, PANEL_GRID_CLASS, PANEL_MAIN_CLASS } from "@/components/panel/panel-styles";
import { communityReturnPlaceholderKey, parseCommunityReturnContext } from "@/lib/community-coach-bridge";
import { CommentRow } from "../../../_components/comment-row";
import { ThreadComposer } from "../../../[slug]/_components/thread-composer";
import { CommunityPostCard } from "../../../_components/community-post-card";
import { CommunityCoachBridge } from "../../../_components/community-coach-bridge";
import { PostDetailSkeleton } from "../../../_components/post-skeleton";
import { CommunityPresenceCard } from "../../../_components/community-presence";
import { COMMUNITY_CARD_FLUSH } from "../../../_components/community-row";
import { DetailCrumb } from "../../../_components/detail-crumb";
import { ZoneMiniCard } from "../../../_components/zone-mini-card";
import { useMessageDetail } from "./use-message-detail";
import { CommunityAnnouncementAd } from "./community-announcement-ad";

/**
 * Message detail (APP-017) on the panel frame: the post card, then one card with "N yorum", the
 * composer and the comments; the rail shows the post's room and who is studying now.
 */
export function MessageShell({ threadId }: { threadId: string }) {
  const t = useTranslations("community");
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const returnContext = parseCommunityReturnContext({
    composer: searchParams.get("composer"),
    intent: searchParams.get("intent"),
  });
  const { state, onToggleThreadReaction, onToggleThreadBookmark, onToggleCommentReaction, onToggleCommentBookmark, onComment, changeThreadReplyCount, appendQuickComment, changeCommentReplyCount } = useMessageDetail(threadId, returnContext);
  const [blockedAdThread, setBlockedAdThread] = useState<string | null>(null);

  if (state.status === "loading") return <PostDetailSkeleton label={t("loading")} />;
  if (state.status === "disabled") return <Centered>{t("soon_title")}</Centered>;
  if (state.status === "error") {
    return (
      <main className={PANEL_MAIN_CLASS}>
        <FormError message={state.message} />
      </main>
    );
  }

  const { thread, comments, zone } = state;
  const stopAd = () => setBlockedAdThread(thread.id);

  return (
    <main className={PANEL_MAIN_CLASS}
      onClickCapture={(event) => { if (event.target instanceof Element && event.target.closest("button")) stopAd(); }}
      onFocusCapture={(event) => { if (event.target instanceof Element && event.target.matches('input, textarea, [contenteditable]')) stopAd(); }}
      onChangeCapture={stopAd}>
      <h1 className="sr-only">{t("post_detail_title")}</h1>
      <DetailCrumb
        items={[
          { label: t("title"), href: "/community" },
          zone
            ? { label: zone.title, href: { pathname: "/community/[slug]", params: { slug: zone.slug } } }
            : null,
          { label: t("post_detail_title") },
        ]}
      />
      <div className={PANEL_GRID_CLASS}>
        <div className="flex min-w-0 flex-col gap-5">
          <div className={COMMUNITY_CARD_FLUSH}>
            <CommunityPostCard
              thread={thread}
              onToggleReaction={onToggleThreadReaction}
              onToggleBookmark={onToggleThreadBookmark}
              onReplyCountChange={changeThreadReplyCount}
              onReplyCreated={appendQuickComment}
              afterDelete={() =>
                router.replace(zone ? { pathname: "/community/[slug]", params: { slug: zone.slug } } : "/community")
              }
            />
          </div>

          <CommunityCoachBridge bridge={thread.coachBridge} />

          <section className={COMMUNITY_CARD_FLUSH} aria-labelledby="comments-title">
            <h2 id="comments-title" className={`${PANEL_CARD_TITLE} px-5 pt-5`}>
              {/* The thread's own count (replies included), the same number as on the post above. */}
              {t("comment_total", { count: thread.commentCount })}
            </h2>
            <ThreadComposer
              placeholder={
                returnContext
                  ? t(communityReturnPlaceholderKey(returnContext.intent))
                  : t("comment_placeholder")
              }
              submitLabel={t("comment_submit")}
              onSubmit={onComment}
              zoneId={thread.zoneId}
              focusOnMount={Boolean(returnContext)}
            />
            {comments.length > 0 ? (
              <div className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
                {comments.map((c) => (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    onToggleReaction={onToggleCommentReaction}
                    onToggleBookmark={onToggleCommentBookmark}
                    highlighted={c.id === highlightId}
                    zoneId={thread.zoneId}
                    onReplyCountChange={(delta) => changeCommentReplyCount(c.id, delta)}
                  />
                ))}
              </div>
            ) : null}
          </section>
          {blockedAdThread !== thread.id ? <CommunityAnnouncementAd key={thread.id} threadId={thread.id} context={state.adContext} /> : null}
        </div>
        <aside className="flex min-w-0 flex-col gap-5" aria-label={t("zone_context_title")}>
          {zone ? <ZoneMiniCard zone={zone} /> : null}
          <CommunityPresenceCard />
        </aside>
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[40vh] w-full max-w-2xl items-center justify-center px-5 py-8">
      <p style={{ color: "var(--color-secondary)" }}>{children}</p>
    </main>
  );
}
