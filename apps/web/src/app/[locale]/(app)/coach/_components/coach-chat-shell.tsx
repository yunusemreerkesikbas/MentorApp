"use client";

import { useEffect, useRef, useState } from "react";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left.mjs";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { CoachAccessMode } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Link } from "@/i18n/navigation";
import {
  CoachStreamError,
  removeCoachContextFromUrl,
  resolvePendingCoachContext,
  setCoachMessageFeedback,
  streamCoachMessage,
  streamRegenerate,
} from "@/lib/coach";
import { useCoachAccess } from "./coach-access-shell";
import { useCoachSession } from "./coach-session-context";
import { CoachComposer } from "./coach-composer";
import { CoachTranscript, type ChatMessage } from "./coach-transcript";

const newId = () => globalThis.crypto.randomUUID();

/** Show the calm remaining-messages hint only when the allowance is nearly spent. */
const REMAINING_HINT_THRESHOLD = 5;

/**
 * /coach/chat — back header, transcript, sticky composer. Session state from layout provider.
 */
export function CoachChatShell() {
  const tCoach = useTranslations("coach");
  const tChat = useTranslations("coach.chat");
  const access = useCoachAccess()!;
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const {
    messages,
    activeConversationId,
    appendMessage,
    updateMessage,
    removeMessage,
    openConversation,
    startNewChat,
    adoptConversation,
    refreshConversations,
  } = useCoachSession();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // Message COUNT only — never coin amounts inside the chat zone (§4 #3). Decremented locally.
  const [remaining, setRemaining] = useState<number | null>(() =>
    access.mode === CoachAccessMode.PREMIUM
      ? (access.dailyMessagesRemaining ?? null)
      : access.mode === CoachAccessMode.COIN
        ? (access.freeCoinMessagesRemainingToday ?? null)
        : null,
  );
  const [streamStarted, setStreamStarted] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  // Ephemeral follow-up chips from the LATEST reply only — never persisted, gone on reload.
  const [followUps, setFollowUps] = useState<string[]>([]);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const seedAppliedRef = useRef(false);
  const appliedContextMockExamIdRef = useRef<string | null>(null);
  const appliedContextArticleSlugRef = useRef<string | null>(null);

  const seed = searchParams.get("seed");
  const contextMockExamId = searchParams.get("contextMockExamId");
  const contextArticleSlug = searchParams.get("contextArticleSlug");
  // `?c=<id>` opens an existing thread; no param means a fresh chat.
  const routeConversationId = searchParams.get("c");
  const appliedRouteRef = useRef<string | null | undefined>(undefined);

  // React to ROUTE changes only — adopting the id of a freshly created thread must not reset it.
  useEffect(() => {
    if (appliedRouteRef.current === routeConversationId) return;
    appliedRouteRef.current = routeConversationId;
    if (routeConversationId) void openConversation(routeConversationId);
    else startNewChat();
  }, [routeConversationId, openConversation, startNewChat]);

  useEffect(() => {
    if (seedAppliedRef.current || !seed) return;
    seedAppliedRef.current = true;
    setInput(seed);
    composerRef.current?.focus();
  }, [seed]);

  const subtitle =
    access.mode === CoachAccessMode.COIN
      ? tCoach("subtitle_coin")
      : tCoach("subtitle_premium");

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setChatError(null);
    setInput("");
    setFollowUps([]);

    const wasNewChat = activeConversationId === null;
    const pendingContextMockExamId = resolvePendingCoachContext(
      contextMockExamId,
      appliedContextMockExamIdRef.current,
    );
    const pendingContextArticleSlug = resolvePendingCoachContext(
      contextArticleSlug,
      appliedContextArticleSlugRef.current,
    );
    const clientMessageId = newId();
    const userMessage: ChatMessage = {
      id: clientMessageId,
      role: "user",
      text: trimmed,
    };
    appendMessage(userMessage);

    setBusy(true);
    const coachMessageId = newId();
    let received = "";
    try {
      const {
        reply,
        sources,
        suggestedTask,
        officialCountdown,
        followUps: nextFollowUps,
        conversationId,
        model,
      } = await streamCoachMessage(
        trimmed,
        clientMessageId,
        (delta) => {
          if (received === "") {
            setStreamStarted(true);
            appendMessage({ id: coachMessageId, role: "coach", text: delta });
          } else {
            updateMessage(coachMessageId, { text: received + delta });
          }
          received += delta;
        },
        activeConversationId ?? undefined,
        pendingContextMockExamId,
        pendingContextArticleSlug,
      );
      // Finalize with the authoritative reply + source chips (covers zero-delta fallbacks too).
      if (received === "") {
        appendMessage({
          id: coachMessageId,
          role: "coach",
          text: reply,
          sources,
          suggestedTask,
          officialCountdown,
        });
      } else {
        updateMessage(coachMessageId, {
          text: reply,
          sources,
          suggestedTask,
          officialCountdown,
        });
      }
      setFollowUps(nextFollowUps ?? []);

      if (pendingContextMockExamId || pendingContextArticleSlug) {
        if (pendingContextMockExamId) {
          appliedContextMockExamIdRef.current = pendingContextMockExamId;
        }
        if (pendingContextArticleSlug) {
          appliedContextArticleSlugRef.current = pendingContextArticleSlug;
        }
        window.history.replaceState(
          window.history.state,
          "",
          removeCoachContextFromUrl(window.location.href),
        );
      }

      // A brand-new chat just became a real thread — adopt its id and refresh the hub list.
      if (wasNewChat) {
        adoptConversation(conversationId);
      }
      void refreshConversations();
      if (model !== "verified-content") {
        setRemaining((r) => (r === null ? null : Math.max(0, r - 1)));
      }
    } catch (err) {
      if (received !== "") removeMessage(coachMessageId);
      setChatError(
        err instanceof CoachStreamError
          ? tChat("stream_error")
          : err instanceof ApiClientError
            ? err.body.message
            : err instanceof Error
              ? err.message
              : String(err),
      );
    } finally {
      setBusy(false);
      setStreamStarted(false);
      composerRef.current?.focus();
    }
  }

  async function regenerate() {
    if (busy || !activeConversationId) return;
    const lastCoach = [...messages].reverse().find((m) => m.role === "coach");
    if (!lastCoach) return;

    setChatError(null);
    setFollowUps([]);
    setBusy(true);
    // Old reply stays visible until the first delta; a failure restores this snapshot.
    updateMessage(lastCoach.id, {
      sources: undefined,
      suggestedTask: undefined,
      officialCountdown: undefined,
      feedback: null,
    });
    let received = "";
    try {
      const {
        reply,
        sources,
        suggestedTask,
        officialCountdown,
        followUps: nextFollowUps,
        model,
      } = await streamRegenerate(activeConversationId, (delta) => {
        received += delta;
        setStreamStarted(true);
        updateMessage(lastCoach.id, { text: received });
      });
      updateMessage(lastCoach.id, {
        text: reply,
        sources,
        suggestedTask,
        officialCountdown,
        feedback: null,
      });
      setFollowUps(nextFollowUps ?? []);
      if (model !== "verified-content") {
        setRemaining((r) => (r === null ? null : Math.max(0, r - 1)));
      }
    } catch (err) {
      updateMessage(lastCoach.id, {
        text: lastCoach.text,
        sources: lastCoach.sources,
        suggestedTask: lastCoach.suggestedTask,
        officialCountdown: lastCoach.officialCountdown,
        feedback: lastCoach.feedback ?? null,
      });
      setChatError(
        err instanceof CoachStreamError
          ? tChat("stream_error")
          : err instanceof ApiClientError
            ? err.body.message
            : err instanceof Error
              ? err.message
              : String(err),
      );
    } finally {
      setBusy(false);
      setStreamStarted(false);
    }
  }

  function rateMessage(id: string, value: 1 | -1 | null) {
    const previous = messages.find((m) => m.id === id)?.feedback ?? null;
    updateMessage(id, { feedback: value }); // optimistic
    void setCoachMessageFeedback(id, value).catch(() => {
      updateMessage(id, { feedback: previous }); // revert on failure
    });
  }

  const headerMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.3, ease: "easeOut" as const },
        },
      };

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-2xl flex-col lg:min-h-screen">
      <motion.header
        className="flex items-center gap-2 px-5 pt-6"
        {...headerMotion}
      >
        <Link
          href="/coach"
          className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[var(--radius-card)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
          aria-label={tCoach("title")}
        >
          <ChevronLeft
            className="size-6"
            style={{ color: "var(--color-main)" }}
            aria-hidden
          />
        </Link>
        <div className="min-w-0 flex-1">
          <h1
            className="text-lg font-bold"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {tChat("header_title")}
          </h1>
          <p
            className="truncate text-[13px]"
            style={{ color: "var(--color-secondary)" }}
          >
            {subtitle}
          </p>
        </div>
      </motion.header>

      <CoachTranscript
        messages={messages}
        busy={busy && !streamStarted}
        error={chatError}
        emptyHint={tChat("empty_hint")}
        onFeedback={rateMessage}
        followUps={busy ? [] : followUps}
        onFollowUp={(q) => {
          setInput(q);
          composerRef.current?.focus();
        }}
        onRegenerate={
          activeConversationId ? () => void regenerate() : undefined
        }
      />
      {remaining !== null && remaining <= REMAINING_HINT_THRESHOLD ? (
        <p
          className="px-5 pb-1 text-center text-xs"
          style={{ color: "var(--color-secondary)" }}
        >
          {remaining === 0
            ? tChat("remaining_hint_zero")
            : tChat("remaining_hint", { count: remaining })}
        </p>
      ) : null}
      <CoachComposer
        ref={composerRef}
        value={input}
        onChange={setInput}
        onSend={() => void send(input)}
        busy={busy}
      />
    </main>
  );
}
