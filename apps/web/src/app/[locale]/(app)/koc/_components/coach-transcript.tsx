"use client";

import Image from "next/image";
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
 * Chat transcript for /koc/chat. Empty state is a minimal hint (hub owns shortcuts).
 */
export function CoachTranscript({
  messages,
  busy,
  error,
  emptyHint,
}: {
  messages: ChatMessage[];
  busy: boolean;
  error: string | null;
  emptyHint: string;
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
          {m.role === "coach" && m.sources ? (
            <SourceChips sources={m.sources} />
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
