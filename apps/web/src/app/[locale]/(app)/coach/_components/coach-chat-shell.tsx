"use client";

import { useEffect, useRef, useState } from "react";
import PanelLeft from "lucide-react/dist/esm/icons/panel-left.mjs";
import SquarePen from "lucide-react/dist/esm/icons/square-pen.mjs";
import MessageSquare from "lucide-react/dist/esm/icons/message-square.mjs";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down.mjs";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CoachAccessMode } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { useRouter } from "@/i18n/navigation";
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
import { CoachEmptyLanding } from "./coach-empty-landing";
import { CoachFollowUpChips } from "./coach-follow-up-chips";
import { CoachHistoryDrawer } from "./coach-history-drawer";
import { CoachHistoryPanel } from "./coach-history-panel";
import { CoachStarterChips } from "./coach-starter-chips";
import { CoachTranscript, type ChatMessage } from "./coach-transcript";

const newId = () => globalThis.crypto.randomUUID();

/** Desktop history rail widths — expanded `w-72`, collapsed icon strip. */
const HISTORY_RAIL_EXPANDED_PX = 288;
const HISTORY_RAIL_COLLAPSED_PX = 52;

/** Show the calm remaining-messages hint only when the allowance is nearly spent. */
const REMAINING_HINT_THRESHOLD = 5;

/** Soft pastel blobs — DESIGN.md §2.2; full coach surface (page width + under mobile tab). */
function CoachChatBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-16"
      data-testid="coach-chat-backdrop"
    >
      <div
        className="absolute -left-28 -top-24 h-[28rem] w-[28rem] rounded-full opacity-30 blur-[150px]"
        style={{ backgroundColor: "#FF2DAB" }}
      />
      <div
        className="absolute -right-32 top-[18%] h-[32rem] w-[32rem] rounded-full opacity-50 blur-[150px]"
        style={{ backgroundColor: "#9BC1FB" }}
      />
      <div
        className="absolute -bottom-16 left-[8%] h-[30rem] w-[30rem] rounded-full opacity-50 blur-[150px]"
        style={{ backgroundColor: "#BDEBFF" }}
      />
      <div
        className="absolute bottom-0 right-[-12%] h-80 w-80 rounded-full opacity-40 blur-[140px]"
        style={{ backgroundColor: "#9BC1FB" }}
      />
    </div>
  );
}

/**
 * /coach/chat — history header, empty landing or transcript, sticky composer.
 */
