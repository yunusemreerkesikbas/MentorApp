"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { ShimmerText, StreamingText } from "@mentor/ui";
import { PUHU_MOTION_FRAMES } from "@/lib/onboarding-assets";
import { PuhuThoughtCloud } from "./puhu-thought-cloud";

const SPEECH_FRAMES = [
  PUHU_MOTION_FRAMES.default,
  PUHU_MOTION_FRAMES.talkClosed,
  PUHU_MOTION_FRAMES.blink,
  PUHU_MOTION_FRAMES.lookDown,
] as const;

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

  const [mouthClosed, setMouthClosed] = useState(false);
  const [blinking, setBlinking] = useState(false);
  const [streamFinished, setStreamFinished] = useState(false);
  const [renderedKey, setRenderedKey] = useState({ open: isOpen, text });

  // Reset stream completion when dialog opens or text changes (standard React state adjustment during render)
  if (renderedKey.open !== isOpen || renderedKey.text !== text) {
    setRenderedKey({ open: isOpen, text });
    setStreamFinished(false);
  }

  const isSpeaking = Boolean(
    isOpen && !isLoading && text && !streamFinished && !reduceMotion,
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

  // Speaking mouth flapping loop (toggles talkClosed <-> default every 140ms)
  useEffect(() => {
    if (!isSpeaking) return;
    const interval = window.setInterval(() => {
      setMouthClosed((prev) => !prev);
    }, 140);
    return () => window.clearInterval(interval);
  }, [isSpeaking]);

  // Stream finish callback
  const handleStreamComplete = useCallback(() => {
    setStreamFinished(true);
    if (!reduceMotion) {
      setBlinking(true);
      window.setTimeout(() => setBlinking(false), 220);
    }
  }, [reduceMotion]);

  // Occasional gentle idle blinking when settled
  useEffect(() => {
    if (!isOpen || isSpeaking || isLoading || reduceMotion) return;
    const interval = window.setInterval(() => {
      setBlinking(true);
      window.setTimeout(() => setBlinking(false), 180);
    }, 4500);
    return () => window.clearInterval(interval);
  }, [isLoading, isOpen, isSpeaking, reduceMotion]);

  const currentFrame = useMemo(() => {
    if (blinking) return PUHU_MOTION_FRAMES.blink;
    if (isLoading) return PUHU_MOTION_FRAMES.lookDown;
    if (isSpeaking && mouthClosed) return PUHU_MOTION_FRAMES.talkClosed;
    return PUHU_MOTION_FRAMES.default;
  }, [blinking, isLoading, isSpeaking, mouthClosed]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center overflow-visible p-8 sm:p-10 select-none"
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
            className="absolute top-4 right-4 sm:top-6 sm:right-6 z-30 flex size-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 hover:text-white border border-white/20 backdrop-blur-md transition-all cursor-pointer shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <X className="size-5" />
          </motion.button>

          {/* Dialogue stage: Puhu bottom-left, thought cloud up and to the right */}
          <div
            className="relative z-10 flex flex-row items-end overflow-visible pointer-events-auto max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="relative z-20 isolate shrink-0 size-20 sm:size-28 flex items-center justify-center"
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.85, y: 14 }
              }
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              <div
                className="absolute -bottom-2 inset-x-2 h-6 rounded-full blur-md opacity-30 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse at center, rgba(255, 200, 50, 0.6) 0%, transparent 70%)",
                }}
                aria-hidden="true"
              />
              {SPEECH_FRAMES.map((src) => (
                <Image
                  key={src}
                  src={src}
                  alt=""
                  fill
                  priority
                  sizes="(max-width: 640px) 80px, 112px"
                  className={`object-contain drop-shadow-md ${src === currentFrame ? "opacity-100" : "opacity-0"}`}
                  aria-hidden
                />
              ))}
            </motion.div>

            <motion.div
              className="relative z-10 min-w-0 w-full max-w-[380px] sm:max-w-[480px] mb-2 sm:mb-3 ml-1 sm:ml-2 select-text overflow-visible"
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.92, y: 10 }
              }
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.95, y: 6 }
              }
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <PuhuThoughtCloud>
                {badgeText ? (
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-[var(--color-secondary)]">
                      {badgeText}
                    </span>
                  </div>
                ) : null}

                <div className="min-h-16 flex items-center">
                  {isLoading ? (
                    <p className="text-sm sm:text-base font-medium text-[var(--color-secondary)] py-1">
                      <ShimmerText text={loadingText} />
                    </p>
                  ) : text ? (
                    <p className="text-sm sm:text-base leading-relaxed font-medium text-[var(--color-body)]">
                      <StreamingText
                        text={text}
                        onComplete={handleStreamComplete}
                      />
                    </p>
                  ) : (
                    <p className="text-sm sm:text-base leading-relaxed font-medium text-[var(--color-secondary)]">
                      {loadingText}
                    </p>
                  )}
                </div>

                {actionLabel && (!isLoading || streamFinished) ? (
                  <motion.div
                    className="mt-4 flex justify-end"
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
                      className="inline-flex min-h-11 items-center justify-center rounded-full px-6 py-2 text-sm font-bold bg-[var(--color-btn)] text-[var(--color-btn-label)] hover:opacity-90 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                    >
                      {actionLabel}
                    </button>
                  </motion.div>
                ) : null}
              </PuhuThoughtCloud>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
