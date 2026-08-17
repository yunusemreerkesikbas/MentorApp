"use client";
import { CalendarDays, Check, Copy, RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { Button, DataCard, Skeleton, SkeletonGroup } from "@mentor/ui";
import {
  CoachActionStatus,
  type CoachActionStatus as CoachActionStatusValue,
  type CoachActionDto,
  type CoachConversationOriginDto,
  type CoachPersonalizationDto,
  type CountdownDto,
  type ForumCoachBridgeView,
} from "@mentor/types";
import { Link } from "@/i18n/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { FormError } from "@/components/form";
import { SuggestedTaskCard } from "@/components/suggested-task-card";
import type { CoachSource } from "@/lib/coach";
import {
  chatBubbleAnimate,
  chatBubbleInitial,
  chatBubbleTransition,
} from "@/lib/stagger-motion";
import { CoachReplyBody } from "./coach-reply-body";
import { ExpandableBubbleContent } from "./expandable-bubble-content";
import { CommunitySourceCard } from "./community-source-card";
import { CoachPersonalizationContext } from "./coach-personalization-context";
import { CoachActionCard } from "./coach-action-card";

/** px from bottom — closer than this counts as “at bottom”. */
const NEAR_BOTTOM_PX = 80;

export interface ChatMessage {
  id: string;
  role: "user" | "coach";
  text: string;
  sources?: CoachSource[];
  /** Verified official date card persisted with deterministic replies. */
  officialCountdown?: CountdownDto;
  /** Coach-suggested plan task → "Plana ekle" card (persisted with the reply). */
  suggestedTask?: { title: string; subject: string | null };
  /** PII-minimal context snapshot available when this reply was generated. */
  personalization?: CoachPersonalizationDto;
  action?: CoachActionDto;
  actionStatus?: CoachActionStatusValue;
  /** 👍 = 1, 👎 = -1, null = none (COACH rows only; undefined on optimistic/streaming rows). */
  feedback?: number | null;
}

/**
 * Chat transcript for /coach/chat. Empty state is owned by the parent (landing).
 */
export function CoachTranscript({
  messages,
  busy,
  error,
  emptyContent,
  onFeedback,
  onRegenerate,
  onActionStatusChange,
  streamingMessageId = null,
  conversationOrigin,
  communitySource,
  activeConversationId,
  historyStatus,
  historyError,
  hasOlderMessages,
  loadingOlderMessages,
  olderMessagesError,
  onRetryHistory,
  onNewChat,
  onLoadOlder,
  onAwayFromBottomChange,
  scrollToBottomRef,
}: {
  messages: ChatMessage[];
  busy: boolean;
  error: string | null;
  /** Rendered when there are no messages (new-chat landing). */
  emptyContent?: ReactNode;
  /** Rate a coach reply (👍/👎/toggle-off). Undefined disables the control (e.g. while streaming). */
  onFeedback?: (id: string, value: 1 | -1 | null) => void;
  /** Regenerate the LAST coach reply (spends like a normal message). Undefined hides the control. */
  onRegenerate?: () => void;
  onActionStatusChange?: (id: string, status: CoachActionStatusValue) => void;
  /** Id of the coach row currently receiving SSE deltas (null when idle). */
  streamingMessageId?: string | null;
  conversationOrigin: CoachConversationOriginDto | null;
  communitySource: ForumCoachBridgeView | null;
  /** Required to create a server-attributed community plan task. */
  activeConversationId: string | null;
  historyStatus: "idle" | "loading" | "ready" | "error";
  historyError: string | null;
  hasOlderMessages: boolean;
  loadingOlderMessages: boolean;
  olderMessagesError: string | true | null;
  onRetryHistory: () => void;
  onNewChat: () => void;
  onLoadOlder: () => Promise<void>;
  /** Fires when the user leaves / returns to the bottom of the log. */
  onAwayFromBottomChange?: (away: boolean) => void;
  /** Parent assigns `scrollToBottom` for the jump-down control. */
  scrollToBottomRef?: RefObject<(() => void) | null>;
}) {
  const reduceMotion = useReducedMotion();
  const translate = useTranslations("coach_chat");
  const stateText = useTranslations("coach.chat");
  const bottomRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const awayRef = useRef(false);
  const onAwayRef = useRef(onAwayFromBottomChange);
  // Latest-callback ref: written after commit, not during render (refs are off-limits in render).
  // Scroll handlers only fire after the commit, so they never see a stale callback.
  useEffect(() => {
    onAwayRef.current = onAwayFromBottomChange;
  });
  const newestMessageId = messages.at(-1)?.id;
  const newestRole = messages.at(-1)?.role;

  useEffect(() => {
    if (!scrollToBottomRef) return;
    scrollToBottomRef.current = () => {
      stickToBottomRef.current = true;
      if (awayRef.current) {
        awayRef.current = false;
        onAwayRef.current?.(false);
      }
      bottomRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "end",
      });
    };
    return () => {
      scrollToBottomRef.current = null;
    };
  }, [scrollToBottomRef, reduceMotion]);

  useEffect(() => {
    const el = logRef.current;
    if (!el) return;

    const sync = () => {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      const near = gap <= NEAR_BOTTOM_PX;
      stickToBottomRef.current = near;
      const away = !near && messages.length > 0;
      if (away !== awayRef.current) {
        awayRef.current = away;
        onAwayRef.current?.(away);
      }
    };

    sync();
    el.addEventListener("scroll", sync, { passive: true });
    return () => el.removeEventListener("scroll", sync);
  }, [messages.length]);

  useEffect(() => {
    // Stay glued at the live tip; don't yank if the user scrolled up.
    // Always follow when the newest row is the user's own send.
    if (!stickToBottomRef.current && newestRole !== "user") return;
    stickToBottomRef.current = true;
    if (awayRef.current) {
      awayRef.current = false;
      onAwayRef.current?.(false);
    }
    bottomRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "end",
    });
  }, [newestMessageId, busy, reduceMotion, newestRole]);

  const isEmpty =
    historyStatus !== "loading" &&
    historyStatus !== "error" &&
    messages.length === 0 &&
    !busy;

  async function loadOlder() {
    const log = logRef.current;
    const previousHeight = log?.scrollHeight ?? 0;
    const previousScroll = log?.scrollTop ?? 0;
    await onLoadOlder();
    window.requestAnimationFrame(() => {
      if (!log) return;
      const addedHeight = log.scrollHeight - previousHeight;
      log.scrollTop = previousScroll + addedHeight;
    });
  }
  // ↻ appears only under the newest coach reply — older ones are history, not candidates.
  const lastCoachId = [...messages]
    .reverse()
    .find((m) => m.role === "coach")?.id;

  return (
    <div
      ref={logRef}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label={translate("transcript_label")}
      className={
        isEmpty
          ? "relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden"
          : "relative z-[1] flex min-h-0 flex-1 flex-col overflow-y-auto mentor-scrollarea"
      }
    >
      <div
        className={
          isEmpty
            ? "mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col overflow-hidden px-5 pb-1 pt-4 lg:pt-20"
            : "mx-auto flex w-full max-w-2xl flex-col gap-2.5 px-5 pb-3 pt-4 lg:pt-20"
        }
      >
      {historyStatus === "loading" ? (
        <SkeletonGroup
          label={stateText("history_loading")}
          className="flex flex-col gap-3 py-6"
        >
          <Skeleton className="h-12 w-3/5 rounded-[var(--radius-card)]" />
          <Skeleton className="ml-auto h-12 w-2/5 rounded-[var(--radius-card)]" />
          <Skeleton className="h-12 w-1/2 rounded-[var(--radius-card)]" />
        </SkeletonGroup>
      ) : null}

      {historyStatus === "error" ? (
        <div className="my-auto flex flex-col items-center gap-3 py-12 text-center">
          <FormError message={historyError ?? stateText("history_error")} />
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={onRetryHistory}>
              {stateText("history_retry")}
            </Button>
            <Button type="button" variant="secondary" onClick={onNewChat}>
              {stateText("history_new_chat")}
            </Button>
          </div>
        </div>
      ) : null}

      {historyStatus === "ready" &&
      (hasOlderMessages || olderMessagesError) ? (
        <div className="flex flex-col items-center gap-2">
          {olderMessagesError ? (
            <FormError
              message={
                typeof olderMessagesError === "string"
                  ? olderMessagesError
                  : stateText("older_history_error")
              }
            />
          ) : null}
          <Button
            type="button"
            variant="secondary"
            disabled={loadingOlderMessages}
            onClick={() => void loadOlder()}
          >
            {stateText("load_older")}
          </Button>
        </div>
      ) : null}
      <CommunitySourceCard origin={conversationOrigin} source={communitySource} />
      {isEmpty ? (emptyContent ?? null) : null}

      {messages.map((m) =>
        m.role === "user" ? (
          <MessageBubble
            key={m.id}
            message={m}
            reduceMotion={reduceMotion}
          />
        ) : (
          <div key={m.id} className="flex flex-col gap-1.5">
            <MessageBubble
              message={m}
              reduceMotion={reduceMotion}
              isStreaming={streamingMessageId === m.id}
            />
            {m.personalization && streamingMessageId !== m.id ? (
              <CoachPersonalizationContext
                personalization={m.personalization}
              />
            ) : null}
            {m.officialCountdown ? (
              <OfficialCountdownCard countdown={m.officialCountdown} />
            ) : null}
            {m.suggestedTask && !m.action ? (
              <SuggestedTaskCard
                task={m.suggestedTask}
                className="flex justify-start"
                communityContext={
                  conversationOrigin?.type === "COMMUNITY_THREAD" &&
                  activeConversationId &&
                  (communitySource?.zone.type === "CHAT" ||
                    communitySource?.zone.type === "QA")
                    ? {
                        intent: conversationOrigin.meta.intent,
                        zoneType: communitySource.zone.type,
                        conversationId: activeConversationId,
                      }
                    : undefined
                }
              />
            ) : null}
            {m.action && m.actionStatus && onActionStatusChange ? (
              <div className="flex justify-start">
                <CoachActionCard
                  messageId={m.id}
                  action={m.action}
                  status={m.actionStatus}
                  onStatusChange={(status) => onActionStatusChange(m.id, status)}
                />
              </div>
            ) : null}
            {m.sources ? <SourceChips sources={m.sources} /> : null}
            {onFeedback && streamingMessageId !== m.id ? (
              <FeedbackRow
                value={m.feedback ?? null}
                onRate={(v) => onFeedback(m.id, v)}
                text={m.text}
                onRegenerate={
                  m.id === lastCoachId &&
                  !busy &&
                  m.actionStatus !== CoachActionStatus.ACCEPTED &&
                  m.actionStatus !== CoachActionStatus.COMPLETED
                    ? onRegenerate
                    : undefined
                }
              />
            ) : null}
          </div>
        ),
      )}

      {busy && !streamingMessageId ? (
        <TypingBubble reduceMotion={reduceMotion} />
      ) : null}

      {error ? <FormError message={error} /> : null}

      <div ref={bottomRef} />
      </div>
    </div>
  );
}