export function CoachChatShell() {
  const tChat = useTranslations("coach.chat");
  const tLanding = useTranslations("coach.landing");
  const tHub = useTranslations("coach.hub");
  const tCoachChat = useTranslations("coach_chat");
  const access = useCoachAccess()!;
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const {
    messages,
    activeConversationId,
    historyStatus,
    historyError,
    hasOlderMessages,
    loadingOlderMessages,
    olderMessagesError,
    appendMessage,
    updateMessage,
    removeMessage,
    openConversation,
    retryConversationHistory,
    loadOlderMessages,
    startNewChat,
    adoptConversation,
    refreshConversations,
  } = useCoachSession();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  /** Desktop history rail — open by default; mobile uses the drawer instead. */
  const [railOpen, setRailOpen] = useState(true);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  // Message COUNT only — never coin amounts inside the chat zone (§4 #3). Decremented locally.
  const [remaining, setRemaining] = useState<number | null>(() =>
    access.mode === CoachAccessMode.PREMIUM
      ? (access.dailyMessagesRemaining ?? null)
      : access.mode === CoachAccessMode.COIN
        ? (access.freeCoinMessagesRemainingToday ?? null)
        : null,
  );
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null,
  );
  const [chatError, setChatError] = useState<string | null>(null);
  // Ephemeral follow-up chips from the LATEST reply only — never persisted, gone on reload.
  const [followUps, setFollowUps] = useState<string[]>([]);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const scrollToBottomRef = useRef<(() => void) | null>(null);
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

  const isEmptyLanding =
    historyStatus !== "loading" &&
    historyStatus !== "error" &&
    messages.length === 0 &&
    !busy;

  useEffect(() => {
    if (isEmptyLanding) setAwayFromBottom(false);
  }, [isEmptyLanding]);

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
            setStreamingMessageId(coachMessageId);
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

      // A brand-new chat just became a real thread — adopt its id and refresh the list.
      if (wasNewChat) {
        adoptConversation(conversationId);
      }
      void refreshConversations();
      if (model !== "verified-content") {
        setRemaining((r) => (r === null ? null : Math.max(0, r - 1)));
      }
    } catch (err) {
      if (received !== "") removeMessage(coachMessageId);
      removeMessage(clientMessageId);
      setInput(trimmed);
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
      setStreamingMessageId(null);
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
    setStreamingMessageId(lastCoach.id);
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
      setStreamingMessageId(null);
    }
  }

  function rateMessage(id: string, value: 1 | -1 | null) {
    const previous = messages.find((m) => m.id === id)?.feedback ?? null;
    updateMessage(id, { feedback: value }); // optimistic
    void setCoachMessageFeedback(id, value).catch(() => {
      updateMessage(id, { feedback: previous }); // revert on failure
    });
  }

  const historyBlocked =
    routeConversationId !== null && historyStatus !== "ready";

  function handleNewChat() {
    startNewChat();
    router.replace("/coach/chat");
  }

  function handleSeed(text: string) {
    setInput(text);
    composerRef.current?.focus();
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

  const railTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };

  function handleRailNewChat() {
    startNewChat();
    router.replace("/coach/chat");
  }

  const railIconBtn =
    "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] transition-colors hover:bg-black/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none";

  return (
    <div className="relative flex h-[calc(100dvh-4rem-80px-env(safe-area-inset-bottom))] w-full overflow-hidden lg:h-screen lg:max-h-none">
      <CoachChatBackdrop />

      <motion.aside
        className="relative z-[1] hidden h-full shrink-0 overflow-hidden border-r bg-white/85 backdrop-blur-md lg:flex lg:flex-col"
        style={{
          borderColor: "color-mix(in srgb, var(--color-main) 8%, transparent)",
        }}
        initial={false}
        animate={{
          width: railOpen
            ? HISTORY_RAIL_EXPANDED_PX
            : HISTORY_RAIL_COLLAPSED_PX,
        }}
        transition={railTransition}
        aria-label={tLanding("history_title")}
        data-testid="coach-history-rail"
      >
        {/* Collapsed icon strip — ChatGPT-style narrow rail */}
        <div
          className="absolute inset-y-0 left-0 flex w-[52px] flex-col items-center gap-1 px-1.5 pt-3 transition-opacity"
          style={{
            opacity: railOpen ? 0 : 1,
            pointerEvents: railOpen ? "none" : "auto",
            transitionDuration: reduceMotion ? "0ms" : "180ms",
          }}
          aria-hidden={railOpen}
          data-testid="coach-history-rail-collapsed"
        >
          <button
            type="button"
            onClick={() => setRailOpen(true)}
            className={railIconBtn}
            aria-label={tLanding("history_open")}
            data-testid="coach-history-expand"
          >
            <PanelLeft
              className="size-5"
              style={{ color: "var(--color-main)" }}
              strokeWidth={2.25}
              aria-hidden
            />
          </button>
          <button
            type="button"
            onClick={handleRailNewChat}
            className={railIconBtn}
            aria-label={tHub("new_chat")}
            data-testid="coach-history-rail-new-chat"
          >
            <SquarePen
              className="size-[18px]"
              style={{ color: "var(--color-main)" }}
              strokeWidth={2.1}
              aria-hidden
            />
          </button>
          <button
            type="button"
            onClick={() => setRailOpen(true)}
            className={railIconBtn}
            aria-label={tLanding("history_title")}
            data-testid="coach-history-rail-chats"
          >
            <MessageSquare
              className="size-5"
              style={{ color: "var(--color-main)" }}
              strokeWidth={2.25}
              aria-hidden
            />
          </button>
        </div>

        {/* Expanded history panel */}
        <div
          className="flex h-full w-72 min-w-72 flex-col transition-opacity"
          style={{
            opacity: railOpen ? 1 : 0,
            pointerEvents: railOpen ? "auto" : "none",
            transitionDuration: reduceMotion ? "0ms" : "180ms",
          }}
          aria-hidden={!railOpen}
        >
          <CoachHistoryPanel onCollapse={() => setRailOpen(false)} />
        </div>
      </motion.aside>

      <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col">
        <motion.header
          className="relative z-[1] mx-auto flex w-full max-w-2xl shrink-0 items-center gap-2 px-5 pt-4 pb-1 lg:hidden"
          {...headerMotion}
        >
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full bg-white/90 shadow-[var(--shadow-card)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            aria-label={tLanding("history_open")}
            data-testid="coach-history-open"
          >
            <PanelLeft
              className="size-5"
              style={{ color: "var(--color-main)" }}
              strokeWidth={2.25}
              aria-hidden
            />
          </button>
        </motion.header>

        <div className="relative flex min-h-0 flex-1 flex-col">
          {/* Soft top edge fade — same idea as expandable bubble “show more” veil. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-white to-transparent"
          />
          <CoachTranscript
            messages={messages}
            busy={busy}
            error={chatError}
            emptyContent={<CoachEmptyLanding />}
            onFeedback={rateMessage}
            onRegenerate={
              activeConversationId ? () => void regenerate() : undefined
            }
            streamingMessageId={streamingMessageId}
            historyStatus={historyStatus}
            historyError={historyError}
            hasOlderMessages={hasOlderMessages}
            loadingOlderMessages={loadingOlderMessages}
            olderMessagesError={olderMessagesError}
            onRetryHistory={() => void retryConversationHistory()}
            onNewChat={handleNewChat}
            onLoadOlder={loadOlderMessages}
            onAwayFromBottomChange={setAwayFromBottom}
            scrollToBottomRef={scrollToBottomRef}
          />
        </div>

        <div className="relative z-[1] mx-auto w-full max-w-2xl shrink-0">
          <AnimatePresence>
            {awayFromBottom && !isEmptyLanding ? (
              <motion.button
                key="coach-scroll-to-bottom"
                type="button"
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
                }
                onClick={() => scrollToBottomRef.current?.()}
                aria-label={tCoachChat("scroll_to_bottom")}
                data-testid="coach-scroll-to-bottom"
                className="absolute bottom-full left-1/2 z-20 mb-5 inline-flex size-9 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full bg-white/90 shadow-[var(--shadow-card)] backdrop-blur-md transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
                style={{
                  border:
                    "1px solid color-mix(in srgb, var(--color-main) 8%, transparent)",
                }}
              >
                <ChevronDown
                  className="size-4"
                  style={{ color: "var(--color-main)" }}
                  strokeWidth={2.25}
                  aria-hidden
                />
              </motion.button>
            ) : null}
          </AnimatePresence>
          {isEmptyLanding ? (
            <div className="px-5 pb-2">
              <CoachStarterChips onSeed={handleSeed} />
            </div>
          ) : !busy && followUps.length > 0 ? (
            <div className="px-5 pb-2">
              <CoachFollowUpChips questions={followUps} onSeed={handleSeed} />
            </div>
          ) : null}
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
            disabled={historyBlocked}
          />
        </div>
      </div>

      <CoachHistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}
