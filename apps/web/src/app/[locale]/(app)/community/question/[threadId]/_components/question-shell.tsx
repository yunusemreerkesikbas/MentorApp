"use client";
import { NotebookPen, Users } from "lucide-react";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ModerationTargetType,
  type ForumCoachIntent,
  type QuestionDetail,
  type ZoneView,
} from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Chip } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { useAuth } from "@/lib/auth-context";
import { trackCoachEvent, trackCommunityEvent } from "@/lib/analytics";
import {
  communityReturnPlaceholderKey,
  parseCommunityReturnContext,
} from "@/lib/community-coach-bridge";
import {
  bookmarkPost,
  bookmarkThread,
  getQuestion,
  isForumDisabled,
  listZones,
  postAnswer,
  setHelpfulVote,
} from "@/lib/forum";
import { questionUrl } from "@/lib/forum-public";
import { ReportButton } from "../../../_components/report-button";
import { AttachmentGallery } from "../../../_components/attachment-gallery";
import { ForumMarkdown } from "../../../_components/forum-markdown";
import { HelpfulButton } from "../../../_components/helpful-button";
import { ForumImagePicker } from "../../../_components/forum-image-picker";
import { useForumImagePicker } from "../../../_components/use-forum-image-picker";
import { SendButton } from "../../../_components/send-button";
import { BookmarkButton } from "../../../_components/bookmark-button";
import { NotebookAddDialog } from "./notebook-add-dialog";
import { useMentionAutocomplete } from "../../../_components/use-mention-autocomplete";
import { MentionSuggestions } from "../../../_components/mention-suggestions";
import { EmojiPickerButton } from "../../../_components/EmojiPickerButton";
import { AcceptButton } from "./accept-button";
import { AnswerItem } from "./answer-item";
import { CommunityCoachBridge } from "../../../_components/community-coach-bridge";
import { PostDetailSkeleton } from "../../../_components/post-skeleton";

