"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { WeeklyChestView } from "@mentor/types";
import { trapFocus } from "@/lib/trap-focus";
import { openWeeklyChest } from "@/lib/weekly-chest";
import { ChestLamps } from "./chest-art";
import { ChestSceneNote, ChestSceneReward } from "./chest-scene-note";
import { chestLamps } from "./weekly-chest-model";
import "./weekly-chest.css";

const MEDIA = {
  closed: "/visuals/chest/desk-chest-closed.webp",
  open: "/visuals/chest/desk-chest-open.webp",
  clip: "/visuals/chest/chest-open.mp4",
} as const;
/** How long the lamps take to flow into the lock before the lid opens. */
const FLOW_MS = 400;

type Phase = "ready" | "flow" | "clip" | "inside";

/**
 * "Masa lambası" (DESIGN.md §9 scene exception): the chest on Puhu's desk, one lamp per day. Tap →
 * the lamps flow into the lock → Puhu opens it (clip, tap to skip) → the week's note and the Coin.
 * An opened chest goes straight to the note. Reduced motion: no clip, a 200ms crossfade.
 * `onClose(opened)` tells the panel whether the chest was stamped, so it can refresh.
 */
export function ChestScene({ chest, onClose }: { chest: WeeklyChestView; onClose: (opened: boolean) => void }) {
  const t = useTranslations("weeklyChest");
  const reduceMotion = Boolean(useReducedMotion());
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const revisit = chest.state === "OPENED";
  const [phase, setPhase] = useState<Phase>(revisit ? "inside" : "ready");
  const [view, setView] = useState(chest);
  const [failed, setFailed] = useState(false);
  const stamped = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const close = () => onCloseRef.current(stamped.current);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current(stamped.current);
      else if (event.key === "Tab") trapFocus(event, panelRef.current);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  // Each resting phase hands focus to its main button.
  useEffect(() => {
    if (phase === "ready" || phase === "inside") {
      panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "flow") {
      const timer = window.setTimeout(() => setPhase("clip"), FLOW_MS);
      return () => window.clearTimeout(timer);
    }
    if (phase === "clip") {
      // Autoplay refused (power saving, data saver): skip straight to the note.
      void videoRef.current?.play().catch(() => setPhase("inside"));
    }
  }, [phase]);

  function open() {
    if (phase !== "ready") return;
    void openWeeklyChest(chest.periodKey).then(
      (next) => {
        stamped.current = next.state === "OPENED";
        setView(next);
      },
      () => setFailed(true),
    );
    setPhase(reduceMotion ? "inside" : "flow");
  }

  function skip() {
    videoRef.current?.pause();
    setPhase("inside");
  }

  const inside = phase === "inside";
  const days = chest.summary?.activeDays ?? chest.current;

  return createPortal(
    <div
      ref={panelRef}
      className="weekly-chest-night fixed inset-0 z-[120] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="weekly-chest-scene"
      data-phase={phase}
    >
      <h2 id={titleId} className="sr-only">
        {t("title")}
      </h2>
      <div className="mx-auto flex min-h-full w-full max-w-[480px] flex-col items-center pb-8">
        <div className="relative aspect-square w-full max-w-[min(480px,58dvh)] select-none overflow-hidden">
          <div className={`absolute inset-0 ${inside ? "wc-dim" : ""}`}>
            {reduceMotion || revisit ? (
              <>
                {/* Two fixed local stills that crossfade, the clip's own first and last frames. */}
                {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
                <img src={MEDIA.closed} alt="" className={`wc-fade absolute inset-0 size-full ${inside ? "opacity-0" : ""}`} />
                {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
                <img src={MEDIA.open} alt="" className={`wc-fade absolute inset-0 size-full ${inside ? "" : "opacity-0"}`} />
              </>
            ) : (
              <video
                ref={videoRef}
                src={MEDIA.clip}
                poster={MEDIA.closed}
                muted
                playsInline
                preload="auto"
                onEnded={() => setPhase("inside")}
                className="absolute inset-0 size-full object-cover"
                aria-hidden
              />
            )}
            {phase === "ready" || phase === "flow" ? (
              <span className={phase === "ready" ? "wc-twinkle" : undefined}>
                <ChestLamps lamps={chestLamps(chest)} strip="desk" flowing={phase === "flow"} />
              </span>
            ) : null}
          </div>

          {phase === "ready" ? (
            <button type="button" tabIndex={-1} aria-hidden onClick={open} className="absolute inset-0 cursor-pointer" />
          ) : null}
          {phase === "clip" ? (
            <>
              <button type="button" tabIndex={-1} aria-hidden onClick={skip} className="absolute inset-0 cursor-pointer" />
              <button
                type="button"
                onClick={skip}
                className="wc-ghost-button absolute bottom-3 right-3 min-h-11 rounded-full px-4 text-sm font-extrabold outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              >
                {t("scene_skip")}
              </button>
            </>
          ) : null}
          {inside ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <ChestSceneNote chest={view} animate={!revisit} />
            </div>
          ) : null}
        </div>

        <div className="flex w-full flex-col items-center gap-5 px-4 pt-5 text-center">
          {inside ? (
            <>
              <ChestSceneReward chest={view} celebrate={!revisit} reduceMotion={reduceMotion} />
              {failed ? (
                <p className="text-sm font-bold text-[var(--wc-body)]" role="alert">
                  {t("open_error")}
                </p>
              ) : null}
              <SceneButton gold autoFocus onClick={close}>
                {t("scene_continue")}
              </SceneButton>
            </>
          ) : (
            <>
              <div>
                <p className="text-2xl font-black leading-tight text-[var(--wc-title)] sm:text-3xl">
                  {chest.carriedOver ? t("scene_title_carried", { days }) : t("scene_title", { days })}
                </p>
                <p className="mt-2 text-base font-bold text-[var(--wc-body)]">{t("scene_body")}</p>
              </div>
              <div className={`flex w-full max-w-xs flex-col gap-3 ${phase === "ready" ? "" : "invisible"}`}>
                <SceneButton gold autoFocus onClick={open}>
                  {t("scene_open")}
                </SceneButton>
                <SceneButton onClick={close}>{t("scene_later")}</SceneButton>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SceneButton({
  gold = false,
  autoFocus = false,
  onClick,
  children,
}: {
  gold?: boolean;
  autoFocus?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-autofocus={autoFocus || undefined}
      className={`${gold ? "wc-gold-button" : "wc-ghost-button"} min-h-12 w-full max-w-xs cursor-pointer rounded-full px-6 text-base font-black outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--wc-ground)]`}
    >
      {children}
    </button>
  );
}
