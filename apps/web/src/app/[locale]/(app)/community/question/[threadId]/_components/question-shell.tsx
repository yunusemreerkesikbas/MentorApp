"use client";
import { NotebookPen } from "lucide-react";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ModerationTargetType,
  type AnswerView,
  type QuestionDetail,
  type ZoneView,
} from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { FormError } from "@/components/form";
import {
  PANEL_CARD,
  PANEL_CARD_TITLE,
  PANEL_GRID_CLASS,
  PANEL_MAIN_CLASS,
} from "@/components/panel/panel-styles";
import { useAuth } from "@/lib/auth-context";
import { trackCommunityEvent } from "@/lib/analytics";
import { parseCommunityReturnContext } from "@/lib/community-coach-bridge";
import {
  bookmarkPost,
  bookmarkThread,
  getQuestion,
  isForumDisabled,
  listZones,
  setHelpfulVote,
} from "@/lib/forum";
import { questionUrl } from "@/lib/forum-public";
import { relativeTime } from "@/lib/relative-time";
import { ReportButton } from "../../../_components/report-button";
import { AttachmentGallery } from "../../../_components/attachment-gallery";
import { AuthorAvatar } from "../../../_components/author-avatar";
import { AuthorLink } from "../../../_components/author-link";
import { COMMUNITY_ROW_LIST } from "../../../_components/community-row";
import { DetailCrumb } from "../../../_components/detail-crumb";
import { ForumMarkdown } from "../../../_components/forum-markdown";
import { HelpfulButton } from "../../../_components/helpful-button";
import { QuestionStatusLabel } from "../../../_components/question-status-label";
import { questionStatus } from "../../../_components/question-status";
import { SendButton } from "../../../_components/send-button";
import { BookmarkButton } from "../../../_components/bookmark-button";
import { NotebookAddDialog } from "./notebook-add-dialog";
import { AcceptButton } from "./accept-button";
import { AnswerComposer } from "./answer-composer";
import { AnswerItem } from "./answer-item";
import { QuestionRail } from "./question-rail";
import { CommunityCoachBridge } from "../../../_components/community-coach-bridge";
import { PostDetailSkeleton } from "../../../_components/post-skeleton";

type State =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "error"; message: string }
  | { status: "ready"; detail: QuestionDetail; zone: ZoneView | null };

/**
 * A question on the panel frame: the question card, the answers card ("N cevap", the solution in a
 * green frame first), then "Sen de el uzat!"; the rail shows who is in it and other waiting questions.
 */
