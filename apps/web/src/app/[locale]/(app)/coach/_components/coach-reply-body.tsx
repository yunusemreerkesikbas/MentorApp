"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CoachMarkdown } from "./coach-markdown";

/** Base typing speed; catches up faster when the stream pulls ahead. */
const CHARS_PER_SECOND = 72;

function StreamingCaret({ reduceMotion }: { reduceMotion: boolean | null }) {
  if (reduceMotion) {
    return (
      <span
        className="ml-0.5 inline-block h-[1.05em] w-1.5 rounded-[2px] bg-[var(--color-progress)] align-[-0.15em] opacity-70"
        aria-hidden
      />
    );
  }
  return (
    <motion.span
      className="ml-0.5 inline-block h-[1.05em] w-1.5 rounded-[2px] bg-[var(--color-progress)] align-[-0.15em]"
      animate={{ opacity: [0.25, 1, 0.25] }}
      transition={{ duration: 0.95, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden
    />
  );
}

/**
 * Reveals `target` character-by-character while streaming. When streaming ends (or
 * reduced-motion), shows the full string immediately.
 */
function useTypewriter(
  target: string,
  active: boolean,
  reduceMotion: boolean | null,
): string {
  const [shown, setShown] = useState(() =>
    !active || reduceMotion ? target : "",
  );
  const shownLenRef = useRef(shown.length);

  useEffect(() => {
    if (reduceMotion || !active) {
      shownLenRef.current = target.length;
      setShown(target);
      return;
    }

    // Regenerate / rewind — restart the typewriter.
    if (target.length < shownLenRef.current) {
      shownLenRef.current = 0;
      setShown("");
    }

    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const behind = target.length - shownLenRef.current;
      if (behind <= 0) return;

      const elapsed = now - last;
      last = now;
      const base = Math.max(1, Math.round((CHARS_PER_SECOND * elapsed) / 1000));
      // If SSE is ahead, catch up in larger steps so we never feel stuck.
      const step = behind > 48 ? Math.ceil(behind / 6) : Math.min(base, behind);
      shownLenRef.current += step;
      setShown(target.slice(0, shownLenRef.current));

      if (shownLenRef.current < target.length) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active, reduceMotion]);

  return reduceMotion || !active ? target : shown;
}

/**
 * Coach reply body — character typewriter while the active reply streams;
 * full markdown when complete (no slide-in).
 */
export function CoachReplyBody({
  text,
  isStreaming,
  reduceMotion,
}: {
  text: string;
  isStreaming: boolean;
  reduceMotion: boolean | null;
}) {
  const typed = useTypewriter(text, isStreaming, reduceMotion);

  if (!text && isStreaming) {
    return <StreamingCaret reduceMotion={reduceMotion} />;
  }

  if (!isStreaming) {
    return <CoachMarkdown text={text} />;
  }

  return (
    <span className="whitespace-pre-wrap">
      {typed}
      <StreamingCaret reduceMotion={reduceMotion} />
    </span>
  );
}