function OfficialCountdownCard({ countdown }: { countdown: CountdownDto }) {
  const translate = useTranslations("coach_chat");

  return (
    <div className="flex justify-start">
      <DataCard
        className="w-full max-w-[85%]"
        label={translate("official_card_label")}
        value={translate("official_card_days", {
          count: countdown.daysRemaining,
        })}
        caption={`${countdown.examName} · ${countdown.examDateLabel}`}
        icon={
          <CalendarDays
            className="size-7"
            style={{ color: "var(--color-progress)" }}
            aria-hidden
          />
        }
        source={{
          label: countdown.source,
          url: countdown.sourceUrl,
          prefix: translate("source_label"),
        }}
      />
    </div>
  );
}
function MessageBubble({
  message,
  reduceMotion,
  isStreaming = false,
}: {
  message: ChatMessage;
  reduceMotion: boolean | null;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";
  return (
    <motion.div
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
      initial={reduceMotion ? false : isUser ? chatBubbleInitial : { opacity: 0 }}
      animate={chatBubbleAnimate}
      transition={
        reduceMotion
          ? { duration: 0 }
          : isUser
            ? chatBubbleTransition
            : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
      }
    >
      <div
        className={`max-w-[100%] rounded-[var(--radius-card)] px-3.5 py-2 text-[15px] leading-relaxed ${
          isUser ? "whitespace-pre-wrap text-white" : ""
        }`}
        style={{
          fontFamily: "var(--font-body)",
          ...(isUser
            ? { backgroundColor: "var(--color-progress)" }
            : { color: "var(--color-body)" }),
        }}
      >
        {isUser ? (
          <ExpandableBubbleContent
            contentKey={`${message.id}:${message.text}`}
            fadeFromClassName="from-[var(--color-progress)]"
            toggleClassName="text-white"
          >
            {message.text}
          </ExpandableBubbleContent>
        ) : (
          <CoachReplyBody
            text={message.text}
            isStreaming={isStreaming}
            reduceMotion={reduceMotion}
          />
        )}
      </div>
    </motion.div>
  );
}

/** 👍/👎 + copy on a coach reply — toggling the active rating clears it. Optimistic; parent persists. */
function FeedbackRow({
  value,
  onRate,
  text,
  onRegenerate,
}: {
  value: number | null;
  onRate: (v: 1 | -1 | null) => void;
  text: string;
  onRegenerate?: () => void;
}) {
  const translate = useTranslations("coach_chat");
  const [copied, setCopied] = useState(false);
  const base =
    "inline-flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_5%,transparent)] focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none";

  function copyReply() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex justify-start gap-1">
      <button
        type="button"
        aria-label={translate("feedback_up")}
        aria-pressed={value === 1}
        onClick={() => onRate(value === 1 ? null : 1)}
        className={base}
        style={{
          color:
            value === 1 ? "var(--color-progress)" : "var(--color-secondary)",
        }}
      >
        <ThumbsUp className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={translate("feedback_down")}
        aria-pressed={value === -1}
        onClick={() => onRate(value === -1 ? null : -1)}
        className={base}
        style={{
          color: value === -1 ? "var(--color-main)" : "var(--color-secondary)",
        }}
      >
        <ThumbsDown className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={translate(copied ? "copied" : "copy")}
        onClick={copyReply}
        className={base}
        style={{
          color: copied ? "var(--color-progress)" : "var(--color-secondary)",
        }}
      >
        {copied ? (
          <Check className="size-4" aria-hidden />
        ) : (
          <Copy className="size-4" aria-hidden />
        )}
      </button>
      {onRegenerate ? (
        <button
          type="button"
          aria-label={translate("regenerate")}
          onClick={onRegenerate}
          className={base}
          style={{ color: "var(--color-secondary)" }}
        >
          <RefreshCw className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function SourceChips({ sources }: { sources: CoachSource[] }) {
  const translate = useTranslations("coach_chat");
  if (sources.length === 0) return null;
  return (
    <div className="flex justify-start">
      <div className="flex max-w-[85%] flex-wrap gap-2">
        <span
          className="self-center text-xs"
          style={{ color: "var(--color-secondary)" }}
        >
          {translate("source_label")}
        </span>
        {sources.map((s) => (
          <Link
            key={s.slug}
            href={{
              pathname: "/knowledge/[slug]",
              params: { slug: s.slug },
            }}
            className="min-h-8 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_50%,transparent)] px-3 py-1 text-xs font-bold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            style={{
              color: "var(--color-chip-text)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            {s.title}
          </Link>
        ))}
      </div>
    </div>
  );
}

function TypingBubble({ reduceMotion }: { reduceMotion: boolean | null }) {
  const translate = useTranslations("coach_chat");
  return (
    <motion.div
      className="flex justify-start"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={chatBubbleAnimate}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
      }
    >
      <div
        className="rounded-[var(--radius-card)] px-3.5 py-2"
        aria-label={translate("typing")}
      >
        <span
          className="inline-flex gap-1"
          style={{ color: "var(--color-secondary)" }}
        >
          {[0, 0.2, 0.4].map((delay, i) => (
            <motion.span
              key={i}
              aria-hidden
              animate={
                reduceMotion ? { opacity: 0.6 } : { opacity: [0.3, 1, 0.3] }
              }
              transition={
                reduceMotion
                  ? undefined
                  : {
                      duration: 1.2,
                      repeat: Infinity,
                      delay,
                      ease: "easeInOut",
                    }
              }
            >
              •
            </motion.span>
          ))}
        </span>
      </div>
    </motion.div>
  );
}
