"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Heart, SmilePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { FORUM_REACTION_EMOJIS } from "@mentor/types";

/** Single-choice reaction control with lively, reduced-motion-aware feedback. */
export function ReactionBar({
  reactionCounts,
  myReactions,
  onChange,
}: {
  reactionCounts: Record<string, number>;
  myReactions: string[];
  onChange: (nextEmoji: string | null, previousEmoji: string | null) => void;
}) {
  const t = useTranslations("community");
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const currentEmoji = myReactions[0] ?? null;
  const heart = FORUM_REACTION_EMOJIS[0];
  const heartCount = reactionCounts[heart] ?? 0;
  const otherCounts = FORUM_REACTION_EMOJIS.slice(1).filter(
    (emoji) => (reactionCounts[emoji] ?? 0) > 0,
  );

  const select = (emoji: string) => {
    onChange(currentEmoji === emoji ? null : emoji, currentEmoji);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
      <motion.button
        type="button"
        aria-label={t("reaction_add")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        whileHover={reduceMotion ? undefined : { scale: 1.12, rotate: open ? 0 : -8 }}
        whileTap={reduceMotion ? undefined : { scale: 0.82, rotate: 8 }}
        transition={{ type: "spring", stiffness: 520, damping: 20 }}
        className="community-post-action flex size-11 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{ color: "var(--color-main)" }}
      >
        <motion.span
          className="inline-flex"
          animate={reduceMotion ? undefined : { rotate: open ? 45 : 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 22 }}
        >
          <SmilePlus size={18} aria-hidden="true" />
        </motion.span>
      </motion.button>

      <motion.button
        type="button"
        aria-pressed={currentEmoji === heart}
        aria-label={`${heart} ${heartCount}`}
        onClick={() => select(heart)}
        whileHover={reduceMotion ? undefined : { scale: 1.12 }}
        whileTap={reduceMotion ? undefined : { scale: 0.78 }}
        transition={{ type: "spring", stiffness: 560, damping: 20 }}
        className="community-post-action inline-flex min-h-11 min-w-11 items-center justify-center gap-1 text-[13px] tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{ color: currentEmoji === heart ? "var(--color-like-active)" : "var(--color-main)" }}
      >
        <motion.span
          className="inline-flex"
          animate={
            reduceMotion || currentEmoji !== heart
              ? { scale: 1, rotate: 0 }
              : { scale: [1, 1.45, 0.9, 1], rotate: [0, -12, 8, 0] }
          }
          transition={{ duration: reduceMotion ? 0 : 0.42, ease: "easeOut" }}
        >
          <Heart size={18} fill={currentEmoji === heart ? "currentColor" : "none"} aria-hidden />
        </motion.span>
        <AnimatePresence initial={false} mode="popLayout">
          {heartCount > 0 ? (
            <motion.span
              key={heartCount}
              className="text-[13px]"
              initial={reduceMotion ? false : { y: 6, opacity: 0, scale: 0.7 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={reduceMotion ? undefined : { y: -6, opacity: 0, scale: 0.7 }}
              transition={{ type: "spring", stiffness: 500, damping: 24 }}
            >
              {heartCount}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </motion.button>

      {otherCounts.map((emoji) => (
        <motion.button
          key={emoji}
          type="button"
          aria-pressed={currentEmoji === emoji}
          aria-label={`${emoji} ${reactionCounts[emoji]}`}
          onClick={() => select(emoji)}
          whileHover={reduceMotion ? undefined : { scale: 1.14, y: -2 }}
          whileTap={reduceMotion ? undefined : { scale: 0.8 }}
          transition={{ type: "spring", stiffness: 520, damping: 19 }}
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 px-1 text-[13px] font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <motion.span
            className={currentEmoji === emoji ? "text-lg" : undefined}
            animate={
              reduceMotion || currentEmoji !== emoji
                ? undefined
                : { scale: [1, 1.4, 1], rotate: [0, -10, 8, 0] }
            }
            transition={{ duration: 0.38 }}
            aria-hidden
          >
            {emoji}
          </motion.span>
          <span className="text-[13px]">{reactionCounts[emoji]}</span>
        </motion.button>
      ))}

      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.72, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.78, y: 8 }}
            transition={{ type: "spring", stiffness: 440, damping: 24 }}
            className="absolute bottom-full left-0 z-20 mb-1 flex gap-1 rounded-full border bg-white p-1 shadow-[var(--shadow-card)]"
            style={{ borderColor: "rgba(0,0,0,0.08)" }}
          >
            {FORUM_REACTION_EMOJIS.map((emoji, index) => (
              <motion.button
                key={emoji}
                type="button"
                role="menuitemradio"
                autoFocus={index === 0}
                aria-label={emoji}
                aria-checked={currentEmoji === emoji}
                onClick={() => select(emoji)}
                whileHover={reduceMotion ? undefined : { scale: 1.28, y: -4 }}
                whileTap={reduceMotion ? undefined : { scale: 0.76 }}
                transition={{ type: "spring", stiffness: 560, damping: 18 }}
                className={`flex size-11 items-center justify-center text-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${currentEmoji === emoji ? "font-black" : ""}`}
              >
                {emoji}
              </motion.button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