export function QuestionShell({ threadId }: { threadId: string }) {
  const t = useTranslations("community");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const returnContext = parseCommunityReturnContext({
    composer: searchParams.get("composer"),
    intent: searchParams.get("intent"),
  });
  const { user } = useAuth();
  const [state, setState] = useState<State>({ status: "loading" });
  /**
   * "Ben de takıldım": the community end of the notebook bridge. Kept as local session state rather
   * than read back from the server: the entry the dialog creates is the student's own row in another
   * bounded context, and re-fetching the whole thread to learn that they just pressed a button they
   * were standing in front of would be a round trip for nothing.
   */
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [notebookAdded, setNotebookAdded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [detail, zones] = await Promise.all([getQuestion(threadId), listZones()]);
      const zone = zones.items.find((entry) => entry.id === detail.question.zoneId) ?? null;
      setState({ status: "ready", detail, zone });
    } catch (err) {
      if (isForumDisabled(err)) return setState({ status: "disabled" });
      setState({
        status: "error",
        message: err instanceof ApiClientError ? err.body.message : t("error"),
      });
    }
  }, [threadId, t]);

  const onToggleQuestionBookmark = useCallback(
    (adding: boolean) => {
      setState((s) =>
        s.status === "ready"
          ? { ...s, detail: { ...s.detail, question: { ...s.detail.question, myBookmarked: adding } } }
          : s,
      );
      bookmarkThread(threadId, adding).catch(() =>
        setState((s) =>
          s.status === "ready"
            ? { ...s, detail: { ...s.detail, question: { ...s.detail.question, myBookmarked: !adding } } }
            : s,
        ),
      );
    },
    [threadId],
  );

  const onToggleAnswerBookmark = useCallback((postId: string, adding: boolean) => {
    const patch = (v: boolean) => (s: State): State =>
      s.status === "ready"
        ? {
            ...s,
            detail: {
              ...s.detail,
              answers: s.detail.answers.map((a) => (a.id === postId ? { ...a, myBookmarked: v } : a)),
            },
          }
        : s;
    setState(patch(adding));
    bookmarkPost(postId, adding).catch(() => setState(patch(!adding)));
  }, []);

  const onToggleHelpful = useCallback(
    (targetType: "THREAD" | "POST", targetId: string, adding: boolean) => {
      const bump = <T extends { helpfulVoteCount?: number }>(item: T) => ({
        ...item,
        myHelpfulVote: adding,
        helpfulVoteCount: Math.max(0, (item.helpfulVoteCount ?? 0) + (adding ? 1 : -1)),
      });
      setState((current) => {
        if (current.status !== "ready") return current;
        const { question, answers } = current.detail;
        return {
          ...current,
          detail:
            targetType === "THREAD"
              ? { ...current.detail, question: bump(question) }
              : { ...current.detail, answers: answers.map((a) => (a.id === targetId ? bump(a) : a)) },
        };
      });
      setHelpfulVote(targetType, targetId, adding).catch(() => void load());
    },
    [load],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [detail, zones] = await Promise.all([getQuestion(threadId), listZones()]);
        if (active) {
          const zone = zones.items.find((entry) => entry.id === detail.question.zoneId) ?? null;
          setState({ status: "ready", detail, zone });
          trackCommunityEvent("forum_thread_view", {
            zone_type: "QA",
            answered: detail.question.status === "ANSWERED",
          });
        }
      } catch (err) {
        if (!active) return;
        if (isForumDisabled(err)) setState({ status: "disabled" });
        else
          setState({
            status: "error",
            message: err instanceof ApiClientError ? err.body.message : t("error"),
          });
      }
    })();
    return () => {
      active = false;
    };
  }, [threadId, t]);

  if (state.status === "loading") return <PostDetailSkeleton label={t("loading")} />;
  if (state.status === "disabled") return <Centered>{t("soon_title")}</Centered>;
  if (state.status === "error") {
    return (
      <main className={PANEL_MAIN_CLASS}>
        <FormError message={state.message} />
      </main>
    );
  }

  const { question, answers } = state.detail;
  const { zone } = state;
  const canAccept = user?.id === question.authorId && question.status === "OPEN";
  // Share the anonymous page only once the question is actually indexable — ForumPublicService
  // requires at least one answer, so sharing earlier would hand out a 404 link.
  const sharePublicUrl = answers.length > 0 ? questionUrl(question.id) : undefined;
  const shareHref = {
    pathname: "/community/question/[threadId]",
    params: { threadId: question.id },
  } as const;
  const title = question.title ?? question.body.slice(0, 80);
  const accepted = answers.filter((a) => a.isAccepted);
  const others = answers.filter((a) => !a.isAccepted);

  const renderAnswer = (a: AnswerView) => (
    <AnswerItem
      key={a.id}
      answer={a}
      shareHref={shareHref}
      sharePublicUrl={sharePublicUrl}
      onToggleBookmark={(adding) => onToggleAnswerBookmark(a.id, adding)}
      onToggleHelpful={(adding) => onToggleHelpful("POST", a.id, adding)}
      accept={
        // Own answers are never acceptable (API rejects self-accept — XP farm guard).
        canAccept && !a.isAccepted && a.authorId !== user?.id ? (
          <AcceptButton threadId={threadId} postId={a.id} onAccepted={() => void load()} />
        ) : undefined
      }
      report={<ReportButton targetType={ModerationTargetType.POST} targetId={a.id} />}
    />
  );

  return (
    <main className={PANEL_MAIN_CLASS}>
      <DetailCrumb
        items={[
          { label: t("title"), href: "/community" },
          zone
            ? { label: zone.title, href: { pathname: "/community/[slug]", params: { slug: zone.slug } } }
            : { label: t("type_qa") },
          { label: title },
        ]}
      />
      <div className={PANEL_GRID_CLASS}>
        <div className="flex min-w-0 flex-col gap-5">
          <article className={`${PANEL_CARD} flex flex-col gap-3 sm:p-6`} aria-labelledby="question-title">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <QuestionStatusLabel
                status={questionStatus({ commentCount: answers.length, acceptedPostId: question.acceptedPostId })}
              />
              {question.tags?.slice(0, 3).map((tag) => (
                <span key={tag.id} className="text-caption font-bold text-[var(--color-secondary)]">
                  #{tag.slug}
                </span>
              ))}
            </div>
            <h1
              id="question-title"
              className="text-xl font-extrabold leading-snug tracking-[-0.01em] text-[var(--color-main)] sm:text-title"
            >
              {title}
            </h1>
            <div className="flex min-w-0 items-center gap-2.5">
              <AuthorLink username={question.authorUsername} className="shrink-0">
                <AuthorAvatar name={question.authorName} src={question.authorAvatarUrl} size={32} />
              </AuthorLink>
              <AuthorLink username={question.authorUsername} className="min-w-0 truncate hover:underline">
                <span className="text-body-sm font-extrabold text-[var(--color-main)]">
                  {question.authorName || t("unknown_author")}
                </span>
              </AuthorLink>
              <span className="min-w-0 truncate text-caption font-semibold text-[var(--color-secondary)]">
                {question.authorUsername ? `@${question.authorUsername} · ` : ""}
                {relativeTime(question.createdAt, locale)}
              </span>
            </div>
            <ForumMarkdown markdown={question.body} />
            <AttachmentGallery attachments={question.attachments} />
            <div className="-ml-2 flex flex-wrap items-center gap-1">
              {/* Not the bookmark: this is the student saying they are stuck on it too, which puts it
                  in their own mistake notebook (the dialog explains). */}
              <button
                type="button"
                disabled={notebookAdded}
                onClick={() => setNotebookOpen(true)}
                className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-3 text-caption font-extrabold text-[var(--color-main)] transition-colors duration-150 hover:bg-[var(--color-surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-default disabled:text-[var(--play-selected-ink)] disabled:hover:bg-transparent motion-reduce:transition-none"
              >
                <NotebookPen aria-hidden size={16} />
                {notebookAdded ? t("notebook_added") : t("notebook_add_action")}
              </button>
              <HelpfulButton
                count={question.helpfulVoteCount ?? 0}
                selected={question.myHelpfulVote ?? false}
                canVote={question.canHelpfulVote ?? true}
                onToggle={(adding) => onToggleHelpful("THREAD", question.id, adding)}
              />
              <SendButton href={shareHref} publicUrl={sharePublicUrl} />
              <BookmarkButton bookmarked={question.myBookmarked} onToggle={onToggleQuestionBookmark} />
              <span className="ml-auto">
                <ReportButton targetType={ModerationTargetType.THREAD} targetId={question.id} />
              </span>
            </div>
          </article>

          <CommunityCoachBridge bridge={question.coachBridge} />

          <section className={`${PANEL_CARD} flex flex-col gap-2`} aria-labelledby="answers-title">
            <h2 id="answers-title" className={PANEL_CARD_TITLE}>
              {answers.length > 0 ? t("status_answers", { count: answers.length }) : t("status_waiting")}
            </h2>
            {answers.length === 0 ? (
              <p className="text-body-sm font-semibold text-[var(--color-secondary)]">{t("answers_empty")}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {accepted.map(renderAnswer)}
                {others.length > 0 ? <div className={COMMUNITY_ROW_LIST}>{others.map(renderAnswer)}</div> : null}
              </div>
            )}
          </section>

          <AnswerComposer
            threadId={threadId}
            zoneId={question.zoneId}
            returnIntent={returnContext?.intent ?? null}
            onPosted={() => void load()}
          />
        </div>
        <QuestionRail question={question} answers={answers} />
      </div>

      {notebookOpen ? (
        <NotebookAddDialog
          threadId={threadId}
          onAdded={() => {
            setNotebookAdded(true);
            setNotebookOpen(false);
          }}
          onClose={() => setNotebookOpen(false)}
        />
      ) : null}
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
