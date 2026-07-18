"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ModerationTargetType, type QuestionDetail } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, Chip } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { useAuth } from "@/lib/auth-context";
import { bookmarkPost, bookmarkThread, getQuestion, isForumDisabled, postAnswer } from "@/lib/forum";
import { ReportButton } from "../../../_components/report-button";
import { AttachmentGallery } from "../../../_components/attachment-gallery";
import { MentionText } from "../../../_components/mention-text";
import { ForumImagePicker } from "../../../_components/forum-image-picker";
import { useForumImagePicker } from "../../../_components/use-forum-image-picker";
import { SendButton } from "../../../_components/send-button";
import { BookmarkButton } from "../../../_components/bookmark-button";
import { useMentionAutocomplete } from "../../../_components/use-mention-autocomplete";
import { MentionSuggestions } from "../../../_components/mention-suggestions";
import { AcceptButton } from "./accept-button";
import { AnswerItem } from "./answer-item";

type State =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "error"; message: string }
  | { status: "ready"; detail: QuestionDetail };

export function QuestionShell({ threadId }: { threadId: string }) {
  const t = useTranslations("topluluk");
  const locale = useLocale();
  const { user } = useAuth();
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(async () => {
    try {
      const detail = await getQuestion(threadId);
      setState({ status: "ready", detail });
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

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const detail = await getQuestion(threadId);
        if (active) setState({ status: "ready", detail });
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

  if (state.status === "loading") return <Centered>{t("loading")}</Centered>;
  if (state.status === "disabled") return <Centered>{t("soon_title")}</Centered>;
  if (state.status === "error") {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-8 lg:px-8">
        <FormError message={state.message} />
      </main>
    );
  }

  const { question, answers } = state.detail;
  const isAsker = user?.id === question.authorId;
  const canAccept = isAsker && question.status === "OPEN";
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(question.createdAt),
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 lg:px-8 lg:py-10">
      <Link
        href="/topluluk"
        className="flex items-center gap-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{ color: "var(--color-secondary)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
        {t("back")}
      </Link>

      <Card className="mt-3">
        <div className="flex items-start justify-between gap-3">
          <h1
            className="text-xl font-bold"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            {question.title ?? question.body.slice(0, 80)}
          </h1>
          {question.status === "ANSWERED" ? <Chip>{t("answered")}</Chip> : null}
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--color-secondary)" }}>
          {when}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-base" style={{ color: "var(--color-main)" }}>
          <MentionText text={question.body} />
        </p>
        <AttachmentGallery attachments={question.attachments} />
        <div className="-ml-1.5 mt-3 flex items-center gap-1">
          <SendButton path={`/topluluk/soru/${question.id}`} />
          <BookmarkButton bookmarked={question.myBookmarked} onToggle={onToggleQuestionBookmark} />
          <ReportButton targetType={ModerationTargetType.THREAD} targetId={question.id} />
        </div>
      </Card>

      <h2
        className="mt-8 mb-4 text-lg font-semibold"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        {t("answers_title")}
      </h2>

      {answers.length === 0 ? (
        <p style={{ color: "var(--color-secondary)" }}>{t("answers_empty")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {answers.map((a) => (
            <AnswerItem
              key={a.id}
              answer={a}
              shareHref={`/topluluk/soru/${question.id}`}
              onToggleBookmark={(adding) => onToggleAnswerBookmark(a.id, adding)}
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

      <div className="mt-6">
        <AnswerComposer threadId={threadId} zoneId={question.zoneId} onPosted={() => void load()} />
      </div>
    </main>
  );
}

/** Inline answer composer (kept local — not the chat ThreadComposer, to avoid cross-route coupling). */
function AnswerComposer({
  threadId,
  zoneId,
  onPosted,
}: {
  threadId: string;
  zoneId: string;
  onPosted: () => void;
}) {
  const t = useTranslations("topluluk");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mention = useMentionAutocomplete(zoneId, textareaRef, setValue);
  const picker = useForumImagePicker();

  const send = async () => {
    const body = value.trim();
    if (!body) return;
    setBusy(true);
    picker.setError(null);
    try {
      const attachments = await picker.uploadAll();
      await postAnswer(threadId, body, attachments);
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
          placeholder={t("answer_placeholder")}
          rows={3}
          maxLength={4000}
          className="w-full resize-y rounded-[var(--radius-card)] border border-white bg-white/70 p-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-body)" }}
          {...mention.inputProps}
        />
        <MentionSuggestions mention={mention} />
      </div>
      <ForumImagePicker picker={picker} disabled={busy} />
      <FormError message={picker.error} />
      <div className="flex justify-end">
        <Button busy={busy} onClick={() => void send()}>
          {busy ? t("answer_submitting") : t("answer_submit")}
        </Button>
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
