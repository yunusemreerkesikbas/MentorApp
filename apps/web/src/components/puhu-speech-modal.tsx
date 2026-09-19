"use client";

import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { ShimmerText, StreamingText } from "@mentor/ui";
import { PuhuSpeakingMascot } from "./puhu-speaking-mascot";
import { PuhuSpeechBubble } from "./puhu-thought-cloud";

export interface PuhuSpeechModalProps {
  /** Controls overlay visibility */
  isOpen: boolean;
  /** Close callback (X, backdrop click, Escape key, or CTA button) */
  onClose: () => void;
  /** Text shown inside the speech bubble (supports StreamingText) */
  text?: string | null;
  /** When true, shows thinking state with ShimmerText */
  isLoading?: boolean;
  /** Loading text displayed while waiting for AI / data */
  loadingText?: string;
  /** Badge chip label above text (e.g. "Koçun Notu") */
  badgeText?: string;
  /** Optional icon in the badge */
  badgeIcon?: ReactNode;
  /** Action button label (e.g. "Anladım"). If undefined, bottom button is omitted */
  actionLabel?: string;
  /** Callback when action button is pressed (defaults to onClose) */
  onAction?: () => void;
  /** Whether backdrop click closes the modal (default: true) */
  dismissOnBackdrop?: boolean;
  /** Whether Escape key closes the modal (default: true) */
  dismissOnEscape?: boolean;
  /** Accessible aria-label for close button */
  closeAriaLabel?: string;
}

export function PuhuSpeechModal({
  isOpen,
  onClose,
  text,
  isLoading = false,
  loadingText = "Puhu düşünüyor…",
  badgeText = "Koçun Notu",
  badgeIcon,
  actionLabel,
  onAction,
  dismissOnBackdrop = true,
  dismissOnEscape = true,
  closeAriaLabel = "Kapat",
}: PuhuSpeechModalProps) {
  const reduceMotion = useReducedMotion();
  const titleId = useId();

  const [entered, setEntered] = useState(false);
  const [streamFinished, setStreamFinished] = useState(false);
  const [renderedKey, setRenderedKey] = useState({ open: isOpen, text, isLoading });

  // Reset stream completion when dialog opens or text changes (standard React state adjustment during render)
  if (renderedKey.open !== isOpen || renderedKey.text !== text || renderedKey.isLoading !== isLoading) {
    if (renderedKey.open !== isOpen) setEntered(false);
    setRenderedKey({ open: isOpen, text, isLoading });
    setStreamFinished(false);
  }

  const isSpeaking = Boolean(
    isOpen && entered && !isLoading && text && !streamFinished && !reduceMotion,
  );

  // Lock body scroll and register keyboard Escape listener
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && dismissOnEscape) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [dismissOnEscape, isOpen, onClose]);

  const handleStreamComplete = useCallback(() => setStreamFinished(true), []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center overflow-visible p-5 sm:p-10 select-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {/* Glassmorphic darkened backdrop with blur */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-black/65 backdrop-blur-md cursor-pointer"
            onClick={() => {
              if (dismissOnBackdrop) onClose();
            }}
          />

          {/* Top-right prominent glassmorphic Close button */}
          <motion.button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.18 }}
            aria-label={closeAriaLabel}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 z-30 flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 hover:text-white border border-white/20 backdrop-blur-md transition-all cursor-pointer shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <X className="size-5" />
          </motion.button>

          {/* Dialogue stage: bubble above Puhu on mobile; Puhu then bubble on desktop */}
          <div
            className="relative z-10 flex w-full max-w-sm flex-col items-center overflow-visible pointer-events-auto sm:max-w-xl sm:flex-row sm:items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="relative z-20 order-2 isolate mt-3 shrink-0 size-24 sm:order-1 sm:mt-0 sm:size-28 flex items-center justify-center"
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.85, y: 14 }
              }
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              <PuhuSpeakingMascot isSpeaking={isSpeaking} isLoading={isLoading} />
            </motion.div>

            <motion.div
              className="relative z-10 order-1 min-w-0 w-full sm:order-2 sm:flex-1 select-text overflow-visible"
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.96, y: 8 }
              }
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.96, transition: { duration: 0.15 } }
              }
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              onAnimationComplete={() => { if (isOpen) setEntered(true); }}
            >
              <PuhuSpeechBubble>
                {badgeText ? (
                  <div id={titleId} className="flex items-center gap-2 mb-3">
                    {badgeIcon}
                    <span className="text-xs font-bold text-[var(--color-secondary)]">
                      {badgeText}
                    </span>
                  </div>
                ) : null}

                <div className="flex items-center">
                  {isLoading ? (
                    <p className="text-base font-medium text-[var(--color-secondary)] py-1">
                      <ShimmerText text={loadingText} />
                    </p>
                  ) : text ? (
                    <p className="text-base leading-relaxed font-medium text-[var(--color-body)]">
                      {entered || reduceMotion ? (
                        <StreamingText key={text} text={text} onComplete={handleStreamComplete} />
                      ) : (
                        <span className="invisible" aria-hidden="true">{text}</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-base leading-relaxed font-medium text-[var(--color-secondary)]">
                      {loadingText}
                    </p>
                  )}
                </div>

                {actionLabel && (!isLoading || streamFinished) ? (
                  <motion.div
                    className="mt-3 flex justify-stretch sm:justify-end"
                    initial={
                      reduceMotion
                        ? { opacity: 0 }
                        : { opacity: 0, scale: 0.9, y: 4 }
                    }
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (onAction) {
                          onAction();
                        } else {
                          onClose();
                        }
                      }}
                      className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center rounded-[var(--radius-card)] sm:rounded-full px-6 py-2 text-sm font-bold bg-[var(--color-btn)] text-[var(--color-btn-label)] hover:opacity-90 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                    >
                      {actionLabel}
                    </button>
                  </motion.div>
                ) : null}
              </PuhuSpeechBubble>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
