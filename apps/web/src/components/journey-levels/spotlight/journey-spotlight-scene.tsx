"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type {
  CommunityLevelView,
  JourneyLevelCelebrationView,
  JourneyLevelChapterId,
  JourneyLevelKey,
} from "@mentor/types";
import { Button } from "@mentor/ui";

import { JourneyLevelCelebration } from "../journey-level-celebration";
import { JourneyBadgeStage } from "./journey-badge-stage";
import { SpotlightLamp } from "./spotlight-lamp";
import { StageBackdrop } from "./stage-backdrop";
import {
  SPOTLIGHT_CENTER_X,
  SPOTLIGHT_SWEEP_KEYFRAMES,
  lightXFromPointer,
  resolveSpotlightTimeline,
} from "./spotlight-choreography";

type LevelCopyKey = `levels.${JourneyLevelKey}.${"name" | "story"}`;
type ChapterCopyKey = `chapters.${JourneyLevelChapterId}.${"label" | "name"}`;

type JourneySpotlightSceneProps = { onClose: () => void } & (
  /** Tapped from the profile badge. Nothing to acknowledge, so the close button is the only exit. */
  | { mode: "replay"; level: CommunityLevelView }
  /** Took over the level-up card: adds the eyebrow and the acknowledge CTA. */
  | {
      mode: "celebration";
      celebration: JourneyLevelCelebrationView;
      busy: boolean;
      error: string | null;
    }
);

export function JourneySpotlightScene(props: JourneySpotlightSceneProps) {
  const reduceMotion = Boolean(useReducedMotion());

  /* Reduced motion keeps the celebration but drops the theatre: the original card is already calm,
     accessible and acknowledges the same way, so it stands in rather than a stripped-down stage.
     The stage lives in its own component so this branch never skips a hook. */
  if (reduceMotion && props.mode === "celebration") {
    return (
      <JourneyLevelCelebration
        celebration={props.celebration}
        busy={props.busy}
        error={props.error}
        onClose={props.onClose}
      />
    );
  }

  return <SpotlightStage {...props} reduceMotion={reduceMotion} />;
}

