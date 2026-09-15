"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PuhuBubble } from "@/components/onboarding-play/play-heading";
import { browserPushSupport, subscribeBrowserPush } from "@/lib/web-push";

/**
 * Asks for push permission in the tap that saves the daily goal. Safari and Firefox only show the
 * prompt from a user gesture, so `ask` must run inside the click handler, before any `await`.
 * It returns null when there is nothing to ask: permission already decided, no support (an iPhone
 * outside a home-screen app) or push not configured.
 */
export function usePushPermissionAsk() {
  const [open, setOpen] = useState(false);
  const skipRef = useRef<(() => void) | null>(null);

  const ask = useCallback((): Promise<boolean> | null => {
    if (browserPushSupport() !== "ready" || Notification.permission !== "default") return null;
    const subscribed = subscribeBrowserPush().then((result) => result === "subscribed");
    // Chrome's quiet permission UI may never resolve the prompt, so the layer always offers a way out.
    const skipped = new Promise<boolean>((resolve) => {
      skipRef.current = () => resolve(false);
    });
    setOpen(true);
    return Promise.race([subscribed, skipped]).finally(() => setOpen(false));
  }, []);

  const dismiss = useCallback(() => skipRef.current?.(), []);

  return { open, ask, dismiss };
}

/** Puhu's context layer behind the browser's own prompt, with a skip that never waits on it. */
export function PushPermissionLayer({
  open,
  title,
  body,
  skipLabel,
  onSkip,
}: {
  open: boolean;
  title: string;
  body: string;
  skipLabel: string;
  onSkip: () => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="push-permission"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="onboarding-play-theme fixed inset-0 z-50 flex flex-col justify-center gap-6 bg-[var(--play-scrim)] px-5"
        >
          <div className="mx-auto w-full max-w-xl">
            <PuhuBubble title={title} sub={body} />
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="mx-auto min-h-11 rounded-[var(--play-radius)] px-3 text-base font-bold text-[var(--play-scrim-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            {skipLabel}
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
