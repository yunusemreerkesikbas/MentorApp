"use client";

import Image from "next/image";
import { Fragment, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import ThumbsUp from "lucide-react/dist/esm/icons/thumbs-up.mjs";
import ThumbsDown from "lucide-react/dist/esm/icons/thumbs-down.mjs";
import { Link } from "@/i18n/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { FormError } from "@/components/form";
import { SuggestedTaskCard } from "@/components/suggested-task-card";
import type { CoachSource } from "@/lib/coach";

export interface ChatMessage {
  id: string;
  role: "user" | "coach";
  text: string;
  sources?: CoachSource[];
  /** Coach-suggested plan task → "Plana ekle" card (persisted with the reply). */
  suggestedTask?: { title: string; subject: string | null };
  /** 👍 = 1, 👎 = -1, null = none (COACH rows only; undefined on optimistic/streaming rows). */
  feedback?: number | null;
}

/**
 * Chat transcript for /koc/chat. Empty state is a minimal hint (hub owns shortcuts).
 */
export function CoachTranscript({
  messages,
  busy,
  error,
  emptyHint,
  onFeedback,
}: {
  messages: ChatMessage[];
  busy: boolean;
  error: string | null;
  emptyHint: string;
  /** Rate a coach reply (👍/👎/toggle-off). Undefined disables the control (e.g. while streaming). */
  onFeedback?: (id: string, value: 1 | -1 | null) => void;
}) {
  const reduceMotion = useReducedMotion();
  const translate = useTranslations("coach_chat");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "end",
    });
  }, [messages.length, busy, reduceMotion]);

  const isEmpty = messages.length === 0 && !busy;

  return (
    <div
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label={translate("transcript_label")}
      className="flex flex-1 flex-col gap-3 px-5 py-4"
    >
      {isEmpty ? (
        <motion.div
          className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Image
            src="/mascot/puhu/puhu-default.png"
            alt=""
            width={32}
            height={32}
            aria-hidden
          />
          <p
            className="max-w-xs text-base"
            style={{ color: "var(--color-secondary)" }}
          >
            {emptyHint}
          </p>
        </motion.div>
      ) : null}

      {messages.map((m) => (
        <Fragment key={m.id}>
          <MessageBubble message={m} reduceMotion={reduceMotion} />
          {m.role === "coach" && m.suggestedTask ? (
            <SuggestedTaskCard task={m.suggestedTask} className="flex justify-start pl-10" />
          ) : null}
          {m.role === "coach" && m.sources ? (
            <SourceChips sources={m.sources} />
          ) : null}
          {m.role === "coach" && onFeedback ? (
            <FeedbackRow
              value={m.feedback ?? null}
              onRate={(v) => onFeedback(m.id, v)}
            />
          ) : null}
        </Fragment>
      ))}

      {busy ? <TypingBubble reduceMotion={reduceMotion} /> : null}

      {error ? <FormError message={error} /> : null}

      <div ref={bottomRef} />
    </div>
  );
}

function MessageBubble({
  message,
  reduceMotion,
}: {
  message: ChatMessage;
  reduceMotion: boolean | null;
}) {
  const isUser = message.role === "user";
  return (
    <motion.div
      className={`flex ${isUser ? "justify-end" : "justify-start gap-2"}`}
      initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {!isUser ? (
        <Image
          src="/mascot/puhu/puhu-default.png"
          alt=""
          width={32}
          height={32}
          className="mt-1 shrink-0 self-end"
          aria-hidden
        />
      ) : null}
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-[var(--radius-card)] px-4 py-2.5 text-base leading-relaxed ${
          isUser ? "text-white" : "border border-white bg-white/50"
        }`}
        style={{
          fontFamily: "var(--font-body)",
          ...(isUser
            ? { backgroundColor: "var(--color-main)" }
            : { color: "var(--color-body)", boxShadow: "var(--shadow-card)" }),
        }}
      >
        {message.text}
      </div>
    </motion.div>
  );
}

/** 👍/👎 on a coach reply — toggling the active rating clears it. Optimistic; parent persists. */
function FeedbackRow({
  value,
  onRate,
}: {
  value: number | null;
  onRate: (v: 1 | -1 | null) => void;
}) {
  const translate = useTranslations("coach_chat");
  const base =
    "inline-flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none";
  return (
    <div className="flex justify-start gap-1 pl-10">
      <button
        type="button"
        aria-label={translate("feedback_up")}
        aria-pressed={value === 1}
        onClick={() => onRate(value === 1 ? null : 1)}
        className={base}
        style={{ color: value === 1 ? "var(--color-progress)" : "var(--color-secondary)" }}
      >
        <ThumbsUp className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={translate("feedback_down")}
        aria-pressed={value === -1}
        onClick={() => onRate(value === -1 ? null : -1)}
        className={base}
        style={{ color: value === -1 ? "var(--color-main)" : "var(--color-secondary)" }}
      >
        <ThumbsDown className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function SourceChips({ sources }: { sources: CoachSource[] }) {
  const translate = useTranslations("coach_chat");
  if (sources.length === 0) return null;
  return (
    <div className="flex justify-start pl-10">
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
            href={`/bilgi/${s.slug}`}
            className="min-h-8 rounded-[var(--radius-card)] border border-white bg-white/50 px-3 py-1 text-xs font-bold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
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
      className="flex justify-start gap-2"
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Image
        src="/mascot/puhu/puhu-default.png"
        alt=""
        width={32}
        height={32}
        className="shrink-0 self-end"
        aria-hidden
      />
      <div
        className="rounded-[var(--radius-card)] border border-white bg-white/50 px-4 py-2.5"
        style={{ boxShadow: "var(--shadow-card)" }}
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
