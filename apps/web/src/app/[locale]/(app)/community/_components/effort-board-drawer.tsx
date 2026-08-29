"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Trophy, X } from "lucide-react";
import { EffortBoard } from "./effort-board";

/**
 * Mobile/tablet access to the effort board (profile + XP + leaderboard). Below xl the right column
 * can't fit, so an "Emek panosu" trigger opens a right slide-in panel (mirrors the left `ZoneDrawer`).
 * `EffortBoard` is mounted only on first open (no /community/summary fetch while the drawer is idle).
 */
export function EffortBoardDrawer() {
  const t = useTranslations("community");
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false); // first-open latch → keeps content mounted for exit anim
  const close = () => setOpen(false);
  const openDrawer = () => {
    setLoaded(true);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="xl:hidden">
      {/* Trigger — top-right pill, aligned with the mobile top band (mirrors ZoneDrawer's left hamburger). */}
      <button
        type="button"
        onClick={openDrawer}
        aria-label={t("board_open")}
        className="fixed right-3 top-[3.75rem] z-20 flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{
          borderColor: "color-mix(in srgb, var(--color-main) 8%, transparent)",
          background: "color-mix(in srgb, var(--color-bg) 85%, transparent)",
          color: "var(--color-main)",
          fontFamily: "var(--font-heading)",
        }}
      >
        <Trophy className="h-4 w-4" aria-hidden="true" />
        {t("board_open")}
      </button>

      {/* Backdrop — z-[29]: below drawer (z-30), above global content (z-20) */}
      {open && (
        <div
          className="fixed inset-0 z-[29]"
          style={{ top: "3.5rem", background: "rgba(0,0,0,0.3)" }}
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Slide-in panel from the right — starts at top-14 so the global header stays visible */}
      <div
        className="fixed bottom-0 right-0 z-30 w-80 max-w-[85vw] overflow-y-auto px-6 pb-6 transition-transform duration-200"
        style={{
          top: "3.5rem",
          background: "var(--color-bg)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          boxShadow: open ? "var(--shadow-card)" : "none",
        }}
      >
        <div className="sticky top-0 flex justify-end py-3" style={{ background: "var(--color-bg)" }}>
          <button
            type="button"
            onClick={close}
            aria-label={t("board_close")}
            className="rounded-full p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ color: "var(--color-secondary)" }}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {loaded && <EffortBoard />}
      </div>
    </div>
  );
}
