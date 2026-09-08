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

  // Current mascot frame
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
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 select-none"
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

          {/* Dialogue Stage */}
          <div
            className="relative z-10 flex flex-col-reverse items-center gap-4 sm:flex-row sm:items-end sm:gap-6 pointer-events-auto max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Puhu Mascot */}
            <motion.div
              className="relative shrink-0 size-20 sm:size-28 flex items-center justify-center"
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.85, y: 14 }
              }
              animate={
                isSpeaking && !reduceMotion
                  ? { opacity: 1, scale: 1, y: [0, -3, 0] }
                  : { opacity: 1, scale: 1, y: 0 }
              }
              transition={
                isSpeaking && !reduceMotion
                  ? { duration: 0.3, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.28, ease: "easeOut" }
              }
            >
              {/* Subtle ambient glow beneath Puhu */}
              <div
                className="absolute -bottom-2 inset-x-2 h-6 rounded-full blur-md opacity-30 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse at center, rgba(255, 200, 50, 0.6) 0%, transparent 70%)",
                }}
                aria-hidden="true"
              />
              <Image
                src={currentFrame}
                alt=""
                fill
                priority
                sizes="(max-width: 640px) 80px, 112px"
                className="object-contain drop-shadow-md"
                aria-hidden
              />
            </motion.div>

            {/* Cloud Speech Bubble Container */}
            <motion.div
              className="relative min-w-0 w-full max-w-[380px] sm:max-w-[480px] select-text"
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
              {/* Outer Cloud Group with unified composite drop-shadow */}
              <div className="relative filter drop-shadow-[0_16px_36px_rgba(0,0,0,0.25)]">
                {/* Fluffy Cloud Lobe Spheres along top, sides and bottom */}
                {/* Top left puff */}
                <span
                  className="absolute -top-5 left-10 size-14 sm:size-16 rounded-full bg-[var(--color-surface)] pointer-events-none"
                  aria-hidden="true"
                />
                {/* Top center grand puff */}
                <span
                  className="absolute -top-7 sm:-top-8 left-1/2 -translate-x-1/2 size-20 sm:size-24 rounded-full bg-[var(--color-surface)] pointer-events-none"
                  aria-hidden="true"
                />
                {/* Top right puff */}
                <span
                  className="absolute -top-4 sm:-top-5 right-12 size-14 sm:size-16 rounded-full bg-[var(--color-surface)] pointer-events-none"
                  aria-hidden="true"
                />
                {/* Left side puff */}
                <span
                  className="absolute top-1/3 -left-3 size-12 sm:size-14 rounded-full bg-[var(--color-surface)] pointer-events-none"
                  aria-hidden="true"
                />
                {/* Right side puff */}
                <span
                  className="absolute top-1/2 -right-3 -translate-y-1/2 size-12 sm:size-14 rounded-full bg-[var(--color-surface)] pointer-events-none"
                  aria-hidden="true"
                />
                {/* Bottom left puff */}
                <span
                  className="absolute -bottom-3 left-16 size-12 sm:size-14 rounded-full bg-[var(--color-surface)] pointer-events-none"
                  aria-hidden="true"
                />
                {/* Bottom right puff */}
                <span
                  className="absolute -bottom-4 right-20 size-14 sm:size-16 rounded-full bg-[var(--color-surface)] pointer-events-none"
                  aria-hidden="true"
                />

                {/* Cloud Thought Trail towards Puhu */}
                {/* Desktop Trail: 3 diminishing cloud bubbles pointing down-left toward Puhu's head */}
                <div
                  className="hidden sm:block absolute -left-7 bottom-3 pointer-events-none"
                  aria-hidden="true"
                >
                  <span className="block size-6 rounded-full bg-[var(--color-surface)]" />
                  <span className="block size-4 rounded-full bg-[var(--color-surface)] mt-1.5 -ml-3" />
                  <span className="block size-2.5 rounded-full bg-[var(--color-surface)] mt-1 -ml-3" />
                </div>

                {/* Mobile Trail: 3 diminishing cloud bubbles pointing down toward Puhu */}
                <div
                  className="sm:hidden absolute left-1/2 -translate-x-1/2 -bottom-6 flex flex-col items-center pointer-events-none"
                  aria-hidden="true"
                >
                  <span className="block size-5 rounded-full bg-[var(--color-surface)]" />
                  <span className="block size-3.5 rounded-full bg-[var(--color-surface)] mt-1" />
                  <span className="block size-2 rounded-full bg-[var(--color-surface)] mt-1" />
                </div>

                {/* Main Central Cloud Body */}
                <div className="relative z-10 rounded-[2.5rem] sm:rounded-[3rem] bg-[var(--color-surface)] px-6 py-7 sm:px-9 sm:py-8 flex flex-col">
                  {/* Optional Badge (if explicitly provided) */}
                  {badgeText ? (
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-[var(--color-secondary)]">
                        {badgeText}
                      </span>
                    </div>
                  ) : null}

                  {/* Speech Text Zone */}
                  <div className="min-h-[4rem] flex items-center">
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

                  {/* Action Button Row */}
                  {actionLabel && (!isLoading || streamFinished) ? (
                    <motion.div
                      className="mt-3.5 flex justify-end"
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 4 }}
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
                        className="inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-bold bg-[var(--color-btn)] text-[var(--color-btn-label)] hover:opacity-90 active:scale-95 transition-all shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                      >
                        {actionLabel}
                      </button>
                    </motion.div>
                  ) : null}
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
