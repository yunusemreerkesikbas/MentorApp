"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
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
import {
  JOURNEY_LEVEL_CATALOG,
  type JourneyLevelCatalogItem,
} from "../journey-level-catalog";
import { JourneyBadgeStage } from "./journey-badge-stage";
import { SpotlightLamp } from "./spotlight-lamp";
import { StageBackdrop } from "./stage-backdrop";
import {
  NEIGHBOUR_SLOT_X,
  SPOTLIGHT_CENTER_X,
  SPOTLIGHT_SWEEP_KEYFRAMES,
  lightXFromPointer,
  resolveIdleRecentreMs,
  resolveSpotlightTimeline,
  resolveSpotlightTravel,
} from "./spotlight-choreography";

/**
 * New content arrives from the side the beam travelled to; the old leaves the other way.
 *
 * The badge also scales, as if it walks out of the light and the next one walks in; the copy only
 * slides, because scaling text mid-transition reads as a glitch rather than depth. Both stay on
 * transform and opacity — no `filter`, which would drop the pair off the compositor.
 */
const BADGE_TRAVEL_VARIANTS = {
  enter: (slot: number) => ({ x: slot * 170, opacity: 0, scale: 0.72 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (slot: number) => ({ x: slot * -170, opacity: 0, scale: 0.72 }),
};

const COPY_TRAVEL_VARIANTS = {
  enter: (slot: number) => ({ x: slot * 120, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (slot: number) => ({ x: slot * -120, opacity: 0 }),
};

const TRAVEL_EASE = [0.22, 1, 0.36, 1] as const;

type LevelCopyKey = `levels.${JourneyLevelKey}.${"name" | "story"}`;
type ChapterCopyKey = `chapters.${JourneyLevelChapterId}.label`;

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
  /* The student's real tier never changes while the scene is open; it decides which badge wears
     the accent ring, so browsing the ladder never loses track of where you actually are. */
  const ownTier = source.tier;
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

  /* Which tier is on stage. Starts at the student's own and walks the ladder from there.
     A celebration stays put: wandering off mid-moment dilutes the thing being celebrated. */
  const canTravel = props.mode === "replay";
  const [viewed, setViewed] = useState<JourneyLevelCatalogItem>(
    () =>
      JOURNEY_LEVEL_CATALOG.find((item) => item.tier === source.tier) ??
      JOURNEY_LEVEL_CATALOG[0]!,
  );
  const [travelSlot, setTravelSlot] = useState<-1 | 1>(1);
  const travellingRef = useRef(false);
  const idleTimerRef = useRef<number | undefined>(undefined);
  const travelTimerRef = useRef<number | undefined>(undefined);
  const releaseTimerRef = useRef<number | undefined>(undefined);
  const travel = resolveSpotlightTravel(reduceMotion);
  const idleRecentreMs = resolveIdleRecentreMs(reduceMotion);

  const tier = viewed.tier;
  const levelKey = viewed.key;
  const chapter = viewed.chapter;
  const locked = tier > ownTier;

  /* Read inside the key handler, which is registered once — a ref keeps it current without
     re-binding the listener on every acknowledge state change. */
  const busyRef = useRef(busy);
  const closeRef = useRef(onClose);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  const name = t(`levels.${levelKey}.name` as LevelCopyKey);
  const story = t(`levels.${levelKey}.story` as LevelCopyKey);
  const chapterLabel = t(`chapters.${chapter}.label` as ChapterCopyKey);
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
        closeRef.current();
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
  }, []);

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
      if (!settled || travellingRef.current) return;
      /* Touch and pen only steer while pressed; a mouse steers on hover. */
      if (event.pointerType !== "mouse" && event.buttons === 0) return;
      const rect = stageRectRef.current;
      if (!rect) return;
      rawX.set(lightXFromPointer(event.clientX, rect.left, rect.width));

      /* The operator lets go and the beam drifts back onto the badge. Every move cancels the
         pending drift, so it never fights a hand that is still moving. */
      if (idleRecentreMs === null) return;
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => {
        if (travellingRef.current) return;
        animate(rawX, SPOTLIGHT_CENTER_X, { duration: 0.9, ease: "easeInOut" });
      }, idleRecentreMs);
    },
    [settled, rawX, idleRecentreMs],
  );

  useEffect(
    () => () => {
      window.clearTimeout(idleTimerRef.current);
      window.clearTimeout(travelTimerRef.current);
      window.clearTimeout(releaseTimerRef.current);
    },
    [],
  );

  /**
   * Two beats. The beam reaches the neighbour and lights it while the centre goes dark, then the
   * stage hands that badge the middle and the beam comes home. Swapping the tier between the beats
   * is what makes it read as "the light found it, then it took the stage" rather than a crossfade.
   */
  const handleTravel = useCallback(
    (target: JourneyLevelCatalogItem, slot: -1 | 1) => {
      if (travellingRef.current) return;
      travellingRef.current = true;
      window.clearTimeout(idleTimerRef.current);
      setTravelSlot(slot);

      const reachX = slot === -1 ? NEIGHBOUR_SLOT_X.previous : NEIGHBOUR_SLOT_X.next;

      /* Beat boundaries run on timers, not on the animation's `onComplete`. Tying the tier swap to
         the animation means a throttled tab — background, reduced performance, anything that stops
         animation frames — never lands the travel, leaving `travellingRef` stuck and the scene
         unable to move again. The animations are the visuals; the timers are the state machine. */
      animate(rawX, reachX, {
        duration: travel.reachMs / 1000,
        ease: "easeOut",
      });

      travelTimerRef.current = window.setTimeout(() => {
        setViewed(target);
        animate(rawX, SPOTLIGHT_CENTER_X, {
          duration: travel.settleMs / 1000,
          ease: "easeInOut",
        });
        releaseTimerRef.current = window.setTimeout(() => {
          travellingRef.current = false;
        }, travel.settleMs);
      }, travel.reachMs);
    },
    [rawX, travel.reachMs, travel.settleMs],
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
        ownTier={ownTier}
        backdropWord={name}
        lightX={lightX}
        lit={lit}
        onTravel={canTravel ? handleTravel : undefined}
        travelLabel={(key) =>
          t("spotlight_travel", { name: t(`levels.${key}.name` as LevelCopyKey) })
        }
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

      {/* Transparent but full-screen: without `pointer-events-none` this layer sits at z-20 over
          the neighbour buttons in the backdrop and swallows every click meant for them. Only the
          acknowledge CTA inside needs to be clickable, and it re-enables itself. */}
      <div className="pointer-events-none relative z-20 flex h-full flex-col items-center justify-center px-6">
        {/* The two tiers overlap while they cross, so the children are absolute inside a box with
            a reserved size. `mode="wait"` was wrong twice over: it plays the swap sequentially —
            out, then in, which reads as a replacement rather than a slide — and it will not mount
            the incoming tier until the outgoing one finishes, so a tab with throttled animation
            frames never shows the new level at all. */}
        <motion.div
          className="relative size-40 sm:size-52"
          initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.86 }}
          animate={{ opacity: lit ? 1 : 0, scale: 1 }}
          transition={{ duration: timeline.badgeRevealMs / 1000 || 0.12, ease: "easeOut" }}
        >
          <AnimatePresence custom={travelSlot} initial={false}>
            <motion.div
              key={viewed.tier}
              custom={travelSlot}
              variants={BADGE_TRAVEL_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: reduceMotion ? 0 : 0.55, ease: TRAVEL_EASE }}
              className="absolute inset-0"
            >
              <JourneyBadgeStage
                levelKey={levelKey}
                lightX={lightX}
                current={tier === ownTier}
                future={locked}
                className="size-full"
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <motion.div
          className="relative mt-10 min-h-[8.5rem] w-full max-w-md text-center"
          initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
          animate={{ opacity: settled ? 1 : 0, y: 0 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.5, ease: "easeOut" }}
        >
          <AnimatePresence custom={travelSlot} initial={false}>
            <motion.div
              key={viewed.tier}
              custom={travelSlot}
              variants={COPY_TRAVEL_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: reduceMotion ? 0 : 0.55, ease: TRAVEL_EASE }}
              className="absolute inset-x-0 top-0"
            >
              {eyebrow ? (
                <p className="text-sm font-bold text-[var(--spotlight-beam)]">{eyebrow}</p>
              ) : null}
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-secondary)]">
                {chapterLabel}
              </p>
              {/* The name is written across the back wall instead, so the heading stays short.
                  It is still in the accessible name — the wall copy is decorative. */}
              <h2 id={titleId} className="mt-2 text-2xl font-extrabold sm:text-3xl">
                {t("level_label", { tier })}
                <span className="sr-only"> · {name}</span>
              </h2>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[var(--color-body)]">
                {locked ? t("spotlight_locked") : story}
              </p>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Outside the copy block, which now holds absolutely-positioned children — a CTA left
            inside it would start at that box's top edge and sit on top of the story. */}
        {celebration ? (
          <motion.div
            className="pointer-events-auto text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: settled ? 1 : 0 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.5, ease: "easeOut" }}
          >
            <Button onClick={onClose} disabled={busy} data-journey-celebration-cta>
              {t("celebration.continue")}
            </Button>
            {error ? (
              <p role="alert" className="mt-3 text-sm text-[var(--color-body)]">
                {error}
              </p>
            ) : null}
          </motion.div>
        ) : null}
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
