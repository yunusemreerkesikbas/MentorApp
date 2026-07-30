"use client";

import { useState, useSyncExternalStore } from "react";
import X from "lucide-react/dist/esm/icons/x.mjs";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

import { PuhuImage } from "@/components/puhu-image";
import { Link } from "@/i18n/navigation";

const NUDGE_DISMISS_KEY = "mentor.desktop-coach-fab.nudge-dismissed";

/** Read once on the client; the dismiss action drives re-renders via local state instead. */
const subscribeStoredDismiss = () => () => undefined;

function readStoredDismiss(): boolean {
  try {
    return sessionStorage.getItem(NUDGE_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Desktop-only floating Puhu coach entry (bottom-right).
 * Mobile keeps the elevated center tab FAB — this must stay `hidden lg:block`.
 */
export function DesktopCoachFab() {
  const t = useTranslations("nav");
  const reduceMotion = useReducedMotion();
  // Server renders the nudge hidden, so hydration never flashes it before the storage read.
  const storedDismiss = useSyncExternalStore(
    subscribeStoredDismiss,
    readStoredDismiss,
    () => true,
  );
  const [dismissedNow, setDismissedNow] = useState(false);
  const nudgeDismissed = storedDismiss || dismissedNow;

  function handleDismissNudge() {
    setDismissedNow(true);
    try {
      sessionStorage.setItem(NUDGE_DISMISS_KEY, "1");
    } catch {
      // sessionStorage may be blocked; keep dismiss in memory for this mount
    }
  }

  return (
    <div
      className="pointer-events-none fixed bottom-6 right-6 z-30 hidden flex-col items-end gap-2 lg:flex"
      data-testid="desktop-coach-fab"
    >
      {!nudgeDismissed ? (
        <div className="pointer-events-auto relative">
          <div className="mentor-coach-bubble mentor-coach-bubble--end relative max-w-[280px] rounded-[var(--radius-card)] border border-white bg-white p-4 shadow-[var(--shadow-card)]">
            <button
              type="button"
              onClick={handleDismissNudge}
              className="absolute right-2 top-2 inline-flex min-h-8 min-w-8 cursor-pointer items-center justify-center rounded-[var(--radius-card)] transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
              style={{ color: "var(--color-secondary)" }}
              aria-label={t("coach_fab_dismiss")}
            >
              <X className="size-4" aria-hidden />
            </button>
            <p
              className="pr-6 text-sm leading-relaxed"
              style={{
                color: "var(--color-body)",
                fontFamily: "var(--font-body)",
              }}
            >
              {t("coach_fab_nudge")}
            </p>
          </div>
        </div>
      ) : null}

      <Link
        href="/coach"
        aria-label={t("coach_fab_aria")}
        className={`pointer-events-auto inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${
          !reduceMotion ? "mentor-puhu-bounce" : ""
        }`}
      >
        <PuhuImage variant="encouraging" size="md" />
      </Link>
    </div>
  );
}
