"use client";

import { useEffect, useRef, useState } from "react";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left.mjs";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { CoachAccessMode } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Link } from "@/i18n/navigation";
import { CoachStreamError, streamCoachMessage } from "@/lib/coach";
import { useKocAccess } from "./koc-access-shell";
import { useCoachSession } from "./coach-session-context";
import { CoachComposer } from "./coach-composer";
import { CoachTranscript, type ChatMessage } from "./coach-transcript";

const newId = () => globalThis.crypto.randomUUID();

/**
 * /koc/chat — back header, transcript, sticky composer. Session state from layout provider.
 */
export function KocChatShell() {
  const tCoach = useTranslations("coach");
  const tChat = useTranslations("coach.chat");
  const access = useKocAccess();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const { messages, appendMessage, updateMessage, removeMessage, pushRecentTopic } =
    useCoachSession();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamStarted, setStreamStarted] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const seedAppliedRef = useRef(false);

  const seed = searchParams.get("seed");

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

    const isFirstUserMessage = !messages.some((m) => m.role === "user");
    const clientMessageId = newId();
    const userMessage: ChatMessage = {
      id: clientMessageId,
      role: "user",
      text: trimmed,
    };
    appendMessage(userMessage);

    if (isFirstUserMessage) {
      pushRecentTopic(trimmed);
    }

    setBusy(true);
    const coachMessageId = newId();
    let received = "";
    try {
      const { reply, sources, suggestedTask } = await streamCoachMessage(
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
      );
      // Finalize with the authoritative reply + source chips (covers zero-delta fallbacks too).
      if (received === "") {
        appendMessage({ id: coachMessageId, role: "coach", text: reply, sources, suggestedTask });
      } else {
        updateMessage(coachMessageId, { text: reply, sources, suggestedTask });
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
          href="/koc"
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
      />
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
