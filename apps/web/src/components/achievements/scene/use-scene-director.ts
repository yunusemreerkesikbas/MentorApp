"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  cutSceneGather,
  playSceneCues,
  silenceScene,
  unlockSceneAudio,
  warmSceneAudio,
  type CueBatch,
} from "@/lib/achievement-scene-audio";
import type { SfxCue, SfxVoice } from "@/lib/achievement-scene-sfx";

import {
  AUTO_IGNITE_AT,
  CHOREO,
  exitCues,
  exitDuration,
  igniteCues,
  openingCues,
  resolveBeats,
  visibleCards,
  type SceneBeats,
} from "./scene-choreography";
import { clamp, progress } from "./scene-engine";
import { useSceneClock } from "./use-scene-clock";

/**
 * The scene's state machine. React state holds only what changes the markup (`phase`); the clock
 * reads a mutable timeline, so nothing re-renders per frame. Transitions run on timers, never on
 * frames: a background tab stops requestAnimationFrame, and the scene must still reach the CTA.
 *
 * waiting ──1.5 s──▶ revealing ──timer──▶ revealed ──"Devam edelim"──▶ (closing)
 * The scene plays by itself; the student only presses "Devam edelim" (or Escape).
 * A close is optimistic: the flight (or fade) starts at once; a failed close brings the scene back.
 */
export type ScenePhase = "waiting" | "revealing" | "revealed";

export interface SceneMoment {
  /** Scene time the poses are taken at. */
  t: number;
  beats: SceneBeats;
  /** Whole-scene opacity. */
  presence: number;
}

interface Timeline {
  /** `performance.now()` at scene time 0. */
  origin: number;
  ignitedAt: number | null;
  /** "Devam edelim": the flight home. */
  exitAt: number | null;
  /** Any other close (Escape, the queue moving on, reduced motion): the scene fades. */
  fadeAt: number | null;
  /** A failed close brings the scene back from here. */
  restoreAt: number | null;
  closing: boolean;
}

/** Synthesised before the curtain is visible: a stall there costs nothing, during the spark it would. */
const OPENING_VOICES: SfxVoice[] = ["spark", "gather", "pop", "burst", "chime"];
const STILL_VOICES: SfxVoice[] = ["chime", "press"];
const STILL_OPENING: SfxCue[] = [{ at: 0, voice: "chime" }];
const STILL_EXIT: SfxCue[] = [{ at: 0, voice: "press" }];

const timeOf = (timeline: Timeline, now: number) => (now - timeline.origin) / 1000;
const fadeLength = (reduced: boolean) => (reduced ? CHOREO.reducedOut : CHOREO.dismiss);
const beatsOf = (timeline: Timeline, count: number) =>
  resolveBeats({ ignitedAt: timeline.ignitedAt, exitAt: timeline.exitAt, count });

function momentAt(timeline: Timeline, now: number, reduced: boolean, count: number): SceneMoment {
  const t = timeOf(timeline, now);
  const fadeIn = reduced ? progress(t, 0, CHOREO.reducedIn) : 1;
  const back = timeline.restoreAt === null ? 1 : progress(t, timeline.restoreAt, CHOREO.reducedIn);
  const out = timeline.fadeAt === null ? 0 : progress(t, timeline.fadeAt, fadeLength(reduced));
  const presence = clamp(Math.min(fadeIn, back) - out);
  if (!reduced) return { t, beats: beatsOf(timeline, count), presence };
  // Reduced motion holds the settled pose: everything revealed, nothing moving.
  const beats = resolveBeats({ ignitedAt: 0, exitAt: null, count });
  return { t: beats.quiet ?? 0, beats, presence };
}

/** Scene time the close (flight or fade) has finished. */
function closedAt(timeline: Timeline, cards: number, reduced: boolean): number {
  if (timeline.exitAt !== null) return timeline.exitAt + exitDuration(cards);
  if (timeline.fadeAt !== null) return timeline.fadeAt + fadeLength(reduced);
  return Number.POSITIVE_INFINITY;
}

/** Scene time after which no frame changes. */
function stillFrom(timeline: Timeline, beats: SceneBeats, reduced: boolean): number {
  if (timeline.closing) return closedAt(timeline, beats.cards, reduced);
  const restored = timeline.restoreAt === null ? 0 : timeline.restoreAt + CHOREO.reducedIn;
  return Math.max(reduced ? CHOREO.reducedIn : (beats.quiet ?? Number.POSITIVE_INFINITY), restored);
}

interface DirectorOptions {
  reduced: boolean;
  count: number;
  paint: (moment: SceneMoment) => void;
  onClose: () => void;
  isPresent: boolean;
  safeToRemove?: (() => void) | null;
  error: string | null;
}