type State =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "error"; message: string }
  | { status: "ready"; detail: QuestionDetail; zone: ZoneView | null };

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
   * "I could not solve this either" — the community end of the notebook bridge. Kept as local
   * session state rather than read back from the server: the entry the dialog creates is the
   * student's own row in another bounded context, and re-fetching the whole thread to learn that
   * they just pressed a button they were standing in front of would be a round trip for nothing.
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
      setState((current) => {
        if (current.status !== "ready") return current;
        if (targetType === "THREAD") {
          const question = current.detail.question;
          return {
            ...current,
            detail: {
              ...current.detail,
              question: {
                ...question,
                myHelpfulVote: adding,
                helpfulVoteCount: Math.max(
                  0,
                  (question.helpfulVoteCount ?? 0) + (adding ? 1 : -1),
                ),
              },
            },
          };
        }
        return {
          ...current,
          detail: {
            ...current.detail,
            answers: current.detail.answers.map((answer) =>
              answer.id === targetId
                ? {
                    ...answer,
                    myHelpfulVote: adding,
                    helpfulVoteCount: Math.max(
                      0,
                      (answer.helpfulVoteCount ?? 0) + (adding ? 1 : -1),
                    ),
                  }
                : answer,
            ),
          },
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
      <main className="mx-auto w-full max-w-3xl px-5 py-8 lg:px-8">
        <FormError message={state.message} />
      </main>
    );
  }

  const { question, answers } = state.detail;
  const { zone } = state;
  const isAsker = user?.id === question.authorId;
  const canAccept = isAsker && question.status === "OPEN";
  // Share the anonymous page only once the question is actually indexable — ForumPublicService
  // requires at least one answer, so sharing earlier would hand out a 404 link.
  const sharePublicUrl = answers.length > 0 ? questionUrl(question.id) : undefined;
  const participantNames = Array.from(
    new Set([question.authorName, ...answers.map((answer) => answer.authorName)]),
  ).slice(0, 8);
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(question.createdAt),
  );

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-7 lg:px-8 lg:py-6">
      <nav aria-label={t("breadcrumb_label")} className="flex min-h-11 flex-wrap items-center gap-2 border-b border-[var(--color-border)] pb-4 text-[13px] text-[var(--color-secondary)]">
        <Link href="/community" className="font-semibold text-[var(--color-body)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">
          {t("title")}
        </Link>
        <span aria-hidden="true">›</span>
        {zone ? (
          <Link
            href={{ pathname: "/community/[slug]", params: { slug: zone.slug } }}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            {zone.title}
          </Link>
        ) : (
          <span>{t("type_qa")}</span>
        )}
        <span aria-hidden="true">›</span>
        <span aria-current="page" className="max-w-[24rem] truncate text-[var(--color-main)]">
          {question.title}
        </span>
      </nav>

      <div className="mt-5 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_304px]">
      <div className="min-w-0">
      <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)] sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <h1
            className="text-[24px] font-extrabold leading-[1.2] tracking-[-0.03em] text-[var(--color-main)] sm:text-[28px]"
          >
            {question.title ?? question.body.slice(0, 80)}
          </h1>
          {question.status === "ANSWERED" ? <Chip>{t("answered")}</Chip> : null}
        </div>
        <p className="mt-2 text-xs text-[var(--color-secondary)]">
          {when}
        </p>
        <div className="mt-5">
          <ForumMarkdown markdown={question.body} />
        </div>
        <AttachmentGallery attachments={question.attachments} />
        <div className="-ml-1.5 mt-3 flex items-center gap-1">
          <SendButton
            href={{
              pathname: "/community/question/[threadId]",
              params: { threadId: question.id },
            }}
            publicUrl={sharePublicUrl}
          />
          <BookmarkButton bookmarked={question.myBookmarked} onToggle={onToggleQuestionBookmark} />
          {/* Beside the bookmark on purpose, and clearly not the same thing: bookmarking keeps a
              question you liked, this one is the student saying they could not solve it either —
              which is what puts it on their own weakness map. */}
          <button
            type="button"
            disabled={notebookAdded}
            onClick={() => setNotebookOpen(true)}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-semibold outline-none transition-colors duration-150 hover:bg-[var(--color-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent motion-reduce:transition-none"
            style={{
              color: "var(--color-main)",
              border: "1px solid color-mix(in srgb, var(--color-main) 15%, transparent)",
            }}
          >
            <NotebookPen aria-hidden size={13} />
            {notebookAdded ? t("notebook_added") : t("notebook_add_action")}
          </button>
          <HelpfulButton
            count={question.helpfulVoteCount ?? 0}
            selected={question.myHelpfulVote ?? false}
            canVote={question.canHelpfulVote ?? true}
            onToggle={(adding) => onToggleHelpful("THREAD", question.id, adding)}
          />
          <ReportButton targetType={ModerationTargetType.THREAD} targetId={question.id} />
        </div>
        {question.tags?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {question.tags.slice(0, 3).map((tag) => (
              <span key={tag.id} className="rounded-full bg-[var(--community-coral-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--community-coral)]">
                #{tag.slug}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <CommunityCoachBridge bridge={question.coachBridge} />

      <h2 className="mb-3 mt-8 text-[20px] font-extrabold tracking-[-0.025em] text-[var(--color-main)]">
        {t("comment_total", { count: answers.length })}
      </h2>

      <div className="rounded-[13px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
        <AnswerComposer
          threadId={threadId}
          zoneId={question.zoneId}
          returnIntent={returnContext?.intent ?? null}
          onPosted={() => void load()}
        />
      </div>

      {answers.length === 0 ? (
        <p className="mt-5 py-6 text-sm text-[var(--color-secondary)]">{t("answers_empty")}</p>
      ) : (
        <div className="mt-5 flex flex-col gap-4 border-t border-[var(--color-border)] pt-5">
          {answers.map((a) => (
            <AnswerItem
              key={a.id}
              answer={a}
              shareHref={{
                pathname: "/community/question/[threadId]",
                params: { threadId: question.id },
              }}
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
          ))}
        </div>
      )}

      </div>
      <aside className="hidden border-l border-[var(--color-border)] pl-5 xl:block" aria-label={t("detail_context_title")}>
        <h2 className="flex items-center gap-2 text-[13px] font-extrabold text-[var(--color-secondary)]"><Users size={16} className="text-[var(--community-blue-ink)]" aria-hidden />{t("detail_participants")}</h2>
        <div className="mt-3 grid gap-1">
          {participantNames.map((name) => (
            <span key={name} className="min-h-11 rounded-[9px] px-3 py-3 text-sm font-semibold text-[var(--color-body-text)] hover:bg-[var(--color-surface)]">
              {name}
            </span>
          ))}
        </div>
      </aside>
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

/** Inline answer composer (kept local — not the chat ThreadComposer, to avoid cross-route coupling). */
function AnswerComposer({
  threadId,
  zoneId,
  onPosted,
  returnIntent,
}: {
  threadId: string;
  zoneId: string;
  onPosted: () => void;
  returnIntent: ForumCoachIntent | null;
}) {
  const t = useTranslations("community");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mention = useMentionAutocomplete(zoneId, textareaRef, setValue);
  const picker = useForumImagePicker();

  useEffect(() => {
    if (!returnIntent) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus({ preventScroll: true });
    textarea.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [returnIntent]);

  const send = async () => {
    const body = value.trim();
    if (!body) return;
    setBusy(true);
    picker.setError(null);
    try {
      const attachments = await picker.uploadAll();
      await postAnswer(threadId, body, attachments);
      trackCommunityEvent("forum_reply_created", { target: "thread", zone_type: "QA" });
      if (returnIntent) {
        trackCoachEvent("coach_community_return_reply_created", {
          intent: returnIntent,
          zone_type: "QA",
        });
      }
      setValue("");
      picker.reset();
      onPosted();
    } catch (err) {
      picker.setError(err instanceof ApiClientError ? err.body.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onSelect={mention.sync}
          onBlur={mention.close}
          onKeyDown={(e) => void mention.onKeyDown(e)}
          placeholder={
            returnIntent
              ? t(communityReturnPlaceholderKey(returnIntent))
              : t("answer_placeholder")
          }
          rows={3}
          maxLength={4000}
          className="min-h-[120px] w-full resize-y rounded-[10px] border border-[var(--color-border)] bg-[var(--color-soft)] p-4 text-[15px] leading-6 text-[var(--color-body-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          {...mention.inputProps}
        />
        <MentionSuggestions mention={mention} />
      </div>
      <div className="flex items-center justify-between">
        <EmojiPickerButton
          textareaRef={textareaRef}
          value={value}
          onValueChange={setValue}
          disabled={busy}
        />
        <span className="text-xs text-[var(--color-secondary)]">{value.length}/4000</span>
      </div>
      <ForumImagePicker picker={picker} disabled={busy} />
      <FormError message={picker.error} />
      <div className="flex justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={() => void send()}
          className="min-h-11 rounded-[10px] bg-[var(--community-blue)] px-5 text-sm font-bold text-white hover:bg-[var(--community-blue-hover)] disabled:opacity-50"
        >
          {busy ? t("answer_submitting") : t("answer_submit")}
        </button>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[40vh] w-full max-w-3xl items-center justify-center px-5 py-8">
      <p style={{ color: "var(--color-secondary)" }}>{children}</p>
    </main>
  );
}
