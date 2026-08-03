"use client";
import { X } from "lucide-react";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useIsMounted } from "@/lib/use-is-mounted";
import { CoachHistoryPanel } from "./coach-history-panel";
import {
  CoachSessionPortal,
  useCoachSession,
} from "./coach-session-context";

const CLOSE_ANIMATION_MS = 220;

interface CoachHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Mobile left history drawer. Desktop uses the always-open rail in CoachChatShell.
 */
export function CoachHistoryDrawer({ open, onClose }: CoachHistoryDrawerProps) {
  const tClose = useTranslations("common.bottom_sheet");
  const session = useCoachSession();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const mounted = useIsMounted();
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      document.documentElement.classList.add("mentor-drawer-open");
    } else {
      document.documentElement.classList.remove("mentor-drawer-open");
    }
    return () => {
      document.documentElement.classList.remove("mentor-drawer-open");
    };
  }, [open]);

  useEffect(() => {
    if (!open || closing) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setClosing(true);
      window.setTimeout(() => {
        setClosing(false);
        onClose();
      }, CLOSE_ANIMATION_MS);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closing, onClose]);

  useEffect(() => {
    if (!open || closing) return;
    const first = panelRef.current?.querySelector<HTMLElement>(
      "button, [href], [tabindex]:not([tabindex='-1'])",
    );
    first?.focus();
  }, [open, closing]);

  function handleClose() {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      onClose();
    }, CLOSE_ANIMATION_MS);
  }

  if (!mounted || (!open && !closing)) return null;

  return createPortal(
    <CoachSessionPortal value={session}>
      <div className="fixed inset-0 z-[80] lg:hidden" data-testid="coach-history-drawer">
        <button
          type="button"
          aria-label={tClose("close")}
          className="absolute inset-0 bg-black/40 backdrop-blur-[6px]"
          style={{
            animation: closing
              ? "none"
              : "drawer-backdrop-enter 200ms ease-out forwards",
          }}
          onClick={handleClose}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={[
            "fixed inset-y-0 left-0 z-[81] flex w-[min(85vw,20rem)] flex-col bg-white",
            "rounded-r-[16px] shadow-[8px_0_24px_rgba(0,0,0,0.10)] sm:w-[20rem]",
            closing ? "animate-drawer-left-out" : "animate-drawer-left-in",
          ].join(" ")}
        >
          <div className="relative flex min-h-0 flex-1 flex-col">
            <button
              type="button"
              onClick={handleClose}
              aria-label={tClose("close")}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-black/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{ color: "var(--color-secondary)" }}
            >
              <X size={18} aria-hidden />
            </button>
            <CoachHistoryPanel titleId={titleId} onAfterNavigate={handleClose} />
          </div>
        </div>
      </div>
    </CoachSessionPortal>,
    document.body,
  );
}
