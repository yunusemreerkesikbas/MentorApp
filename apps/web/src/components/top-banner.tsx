"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ComponentProps,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { advanceTopBannerIndex } from "@/lib/top-banner-state";

const DISMISS_KEY = "mentor.dashboard-top-banner.dismissed.v1";
const DEFAULT_ROTATION_INTERVAL_MS = 5_000;
const subscribeDismissed = () => () => undefined;

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

type TopBannerAction =
  | { kind: "button"; label: string; onSelect: () => void }
  | { kind: "link"; label: string; href: ComponentProps<typeof Link>["href"] };

export interface TopBannerItem {
  id: string;
  message: string;
  action: TopBannerAction;
}

interface TopBannerProps {
  closeLabel: string;
  items: TopBannerItem[];
  rotationIntervalMs?: number;
}

export function TopBanner({
  closeLabel,
  items,
  rotationIntervalMs = DEFAULT_ROTATION_INTERVAL_MS,
}: TopBannerProps) {
  const reduceMotion = useReducedMotion();
  const storedDismissed = useSyncExternalStore(
    subscribeDismissed,
    readDismissed,
    () => true,
  );
  const [dismissedNow, setDismissedNow] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const safeIndex = items.length > 0 ? currentIndex % items.length : 0;
  const currentItem = items[safeIndex];

  useEffect(() => {
    if (items.length <= 1 || paused || storedDismissed || dismissedNow) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((index) => advanceTopBannerIndex(index, items.length));
    }, rotationIntervalMs);
    return () => window.clearInterval(timer);
  }, [dismissedNow, items.length, paused, rotationIntervalMs, storedDismissed]);

  if (storedDismissed || dismissedNow || !currentItem) return null;

  function handleDismiss() {
    setDismissedNow(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // In-memory state still dismisses the banner when storage is unavailable.
    }
  }

  const actionClassName =
    "scroll-mt-20 cursor-pointer shrink-0 rounded-[var(--radius-card)] px-2 py-1 font-bold text-[var(--color-main)] underline decoration-[var(--color-accent)] decoration-2 underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";

  return (
    <section
      aria-label={closeLabel}
      className="mt-12 flex min-h-11 w-full items-center gap-2 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 shadow-[var(--shadow-card)] lg:mt-0"
      data-testid="dashboard-top-banner"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
      onFocusCapture={() => setPaused(true)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="min-w-0 flex-1 overflow-hidden" aria-live="off">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={currentItem.id}
            animate={{ opacity: 1, x: 0 }}
            className="flex min-w-0 items-center justify-center gap-2 text-sm"
            exit={{ opacity: 0, x: reduceMotion ? 0 : -8 }}
            initial={{ opacity: reduceMotion ? 1 : 0, x: reduceMotion ? 0 : 8 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
          >
            <span className="truncate font-semibold text-[var(--color-body)]">
              {currentItem.message}
            </span>
            {currentItem.action.kind === "link" ? (
              <Link className={actionClassName} href={currentItem.action.href}>
                {currentItem.action.label} →
              </Link>
            ) : (
              <button
                className={actionClassName}
                onClick={currentItem.action.onSelect}
                type="button"
              >
                {currentItem.action.label} →
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <button
        aria-label={closeLabel}
        className="scroll-mt-20 grid size-11 shrink-0 place-items-center rounded-[var(--radius-card)] text-[var(--color-secondary)] outline-none hover:text-[var(--color-main)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        onClick={handleDismiss}
        type="button"
      >
        <X aria-hidden size={18} />
      </button>
    </section>
  );
}
