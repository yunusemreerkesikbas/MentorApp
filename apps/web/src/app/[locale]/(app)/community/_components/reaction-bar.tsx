"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { LikeBurst } from "@mentor/ui";
import { FORUM_REACTION_EMOJIS } from "@mentor/types";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";
import { ReactionDetailsContent } from "./reaction-details-content";
import { getDefaultReactionChange, getReactionSummary } from "./reaction-summary";

interface ReactionBarProps {
  targetType: "THREAD" | "POST";
  targetId: string;
  reactionCounts: Record<string, number>;
  myReactions: string[];
  onChange: (
    nextEmoji: string | null,
    previousEmoji: string | null,
  ) => void | Promise<void>;
}

/** LinkedIn-style default reaction action plus a right-aligned people-summary trigger. */
export function ReactionBar({
  targetType,
  targetId,
  reactionCounts,
  myReactions,
  onChange,
}: ReactionBarProps) {
  const t = useTranslations("community");
  const reduceMotion = useReducedMotion();
  const { show } = useMentorBottomSheet();
  const [open, setOpen] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const currentEmoji = myReactions[0] ?? null;
  const heartLiked = currentEmoji === "❤️";
  const summary = getReactionSummary(reactionCounts);

  const cancelScheduledClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };

  const scheduleClose = () => {
    cancelScheduledClose();
    closeTimerRef.current = setTimeout(() => setOpen(false), 150);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(
    () => () => {
      cancelScheduledClose();
      cancelLongPress();
    },
    [],
  );

  const handleDefaultReaction = () => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    const change = getDefaultReactionChange(currentEmoji);
    if (change.nextEmoji === "❤️") setBurstKey((k) => k + 1);
    void onChange(change.nextEmoji, change.previousEmoji);
    setOpen(false);
  };

  const handleSelect = (emoji: string) => {
    void onChange(currentEmoji === emoji ? null : emoji, currentEmoji);
    setOpen(false);
  };

  const handleOpenDetails = () => {
    show({
      title: t("reactions_title"),
      layout: "filter",
      bodyScroll: true,
      children: (
        <ReactionDetailsContent
          targetType={targetType}
          targetId={targetId}
          initialCounts={reactionCounts}
        />
      ),
    });
  };

  return (
    <>
      <div
        ref={pickerRef}
        className="relative flex items-center"
        onClick={(event) => event.stopPropagation()}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") {
            cancelScheduledClose();
            setOpen(true);
          }
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") scheduleClose();
        }}
        onFocusCapture={(event) => {
          if ((event.target as HTMLElement).matches(":focus-visible")) {
            cancelScheduledClose();
            setOpen(true);
          }
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        {currentEmoji && currentEmoji !== "❤️" ? (
          <motion.button
            type="button"
            aria-label={t("reaction_add")}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-pressed
            onClick={handleDefaultReaction}
            onPointerDown={(event) => {
              if (event.pointerType !== "touch") return;
              cancelLongPress();
              longPressTriggeredRef.current = false;
              longPressTimerRef.current = setTimeout(() => {
                longPressTriggeredRef.current = true;
                setOpen(true);
              }, 450);
            }}
            onPointerUp={cancelLongPress}
            onPointerCancel={cancelLongPress}
            whileHover={reduceMotion ? undefined : { scale: 1.08 }}
            whileTap={reduceMotion ? undefined : { scale: 0.9 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="community-post-action flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ color: "var(--color-secondary)" }}
          >
            <span className="text-[18px]" aria-hidden>
              {currentEmoji}
            </span>
          </motion.button>
        ) : (
          <LikeBurst
            liked={heartLiked}
            burstKey={burstKey}
            aria-label={t("reaction_add")}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={handleDefaultReaction}
            onPointerDown={(event) => {
              if (event.pointerType !== "touch") return;
              cancelLongPress();
              longPressTriggeredRef.current = false;
              longPressTimerRef.current = setTimeout(() => {
                longPressTriggeredRef.current = true;
                setOpen(true);
              }, 450);
            }}
            onPointerUp={cancelLongPress}
            onPointerCancel={cancelLongPress}
            className="community-post-action flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{
              color: heartLiked
                ? "var(--color-like-active)"
                : "var(--color-secondary)",
            }}
          >
            <Heart className="t-like-heart" size={20} aria-hidden />
          </LikeBurst>
        )}

        <AnimatePresence>
          {open ? (
            <motion.div
              role="menu"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.86, y: 6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute bottom-full left-0 z-20 mb-1 flex gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-card)]"
              style={{ borderColor: "var(--color-border)" }}
            >
              {FORUM_REACTION_EMOJIS.map((emoji) => (
                <motion.button
                  key={emoji}
                  type="button"
                  role="menuitemradio"
                  aria-label={emoji}
                  aria-checked={currentEmoji === emoji}
                  onClick={() => handleSelect(emoji)}
                  whileHover={reduceMotion ? undefined : { scale: 1.22, y: -3 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.86 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="flex size-11 items-center justify-center rounded-full text-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                >
                  {emoji}
                </motion.button>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {summary.hasReactions ? (
        <motion.button
          type="button"
          aria-label={t("reaction_total", { count: summary.total })}
          onClick={(event) => {
            event.stopPropagation();
            handleOpenDetails();
          }}
          whileHover={reduceMotion ? undefined : { scale: 1.03 }}
          whileTap={reduceMotion ? undefined : { scale: 0.96 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="order-last ml-auto flex min-h-11 items-center rounded-full px-1.5 text-[13px] tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ color: "var(--color-secondary)" }}
        >
          <span className="flex items-center" aria-hidden>
            {summary.emojis.slice(0, 3).map((emoji, index) => (
              <span
                key={emoji}
                className="flex size-6 items-center justify-center rounded-full bg-[var(--color-surface)] text-sm ring-1 ring-[var(--color-surface)]"
                style={{ marginLeft: index === 0 ? 0 : -6, zIndex: 3 - index }}
              >
                {emoji}
              </span>
            ))}
          </span>
          <span className="ml-1.5">{summary.total}</span>
        </motion.button>
      ) : null}
    </>
  );
}
