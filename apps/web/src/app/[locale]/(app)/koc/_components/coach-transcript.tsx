"use client";

import { Fragment, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { FormError } from "@/components/form";
import type { CoachSource } from "@/lib/coach";

export interface ChatMessage {
  id: string;
  role: "user" | "coach";
  text: string;
  sources?: CoachSource[];
}

/**
 * Ephemeral chat transcript (client-state only). `role="log"` + `aria-live="polite"` so a new coach
 * reply is announced to screen readers. Empty state offers suggestion chips; while busy a "yazıyor…"
 * affordance shows (static under prefers-reduced-motion).
 */
export function CoachTranscript({
  messages,
  busy,
  error,
  onPickSuggestion,
}: {
  messages: ChatMessage[];
  busy: boolean;
  error: string | null;
  onPickSuggestion: (text: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const translate = useTranslations("coach_chat");
  const bottomRef = useRef<HTMLDivElement>(null);
  const suggestions = [
    translate("suggestion_1"),
    translate("suggestion_2"),
    translate("suggestion_3"),
  ];

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
      className="flex flex-1 flex-col gap-3 px-5 py-6"
    >
      {isEmpty && (
        <motion.div
          className="flex flex-col gap-4 py-8"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <p className="text-base" style={{ color: "var(--color-secondary)" }}>
            {translate("empty_prompt")}
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s, i) => (
              <motion.button
                key={s}
                type="button"
                onClick={() => onPickSuggestion(s)}
                className="min-h-11 cursor-pointer rounded-[var(--radius-card)] px-4 py-2 text-left text-sm font-bold capitalize transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
                style={{
                  backgroundColor:
                    "color-mix(in srgb, var(--color-chip) 30%, transparent)",
                  color: "var(--color-chip-text)",
                  fontFamily: "var(--font-body)",
                  boxShadow: "var(--shadow-card)",
                }}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.2 }}
              >
                {s}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {messages.map((m) => (
        <Fragment key={m.id}>
          <MessageBubble message={m} reduceMotion={reduceMotion} />
          {m.role === "coach" && m.sources ? (
            <SourceChips sources={m.sources} />
          ) : null}
        </Fragment>
      ))}

      {busy && <TypingBubble reduceMotion={reduceMotion} />}

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
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
      initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
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
      className="flex justify-start"
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
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