function SpotlightStage(
  props: JourneySpotlightSceneProps & { reduceMotion: boolean },
) {
  const { onClose, reduceMotion } = props;
  const t = useTranslations("journey_levels");
  const timeline = resolveSpotlightTimeline(reduceMotion);

  const level = props.mode === "replay" ? props.level : null;
  const celebration = props.mode === "celebration" ? props.celebration : null;
  const busy = props.mode === "celebration" ? props.busy : false;
  const error = props.mode === "celebration" ? props.error : null;
  const source = celebration ?? level!;
  const { tier, key: levelKey, chapter } = source;
  const titleId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const stageRectRef = useRef<DOMRect | null>(null);

  /* Reduced motion zeroes the whole timeline, so every beat starts already finished. */
  const instant = timeline.dimMs === 0;
  const [lampVisible, setLampVisible] = useState(instant);
  const [lit, setLit] = useState(instant);
  const [settled, setSettled] = useState(timeline.sweepMs === 0);

  /* One value owns the rig. The sweep animates it; the pointer writes it; the spring smooths both. */
  const rawX = useMotionValue(SPOTLIGHT_CENTER_X);
  const lightX = useSpring(rawX, { stiffness: 140, damping: 22, mass: 0.6 });

  /* Read inside the key handler, which is registered once — a ref keeps it current without
     re-binding the listener on every acknowledge state change. */
  const busyRef = useRef(busy);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const name = t(`levels.${levelKey}.name` as LevelCopyKey);
  const story = t(`levels.${levelKey}.story` as LevelCopyKey);
  const chapterLabel = t(`chapters.${chapter}.label` as ChapterCopyKey);
  const chapterName = t(`chapters.${chapter}.name` as ChapterCopyKey);
  const eyebrow = celebration
    ? t(
        celebration.kind === "INTRODUCTION"
          ? "celebration.introduction_eyebrow"
          : "celebration.level_up_eyebrow",
      )
    : null;

  /* Dialog plumbing — same contract as the guide dialog. */
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    /* Focus the stage itself first: the CTA is still faded out during the sweep, and parking focus
       on an invisible control is worse than parking it on the trap container. */
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        /* An acknowledge is in flight; swallowing Escape keeps the request and the UI in step. */
        if (busyRef.current) return;
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      /* Hand focus back to whatever opened the scene — the badge button, or the page behind an
         auto-fired celebration. Same contract as the card this replaced. */
      window.requestAnimationFrame(() => previousFocus?.focus());
    };
  }, [onClose]);

  /* Once the beam settles the copy and CTA are on screen, so focus can land somewhere useful. */
  useEffect(() => {
    if (!settled) return;
    const cta = dialogRef.current?.querySelector<HTMLElement>(
      "[data-journey-celebration-cta]",
    );
    (cta ?? closeButtonRef.current)?.focus();
  }, [settled]);

  /* Cache the stage box so pointer moves never force a layout read mid-frame. */
  useEffect(() => {
    const measure = () => {
      stageRectRef.current = dialogRef.current?.getBoundingClientRect() ?? null;
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  /* Three beats: the room goes dark, it stays dark for a moment, then the rig descends and only
     after it has landed does the lamp strike. */
  useEffect(() => {
    if (lampVisible) return;
    const id = window.setTimeout(
      () => setLampVisible(true),
      timeline.dimMs + timeline.darkHoldMs,
    );
    return () => window.clearTimeout(id);
  }, [lampVisible, timeline.dimMs, timeline.darkHoldMs]);

  useEffect(() => {
    if (lit) return;
    const id = window.setTimeout(
      () => setLit(true),
      timeline.dimMs + timeline.darkHoldMs + timeline.lampDropMs,
    );
    return () => window.clearTimeout(id);
  }, [lit, timeline.dimMs, timeline.darkHoldMs, timeline.lampDropMs]);

  /* The swing, then control passes to the pointer. */
  useEffect(() => {
    if (!lit || settled) return;
    const controls = animate(rawX, SPOTLIGHT_SWEEP_KEYFRAMES, {
      duration: timeline.sweepMs / 1000,
      ease: "easeInOut",
      onComplete: () => setSettled(true),
    });
    return () => controls.stop();
  }, [lit, settled, rawX, timeline.sweepMs]);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!settled) return;
      /* Touch and pen only steer while pressed; a mouse steers on hover. */
      if (event.pointerType !== "mouse" && event.buttons === 0) return;
      const rect = stageRectRef.current;
      if (!rect) return;
      rawX.set(lightXFromPointer(event.clientX, rect.left, rect.width));
    },
    [settled, rawX],
  );

  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.section
      ref={dialogRef}
      role="dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-labelledby={titleId}
      className="journey-spotlight-theme fixed inset-0 z-[60] touch-none select-none overflow-hidden bg-[var(--color-bg)] text-[var(--color-main)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: timeline.dimMs / 1000 || 0.12, ease: "easeOut" }}
      onPointerMove={handlePointerMove}
      /* Publishes the rig position to CSS so any layer can light itself where the beam actually
         falls, instead of brightening as a whole. framer writes the variable straight from the
         motion value — no rAF loop, no React render per frame. */
      style={{ "--spotlight-x": lightX } as React.CSSProperties}
    >
      <StageBackdrop
        tier={tier}
        chapterName={chapterName}
        lightX={lightX}
        lit={lit}
      />

      <SpotlightLamp
        lightX={lightX}
        visible={lampVisible}
        lit={lit}
        dropMs={timeline.lampDropMs}
      />

      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        disabled={busy}
        aria-label={t("close")}
        className="absolute right-3 top-[max(12px,env(safe-area-inset-top))] z-30 grid size-11 place-items-center rounded-full text-[var(--color-secondary)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_10%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <X size={20} aria-hidden="true" />
      </button>

      <div className="relative z-20 flex h-full flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.86 }}
          animate={{ opacity: lit ? 1 : 0, scale: 1 }}
          transition={{ duration: timeline.badgeRevealMs / 1000 || 0.12, ease: "easeOut" }}
        >
          <JourneyBadgeStage
            levelKey={levelKey}
            lightX={lightX}
            className="size-40 sm:size-52"
          />
        </motion.div>

        <motion.div
          className="mt-10 text-center"
          initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
          animate={{ opacity: settled ? 1 : 0, y: 0 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.5, ease: "easeOut" }}
        >
          {eyebrow ? (
            <p className="text-sm font-bold text-[var(--spotlight-beam)]">{eyebrow}</p>
          ) : null}
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-secondary)]">
            {chapterLabel}
          </p>
          <h2 id={titleId} className="mt-2 text-2xl font-extrabold sm:text-3xl">
            {t("level_title", { tier, name })}
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[var(--color-body)]">
            {story}
          </p>

          {celebration ? (
            <div className="mt-7">
              <Button onClick={onClose} disabled={busy} data-journey-celebration-cta>
                {t("celebration.continue")}
              </Button>
              {error ? (
                <p role="alert" className="mt-3 text-sm text-[var(--color-body)]">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}
        </motion.div>
      </div>

      {/* Floor pool. Tracks the rig: the beam widens as it falls, so the pool travels further than
          the lamp does — that overshoot is what sells the tilt. Kept near the beam's own footprint;
          a pool spanning half the screen reads as ambient haze rather than light landing, and it
          reaches high enough to meet the cone instead of leaving a dark gap under it. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[44%]"
        style={{
          /* Wide and shallow, like light grazing a floor. The two radii are measured against
             different axes of this box — the first against its width, the second against its
             height — so matching numbers do not give a circle. An earlier `19% 100%` was a third
             as wide as it was tall, which is why the pool read as an upright blob. Sitting at 86%
             rather than the bottom edge keeps the whole ellipse on screen instead of clipping its
             lower half. */
          background:
            "radial-gradient(ellipse 28% 9% at calc(50% + (var(--spotlight-x) - 0.5) * 90%) 86%, var(--spotlight-floor), color-mix(in srgb, var(--spotlight-floor) 40%, transparent) 46%, transparent 78%)",
        }}
      />

      {/* No cast shadow on the floor, and this is deliberate — it was tried and removed. The badge
          is a floating emblem, not an object standing in the pool, and the beam visibly carries
          past it to the ground; a dark patch down there contradicts the light we can see landing
          and reads as a smudge on the floor rather than a shadow. */}
    </motion.section>,
    document.body,
  );
}
