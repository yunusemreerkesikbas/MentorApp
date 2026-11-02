"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type RefObject } from "react";
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

/**
 * 16:9 set: desktop and tablet landscape. 9:16 set: phones and tablets held upright. Square set:
 * the rest (a phone on its side, a short window).
 */
const MEDIA = {
  square: {
    closed: "/visuals/chest/desk-chest-closed.webp",
    open: "/visuals/chest/desk-chest-open.webp",
    clip: "/visuals/chest/chest-open.mp4",
    strip: "desk",
  },
  wide: {
    closed: "/visuals/chest/desk-chest-closed-wide.webp",
    open: "/visuals/chest/desk-chest-open-wide.webp",
    clip: "/visuals/chest/chest-open-wide.mp4",
    strip: "deskWide",
  },
  tall: {
    closed: "/visuals/chest/desk-chest-closed-tall.webp",
    open: "/visuals/chest/desk-chest-open-tall.webp",
    clip: "/visuals/chest/chest-open-tall.mp4",
    strip: "deskTall",
  },
} as const;
type Layout = keyof typeof MEDIA;
type MediaSet = (typeof MEDIA)[Layout];
/** Landscape and tall enough that the desk below the chest holds the text row. */
const WIDE_QUERY = "(orientation: landscape) and (min-width: 768px) and (min-height: 560px)";
const TALL_QUERY = "(orientation: portrait)";
/** How long the lamps take to flow into the lock before the lid opens. */
const FLOW_MS = 400;

type Phase = "ready" | "flow" | "clip" | "inside";

function subscribeLayout(onChange: () => void) {
  const queries = [WIDE_QUERY, TALL_QUERY].map((query) => window.matchMedia(query));
  queries.forEach((query) => query.addEventListener("change", onChange));
  return () => queries.forEach((query) => query.removeEventListener("change", onChange));
}
function currentLayout(): Layout {
  if (window.matchMedia(WIDE_QUERY).matches) return "wide";
  return window.matchMedia(TALL_QUERY).matches ? "tall" : "square";
}

/**
 * "Masa lambası" (DESIGN.md §9 scene exception): the chest on Puhu's desk, one lamp per day. Tap →
 * the lamps flow into the lock → Puhu opens it (clip, tap to skip) → the week's note and the Coin.
 * An opened chest goes straight to the note. Reduced motion: no clip, a 200ms crossfade.
 * Landscape and upright screens get a room that fills the screen (16:9 or 9:16), the buttons on the
 * desk in front of the chest; the square set is the fallback.
 * `onClose(opened)` tells the panel whether the chest was stamped, so it can refresh.
 */
