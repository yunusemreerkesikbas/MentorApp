"use client";

import { useCallback, useEffect, useId, useMemo, useRef } from "react";
import type * as React from "react";
import { createPortal } from "react-dom";
import { usePresence, useReducedMotion } from "framer-motion";

import { lastPointer, type LastPointer } from "@/lib/last-pointer";

import { prepareCanvases, type ScenePaints } from "./scene-canvas";
import {
  SCENE_LIGHT,
  deckLayout,
  sparkOrigin,
  visibleCards,
  type DeckLayout,
  type SceneLight,
} from "./scene-choreography";
import type { SceneText } from "./scene-copy";
import { collectSceneDom, type SceneDom } from "./scene-dom";
import type { Point } from "./scene-engine";
import { paintSceneFrame } from "./scene-frame";
import { scheduleHomePulses } from "./home-pulse";
import { SceneStage, type StageCard } from "./scene-stage";
import { useCelebrationDialog } from "./use-celebration-dialog";
import { useSceneDirector, type SceneMoment } from "./use-scene-director";
import { findHomeNode, useSceneGeometry, type SceneGeometry } from "./use-scene-geometry";

/** The fan of a backfill summary keeps this far from the screen edges, px. */
const DECK_GUTTER = 16;

/** Everything a frame needs besides the time, refreshed when the layout changes. */
interface Painted {
  dom: SceneDom;
  paints: ScenePaints;
  geo: SceneGeometry;
  deck: DeckLayout | null;
  lights: ReadonlyArray<SceneLight>;
  origin: Point;
}

export interface AchievementSceneProps {
  /** Every achievement being celebrated; a backfill summary deals the first five as a fan. */
  cards: ReadonlyArray<StageCard>;
  text: SceneText;
  igniteLabel: string;
  /** Said by screen readers when the light comes on ("Yeni bir ışık yandı"). */
  litAnnouncement: string;
  moreLabel: (count: number) => string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
}

/**
 * "Işık Yandı": the achievement celebration (DESIGN.md §9.1, film in design/achievement-scene).
 * React renders the structure and owns the phase; the scene clock paints every frame through refs.
 */
export function AchievementScene({
  cards,
  text,
  igniteLabel,
  litAnnouncement,
  moreLabel,
  busy,
  error,
  onClose,
}: AchievementSceneProps) {
  const reduced = Boolean(useReducedMotion());
  const [isPresent, safeToRemove] = usePresence();
  const rootRef = useRef<HTMLElement | null>(null);
  const slotRef = useRef<HTMLDivElement | null>(null);
  const copyRef = useRef<HTMLDivElement | null>(null);
  const painted = useRef<Painted | null>(null);
  const opening = useRef<{ pointer: LastPointer | null; at: number } | null>(null);
  const pulses = useRef<(() => void) | null>(null);
  const titleId = useId();
  const bodyId = useId();
  const geometry = useSceneGeometry(rootRef, slotRef, copyRef);
  const count = cards.length;
  const shown = useMemo(() => cards.slice(0, visibleCards(count)), [cards, count]);
  const lights = useMemo(() => shown.map((card) => SCENE_LIGHT[card.artKey] ?? SCENE_LIGHT.first_step), [shown]);
  const deck = useMemo(
    () => (geometry && count > 1 ? deckLayout(count, geometry.viewport.width - 2 * DECK_GUTTER, geometry.size) : null),
    [geometry, count],
  );

  const paint = useCallback((moment: SceneMoment) => {
    const stage = painted.current;
    if (!stage) return;
    paintSceneFrame(stage.dom, stage.paints, {
      ...moment,
      geo: stage.geo,
      deck: stage.deck,
      lights: stage.lights,
      origin: stage.origin,
      home: stage.geo.home,
    });
  }, []);

  const { phase, ignite, skip, proceed, dismiss, kick } = useSceneDirector({
    reduced,
    count,
    paint,
    onClose,
    isPresent,
    safeToRemove,
    error,
  });
  useCelebrationDialog(rootRef, { busy, onEscape: dismiss });

  useEffect(() => {
    opening.current = { pointer: lastPointer(), at: performance.now() };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!geometry || !root) return;
    const dom = collectSceneDom(root);
    const paints = dom ? prepareCanvases(dom, geometry.viewport, window.devicePixelRatio || 1) : null;
    if (!dom || !paints) return;
    const start = opening.current;
    painted.current = {
      dom,
      paints,
      geo: geometry,
      deck,
      lights,
      // Fixed at the first measurement: the spark has left by the time anything is resized.
      origin:
        painted.current?.origin ??
        sparkOrigin(start?.pointer ?? null, start?.at ?? performance.now(), geometry.viewport),
    };
    kick();
  }, [geometry, deck, lights, kick]);

  // Focus follows the phase: the light while it waits, the dialog while it reveals, then the CTA.
  // A frame later, after the event that changed the phase is done: a tap that skips the reveal
  // would otherwise hand focus straight back to the dialog (the default action of its mousedown).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const frame = window.requestAnimationFrame(() => {
      const target =
        phase === "waiting"
          ? root.querySelector<HTMLElement>('[data-scene="ignite"]')
          : phase === "revealed"
            ? root.querySelector<HTMLElement>('[data-scene="cta"]')
            : root;
      (target ?? root).focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [phase]);

  /** The flight home also lights the avatar as each badge lands in it. */
  const handleProceed = useCallback(() => {
    if (!proceed() || reduced) return;
    const root = rootRef.current;
    const home = root ? findHomeNode(root.getBoundingClientRect()) : null;
    pulses.current?.();
    pulses.current = home ? scheduleHomePulses(home.node, lights) : null;
  }, [proceed, reduced, lights]);

  useEffect(() => {
    if (!error) return;
    pulses.current?.();
    pulses.current = null;
    rootRef.current?.querySelector<HTMLElement>('[data-scene="cta"]')?.focus({ preventScroll: true });
  }, [error]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (phase === "revealing" && event.isPrimary) skip();
    },
    [phase, skip],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (phase !== "revealing" || event.target !== event.currentTarget) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      skip();
    },
    [phase, skip],
  );

  if (typeof document === "undefined") return null;

  const edge = geometry ? (deck ? deck.card : geometry.size) : null;
  const overflow = Math.max(0, count - shown.length);
  return createPortal(
    <SceneStage
      rootRef={rootRef}
      slotRef={slotRef}
      copyRef={copyRef}
      titleId={titleId}
      bodyId={bodyId}
      text={text}
      igniteLabel={igniteLabel}
      announcement={phase === "waiting" ? null : litAnnouncement}
      waiting={phase === "waiting"}
      ready={phase === "revealed"}
      cards={shown}
      edge={edge}
      labels={deck?.labels ?? false}
      more={overflow > 0 ? moreLabel(overflow) : null}
      center={geometry?.center ?? null}
      light={{ glow: lights[0]!.glow, alt: lights.at(-1)!.alt }}
      error={error}
      onIgnite={ignite}
      onProceed={handleProceed}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    />,
    document.body,
  );
}
