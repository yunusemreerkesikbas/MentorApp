"use client";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ComponentProps,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

import { Link } from "@/i18n/navigation";
import {
  advanceTopBannerIndex,
  parseDismissedIds,
  serializeDismissedIds,
} from "@/lib/top-banner-state";

/**
 * v2 holds a JSON array of dismissed item ids; v1 held a single "1" meaning "hide everything".
 * The bump IS the migration — a stale v1 value is simply ignored, and it dies with the tab anyway.
 */
const DISMISS_KEY = "mentor.dashboard-top-banner.dismissed.v2";
const DEFAULT_ROTATION_INTERVAL_MS = 5_000;

/** Nothing external ever mutates this; the hook is here purely for a hydration-safe first paint. */
const subscribeHydrated = () => () => undefined;
const getHydratedSnapshot = () => true;
const getServerHydratedSnapshot = () => false;

function readDismissedIds(): ReadonlySet<string> {
  try {
    return parseDismissedIds(sessionStorage.getItem(DISMISS_KEY));
  } catch {
    return parseDismissedIds(null);
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
  // Rendered empty on the server and on the hydrating pass, so a dismissal stored in this tab
  // never flashes the banner before React catches up.
  const hydrated = useSyncExternalStore(
    subscribeHydrated,
    getHydratedSnapshot,
    getServerHydratedSnapshot,
  );
  const [dismissedIds, setDismissedIds] = useState<ReadonlySet<string>>(readDismissedIds);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // Closing one announcement must not silence the others — each item is dismissed on its own id.
  const visibleItems = useMemo(
    () => items.filter((item) => !dismissedIds.has(item.id)),
    [dismissedIds, items],
  );
  const safeIndex = visibleItems.length > 0 ? currentIndex % visibleItems.length : 0;
  const currentItem = visibleItems[safeIndex];

  useEffect(() => {
    if (visibleItems.length <= 1 || paused || !hydrated) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((index) => advanceTopBannerIndex(index, visibleItems.length));
    }, rotationIntervalMs);
    return () => window.clearInterval(timer);
  }, [hydrated, paused, rotationIntervalMs, visibleItems.length]);

  function dismissItem(id: string) {
    const next = new Set(dismissedIds).add(id);
    setDismissedIds(next);
    // Land on the item that slid into this slot rather than skipping one.
    setCurrentIndex(0);
    try {
      sessionStorage.setItem(DISMISS_KEY, serializeDismissedIds(next));
    } catch {
      // In-memory state still hides it when storage is unavailable.
    }
  }

  if (!hydrated || !currentItem) return null;

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
        onClick={() => dismissItem(currentItem.id)}
        type="button"
      >
        <X aria-hidden size={18} />
      </button>
    </section>
  );
}