export function useSceneDirector({ reduced, count, paint, onClose, isPresent, safeToRemove, error }: DirectorOptions) {
  const [phase, setPhase] = useState<ScenePhase>(reduced ? "revealed" : "waiting");
  const timeline = useRef<Timeline>({ origin: 0, ignitedAt: null, exitAt: null, fadeAt: null, restoreAt: null, closing: false });
  const cues = useRef<{ opening: CueBatch | null; ignite: CueBatch | null }>({ opening: null, ignite: null });
  const paintRef = useRef(paint);
  const closeRef = useRef(onClose);
  const removeRef = useRef(safeToRemove);

  useEffect(() => {
    paintRef.current = paint;
    closeRef.current = onClose;
    removeRef.current = safeToRemove;
  }, [paint, onClose, safeToRemove]);

  const kick = useSceneClock(
    useCallback(
      (now: number) => {
        const moment = momentAt(timeline.current, now, reduced, count);
        paintRef.current(moment);
        return timeOf(timeline.current, now) < stillFrom(timeline.current, moment.beats, reduced);
      },
      [count, reduced],
    ),
  );

  useEffect(() => {
    const scene = timeline.current;
    scene.origin = performance.now();
    warmSceneAudio(reduced ? STILL_VOICES : OPENING_VOICES);
    let mounted = true;
    void unlockSceneAudio().then((running) => {
      if (!mounted || !running || scene.closing || scene.ignitedAt !== null) return;
      cues.current.opening = playSceneCues(reduced ? STILL_OPENING : openingCues(), -timeOf(scene, performance.now()));
    });
    kick();
    return () => {
      mounted = false;
      // The arrival chime of a flight home rings out; anything else leaves with the scene.
      if (scene.exitAt === null) silenceScene();
    };
  }, [kick, reduced]);

  /** The light has gathered: it comes on by itself. */
  const ignite = useCallback(() => {
    const scene = timeline.current;
    if (reduced || scene.closing || scene.ignitedAt !== null) return;
    scene.ignitedAt = timeOf(scene, performance.now());
    const beats = beatsOf(scene, count);
    const ignited = beats.ignite ?? 0;
    cues.current.opening?.cancel();
    cutSceneGather();
    cues.current.ignite = playSceneCues(
      igniteCues({ cards: beats.cards, copyAfter: (beats.copy ?? ignited) - ignited }),
      ignited - timeOf(scene, performance.now()),
    );
    setPhase("revealing");
    kick();
  }, [count, kick, reduced]);

  useEffect(() => {
    if (phase !== "waiting") return;
    const wait = AUTO_IGNITE_AT - timeOf(timeline.current, performance.now());
    const id = window.setTimeout(ignite, Math.max(0, wait) * 1000);
    return () => window.clearTimeout(id);
  }, [phase, ignite]);

  useEffect(() => {
    if (phase !== "revealing") return;
    const scene = timeline.current;
    const wait = (beatsOf(scene, count).ready ?? 0) - timeOf(scene, performance.now());
    const id = window.setTimeout(() => setPhase("revealed"), Math.max(0, wait) * 1000);
    return () => window.clearTimeout(id);
  }, [phase, count]);

  /** "Devam edelim". Returns whether the close started (it is a no-op while one is in flight). */
  const proceed = useCallback((): boolean => {
    const scene = timeline.current;
    if (scene.closing || (!reduced && scene.ignitedAt === null)) return false;
    const t = timeOf(scene, performance.now());
    scene.closing = true;
    scene.restoreAt = null;
    if (reduced) scene.fadeAt = t;
    else scene.exitAt = t;
    void unlockSceneAudio().then(() => playSceneCues(reduced ? STILL_EXIT : exitCues(visibleCards(count)), 0));
    kick();
    closeRef.current();
    return true;
  }, [count, kick, reduced]);

  const dismiss = useCallback(() => {
    const scene = timeline.current;
    if (scene.closing) return;
    scene.closing = true;
    scene.restoreAt = null;
    scene.fadeAt = timeOf(scene, performance.now());
    cues.current.opening?.cancel();
    cues.current.ignite?.cancel();
    silenceScene();
    kick();
    closeRef.current();
  }, [kick]);

  // The close failed: the scene comes back where it was, the CTA ready again.
  useEffect(() => {
    const scene = timeline.current;
    if (!error || !scene.closing) return;
    scene.closing = false;
    scene.exitAt = null;
    scene.fadeAt = null;
    scene.restoreAt = timeOf(scene, performance.now());
    kick();
    if (reduced || scene.ignitedAt !== null) return;
    const id = window.setTimeout(ignite, 0);
    return () => window.clearTimeout(id);
  }, [error, ignite, kick, reduced]);

  // Removed from the queue: finish the flight (or fade) before letting go.
  useEffect(() => {
    if (isPresent) return;
    const scene = timeline.current;
    const now = performance.now();
    if (!scene.closing) {
      scene.closing = true;
      scene.fadeAt = timeOf(scene, now);
      silenceScene();
      kick();
    }
    const end = closedAt(scene, visibleCards(count), reduced);
    const wait = Number.isFinite(end) ? Math.max(0, end - timeOf(scene, now)) : 0;
    const id = window.setTimeout(() => removeRef.current?.(), wait * 1000);
    return () => window.clearTimeout(id);
  }, [isPresent, count, kick, reduced]);

  return { phase, proceed, dismiss, kick };
}