export function ChestScene({ chest, onClose }: { chest: WeeklyChestView; onClose: (opened: boolean) => void }) {
  const t = useTranslations("weeklyChest");
  const reduceMotion = Boolean(useReducedMotion());
  const layout = useSyncExternalStore(subscribeLayout, currentLayout, (): Layout => "square");
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
  }, [phase, layout]);

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
  const media = MEDIA[layout];
  const art = (
    <SceneArt
      media={media}
      phase={phase}
      still={reduceMotion || revisit}
      lamps={chestLamps(chest)}
      videoRef={videoRef}
      onEnded={() => setPhase("inside")}
      onOpen={open}
      onSkip={skip}
    />
  );
  const title = (
    <div>
      <p className="text-2xl font-black leading-tight text-[var(--wc-title)] sm:text-3xl">
        {chest.carriedOver ? t("scene_title_carried", { days }) : t("scene_title", { days })}
      </p>
      <p className="mt-2 text-base font-bold text-[var(--wc-body)]">{t("scene_body")}</p>
    </div>
  );
  const readyButtons = (
    <>
      <SceneButton gold autoFocus onClick={open}>
        {t("scene_open")}
      </SceneButton>
      <SceneButton onClick={close}>{t("scene_later")}</SceneButton>
    </>
  );
  const insideContent = (
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
  );

  return createPortal(
    <div
      ref={panelRef}
      className="weekly-chest-night fixed inset-0 z-[120] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="weekly-chest-scene"
      data-phase={phase}
      data-layout={layout}
    >
      <h2 id={titleId} className="sr-only">
        {t("title")}
      </h2>
      {layout !== "square" ? (
        <>
          <div className="fixed inset-0 overflow-hidden">
            <div className={layout === "wide" ? "wc-cover" : "wc-cover wc-cover-tall"}>{art}</div>
          </div>
          {inside ? (
            <div className="relative flex min-h-full flex-col items-center justify-center gap-5 px-4 py-8 text-center">
              <ChestSceneNote chest={view} animate={!revisit} />
              {insideContent}
            </div>
          ) : layout === "tall" ? (
            <>
              {/* Upright: the title over the shelves, the buttons on the desk in front of the chest. */}
              <div className="wc-shelf-bar fixed inset-x-0 top-0 px-6 pb-12 pt-[max(2rem,env(safe-area-inset-top))] text-center">
                {title}
              </div>
              <div className="wc-desk-bar fixed inset-x-0 bottom-0 flex justify-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-12">
                <div className={`flex w-full max-w-xs flex-col gap-3 ${phase === "ready" ? "" : "invisible"}`}>
                  {readyButtons}
                </div>
              </div>
            </>
          ) : (
            <div className="wc-desk-bar fixed inset-x-0 bottom-0">
              <div className="mx-auto flex w-full max-w-5xl items-end justify-between gap-6 px-8 pb-6 pt-16 text-left">
                {title}
                <div className={`flex w-[26rem] shrink-0 flex-row-reverse gap-3 ${phase === "ready" ? "" : "invisible"}`}>
                  {readyButtons}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <SceneBackdrop media={media} open={inside} />
          <div className="relative mx-auto flex min-h-full w-full max-w-[720px] flex-col items-center justify-center py-8">
            <div className="relative aspect-square w-full max-w-[min(720px,64dvh)] select-none overflow-hidden">
              <div className="wc-feather absolute inset-0">{art}</div>
              {inside ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ChestSceneNote chest={view} animate={!revisit} />
                </div>
              ) : null}
            </div>
            <div className="flex w-full flex-col items-center gap-5 px-4 pt-5 text-center">
              {inside ? (
                insideContent
              ) : (
                <>
                  {title}
                  <div className={`flex w-full max-w-xs flex-col gap-3 ${phase === "ready" ? "" : "invisible"}`}>
                    {readyButtons}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}

/** The desk picture or the clip, the lamps on it, and the invisible tap targets (open, skip). */
function SceneArt({
  media,
  phase,
  still,
  lamps,
  videoRef,
  onEnded,
  onOpen,
  onSkip,
}: {
  media: MediaSet;
  phase: Phase;
  still: boolean;
  lamps: boolean[];
  videoRef: RefObject<HTMLVideoElement | null>;
  onEnded: () => void;
  onOpen: () => void;
  onSkip: () => void;
}) {
  const inside = phase === "inside";
  return (
    <>
      <div className={`absolute inset-0 select-none ${inside ? "wc-dim" : ""}`}>
        {still ? (
          <>
            {/* Two fixed local stills that crossfade, the clip's own first and last frames. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
            <img src={media.closed} alt="" className={`wc-fade absolute inset-0 size-full ${inside ? "opacity-0" : ""}`} />
            {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
            <img src={media.open} alt="" className={`wc-fade absolute inset-0 size-full ${inside ? "" : "opacity-0"}`} />
          </>
        ) : (
          <video
            ref={videoRef}
            src={media.clip}
            poster={media.closed}
            muted
            playsInline
            preload="auto"
            onEnded={onEnded}
            className="absolute inset-0 size-full object-cover"
            aria-hidden
          />
        )}
        {phase === "ready" || phase === "flow" ? (
          <span className={phase === "ready" ? "wc-twinkle" : undefined}>
            <ChestLamps lamps={lamps} strip={media.strip} flowing={phase === "flow"} />
          </span>
        ) : null}
      </div>
      {phase === "ready" ? (
        <button type="button" tabIndex={-1} aria-hidden onClick={onOpen} className="absolute inset-0 cursor-pointer" />
      ) : null}
      {/* Tap anywhere on the clip to skip it; no visible button over the art. */}
      {phase === "clip" ? (
        <button type="button" tabIndex={-1} aria-hidden onClick={onSkip} className="absolute inset-0 cursor-pointer" />
      ) : null}
    </>
  );
}

/**
 * The desk carried out to the screen's edges: the same still, blurred and darkened, behind the
 * square clip, whose feathered edges melt into it. No extra art; the room just goes on.
 */
function SceneBackdrop({ media, open }: { media: MediaSet; open: boolean }) {
  return (
    <div className="wc-backdrop" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- the scene's own local stills, blurred */}
      <img src={media.closed} alt="" className={`wc-fade ${open ? "opacity-0" : ""}`} />
      {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
      <img src={media.open} alt="" className={`wc-fade ${open ? "" : "opacity-0"}`} />
    </div>
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
