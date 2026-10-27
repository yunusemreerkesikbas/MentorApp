"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { QuestionDetail, ZoneView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { trackCommunityEvent } from "@/lib/analytics";
import { bookmarkPost, bookmarkThread, getQuestion, isForumDisabled, listZones, setHelpfulVote } from "@/lib/forum";

type State =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "error"; message: string }
  | { status: "ready"; detail: QuestionDetail; zone: Pick<ZoneView, "id" | "title" | "slug"> | null };

export function useQuestionDetail(threadId: string) {
  const t = useTranslations("community");
  const [state, setState] = useState<State>({ status: "loading" });
  const load = useCallback(async () => {
    try {
      const [detail, zones] = await Promise.all([getQuestion(threadId), listZones()]);
      const zone = detail.pageContext?.zone ?? zones.items.find((entry) => entry.id === detail.question.zoneId) ?? null;
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
          const zone = detail.pageContext?.zone ?? zones.items.find((entry) => entry.id === detail.question.zoneId) ?? null;
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

  return { state, load, onToggleQuestionBookmark, onToggleAnswerBookmark, onToggleHelpful };
}
