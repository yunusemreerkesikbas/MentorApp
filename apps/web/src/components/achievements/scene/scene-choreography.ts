/**
 * "Işık Yandı" choreography: every beat, spring, light colour and sound cue of the achievement
 * scene. It mirrors `design/achievement-scene/timeline.mjs`, the timeline behind the approved
 * video, so a change here is a change to the film; re-render the prototype when one is made.
 *
 * Times are scene-local seconds from the moment the scene mounts. The ignite (the student's tap,
 * or the automatic one) is the hinge: everything after it hangs off `burst = ignite + windup`.
 * Kept free of DOM and React so the Node test environment can assert on it.
 */
import type { AchievementId } from "@mentor/types";

import type { SfxCue } from "@/lib/achievement-scene-sfx";

import { clamp, type Point, type SpringConfig } from "./scene-engine";

export const CHOREO = {
  /** Night curtain wipes down from the top. */
  dusk: 0.55,
  /** The ✓ (or wherever the student last tapped) squashes, pops off and arcs to the badge. */
  sparkLaunch: 0.1,
  sparkLand: 0.72,
  /** The spark is now an orb and light motes spiral in. An ignite cannot land before this. */
  orbReady: 0.75,
  /** "Dokun, ışığı yak" pops under the orb. */
  hintAt: 1,
  /** Hybrid trigger: with no tap the light comes on by itself this long after the orb is ready. */
  autoIgniteDelay: 1.5,
  /** ignite → burst: the orb is squashed hard first (anticipation). */
  windup: 0.12,
  /** burst → the badge is born out of the flash. */
  birth: 0.08,
  /** burst → the flip winds up. */
  flip: 0.73,
  flipWindup: 0.12,
  /** burst → eyebrow, title words, body, ledge (single achievement). */
  eyebrow: 1.18,
  title: 1.26,
  titleStagger: 0.07,
  body: 1.56,
  ledge: 1.78,
  /** Ledge starts rising → it is still and takes focus. */
  ledgeSettle: 0.5,
  /** burst → rays, glints and sparkles are done; nothing moves until the exit. */
  quiet: 4.6,
  deck: {
    /** burst → card i flips at `flip + i · step`, then is tossed into the fan `toss` later. */
    flip: 0.7,
    step: 0.42,
    toss: 0.4,
    /** Last toss → the fan has settled and the copy may start. */
    settle: 0.55,
    /** A larger backfill shows this many cards and a "+N" for the rest. */
    maxCards: 5,
  },
  exit: {
    press: 0.12,
    copyOut: 0.1,
    windup: 0.14,
    launch: 0.26,
    flight: 0.62,
    curtainLift: 0.3,
    curtainDuration: 0.62,
    stagger: 0.09,
    arrival: 0.7,
  },
  /** A tap older than this did not set the celebration off, so the spark comes from off screen. */
  pointerFreshness: 6,
  /** Reduced motion: one crossfade in, one out. */
  reducedIn: 0.2,
  reducedOut: 0.15,
  /** Escape or any close that is not "Devam edelim": a plain fade, no flight. */
  dismiss: 0.15,
} as const;

export const AUTO_IGNITE_AT = CHOREO.orbReady + CHOREO.autoIgniteDelay;

/** framer-motion units. Overshoot is intentional: this scene is DESIGN.md §9.1's exception. */
export const SPRINGS = {
  badge: { stiffness: 300, damping: 16.6 }, // ≈18 % overshoot
  badgeLag: { stiffness: 300, damping: 13.5 }, // the y-scale lags: a short jelly
  badgeRise: { stiffness: 220, damping: 20 },
  badgeTilt: { stiffness: 200, damping: 14 },
  flip: { stiffness: 300, damping: 23 }, // 180° lands near 192° and settles back
  land: { stiffness: 300, damping: 12 },
  orbLand: { stiffness: 260, damping: 9 },
  title: { stiffness: 500, damping: 25 }, // ≈12 %
  ledge: { stiffness: 380, damping: 20 }, // ≈15 %
  hint: { stiffness: 420, damping: 18 },
  punch: { stiffness: 520, damping: 14 },
  pulse: { stiffness: 420, damping: 13 },
  toss: { stiffness: 210, damping: 17 },
} as const satisfies Record<string, SpringConfig>;

export interface SceneLight {
  /** The warm light of the burst, halo and particles. */
  glow: string;
  /** The cooler second colour mixed into motes and particles. */
  alt: string;
}

/** Sampled from each badge's own art, then pushed toward saturation. */
export const SCENE_LIGHT: Record<AchievementId, SceneLight> = {
  first_step: { glow: "#FFC46B", alt: "#A9C6F0" },
  route_drawn: { glow: "#6EC8FF", alt: "#FFD98A" },
  dream_space_created: { glow: "#FFB98A", alt: "#B9C6FF" },
  rhythm_found: { glow: "#FFCF7A", alt: "#8DBEFF" },
  rhythm_kept: { glow: "#FFD35C", alt: "#6FB2FF" },
  returned_to_path: { glow: "#FFBE6B", alt: "#ABC3F2" },
  route_renewed: { glow: "#7FE8C9", alt: "#7CC8FF" },
  starting_point_set: { glow: "#5FD3FF", alt: "#F9E3C4" },
  mistake_revisited: { glow: "#8EC2FF", alt: "#FFD27A" },
  week_reflected: { glow: "#C3B5FF", alt: "#FFB59A" },
  first_hello: { glow: "#FFD88A", alt: "#9FBCF7" },
  helped_someone: { glow: "#FFC970", alt: "#BED9F6" },
};

/** The badge silhouette in unit space; also the CSS clip-path used where the art is not a mask. */
export const BADGE_PENTAGON: ReadonlyArray<readonly [number, number]> = [
  [0.5, 0.02],
  [0.96, 0.36],
  [0.82, 0.94],
  [0.18, 0.94],
  [0.04, 0.36],
];

/** Glint sweeps after the flip lands: strong, softer, and a last pass while the student reads. */
export const BADGE_GLINTS = [
  { delay: 0.5, duration: 0.82, peak: 0.85 },
  { delay: 1.14, duration: 0.58, peak: 0.42 },
  { delay: 2.5, duration: 0.95, peak: 0.3 },
] as const;

export interface SceneBeats {
  /** Scene seconds; `null` until the moment has happened. */
  ignite: number | null;
  burst: number | null;
  /** The copy starts to arrive (eyebrow). */
  copy: number | null;
  /** The ledge is still: it takes focus and the reveal counts as done. */
  ready: number | null;
  /** Nothing moves after this until the exit, so the clock may stop. */
  quiet: number | null;
  exit: number | null;
  /** Cards on stage; 1 for a single achievement. */
  cards: number;
}

export function visibleCards(count: number): number {
  return Math.round(clamp(count, 1, CHOREO.deck.maxCards));
}

/** Seconds from the burst until the dealt fan has settled (0 for a single badge). */
function deckTail(cards: number): number {
  return cards > 1 ? CHOREO.deck.flip + (cards - 1) * CHOREO.deck.step + CHOREO.deck.settle : 0;
}

export function resolveBeats(input: {
  ignitedAt: number | null;
  exitAt: number | null;
  count: number;
}): SceneBeats {
  const cards = visibleCards(input.count);
  if (input.ignitedAt === null) {
    return { ignite: null, burst: null, copy: null, ready: null, quiet: null, exit: input.exitAt, cards };
  }
  const ignite = Math.max(input.ignitedAt, CHOREO.orbReady);
  const burst = ignite + CHOREO.windup;
  const tail = deckTail(cards);
  const copy = burst + (cards > 1 ? tail : CHOREO.eyebrow);
  const ready = copy + (CHOREO.ledge - CHOREO.eyebrow) + CHOREO.ledgeSettle;
  const quiet = burst + CHOREO.quiet + Math.max(0, tail - CHOREO.eyebrow);
  return { ignite, burst, copy, ready, quiet, exit: input.exitAt, cards };
}

/** "Devam edelim" → the last badge has landed in the avatar and its ring has faded. */
export function exitDuration(cards: number): number {
  const { launch, flight, stagger, arrival } = CHOREO.exit;
  return launch + flight + (cards - 1) * stagger + arrival;
}

/** A sound cue, seconds after the moment its list hangs off (achievement-scene-audio.ts plays it). */
export type SceneCue = SfxCue;

const byTime = (a: SceneCue, b: SceneCue) => a.at - b.at;

/** From mount. The gather hum runs until the ignite cuts it. */
export function openingCues(): SceneCue[] {
  return [
    { at: CHOREO.sparkLaunch - 0.04, voice: "spark" },
    { at: CHOREO.orbReady, voice: "gather" },
    { at: CHOREO.hintAt, voice: "pop", gain: 0.35 },
  ];
}

/** From the ignite. `copyAfter` is `beats.copy - beats.ignite`. */
export function igniteCues(input: { cards: number; byTap: boolean; copyAfter: number }): SceneCue[] {
  const burst = CHOREO.windup;
  const cues: SceneCue[] = [
    { at: burst, voice: "burst" },
    { at: burst + 0.02, voice: "chime" },
    { at: input.copyAfter + 0.1, voice: "pop", gain: 0.45 },
  ];
  if (input.byTap) cues.push({ at: 0, voice: "tap", gain: 0.7 });
  if (input.cards === 1) {
    const flip = burst + CHOREO.flip;
    cues.push(
      { at: flip + CHOREO.flipWindup - 0.02, voice: "swish" },
      { at: flip + CHOREO.flipWindup + 0.16, voice: "land" },
      // The two corner sparkles: top right, then bottom left.
      { at: flip + 0.42, voice: "twinkle", pan: 0.45 },
      { at: flip + 0.66, voice: "twinkle", pan: -0.45, gain: 0.6, pitch: 1.19 },
    );
  } else {
    for (let i = 0; i < input.cards; i += 1) {
      const flip = burst + CHOREO.deck.flip + i * CHOREO.deck.step;
      cues.push(
        { at: flip + CHOREO.flipWindup - 0.02, voice: "swish", gain: 0.8 },
        { at: flip + CHOREO.flipWindup + 0.16, voice: "land", gain: 0.7, pitch: 1 + i * 0.12 },
      );
    }
  }
  return cues.sort(byTime);
}

/** From the "Devam edelim" press. */
export function exitCues(cards: number): SceneCue[] {
  const { launch, flight, stagger } = CHOREO.exit;
  const cues: SceneCue[] = [
    { at: 0, voice: "press" },
    { at: launch, voice: "fly" },
  ];
  for (let i = 0; i < cards; i += 1) {
    cues.push({
      at: launch + flight + i * stagger,
      voice: "arrive",
      gain: i === cards - 1 ? 1 : 0.55,
      pitch: 1 + i * 0.06,
    });
  }
  return cues;
}

/** Where the spark is born: the tap that set the celebration off, or beyond the bottom-left. */
export function sparkOrigin(
  lastPointer: { x: number; y: number; at: number } | null,
  nowMs: number,
  viewport: { width: number; height: number },
): Point {
  if (lastPointer && nowMs - lastPointer.at <= CHOREO.pointerFreshness * 1000) {
    return { x: lastPointer.x, y: lastPointer.y };
  }
  // Off the bottom-left corner: a path from the bottom centre would cross the tab bar's
  // Koç button and read as if that button had fired the light.
  return { x: -20, y: viewport.height + 56 };
}

/** Control point of the flight home: a lift up and to the side before the dive. */
export function flightControl(from: Point, to: Point, badgeSize: number): Point {
  return { x: from.x + badgeSize * 0.3, y: Math.min(from.y, to.y) - badgeSize * 0.17 };
}

export interface DeckSlot {
  dx: number;
  dy: number;
  /** Degrees. */
  rz: number;
  scale: number;
}

export interface DeckLayout {
  cards: number;
  /** Card edge in px. */
  card: number;
  /** Where card i is born, stacked. */
  stack: DeckSlot[];
  /** Where card i lands in the fan. */
  fan: DeckSlot[];
  /** Titles under the cards only while they have room. */
  labels: boolean;
  /** Achievements beyond the visible cards ("+N"). */
  overflow: number;
}

/** Outside-in: the first cards are dealt to the edges, the last one keeps the middle. */
const DEAL_ORDER: Record<number, number[]> = {
  1: [0],
  2: [0, 1],
  3: [0, 2, 1],
  4: [0, 3, 1, 2],
  5: [0, 4, 1, 3, 2],
};

/**
 * The fan for a backfill summary. Cards are 56 % of the single badge and each overlaps the next
 * by 18 %, shrunk until the fan fits 92 % of the stage. Edge cards sit lower and tilt out; the
 * middle one rises and grows, so it reads as the front of the hand.
 */
/** Each fanned card starts this fraction of a card after the previous one (18 % overlap). */
export const DECK_ADVANCE = 0.82;

export function deckLayout(count: number, stageWidth: number, badgeSize: number): DeckLayout {
  const cards = visibleCards(count);
  const advance = DECK_ADVANCE;
  const card = Math.min(badgeSize * 0.56, (stageWidth * 0.92) / (1 + (cards - 1) * advance));
  const mid = (cards - 1) / 2;
  const order = DEAL_ORDER[cards] ?? [0];
  const fan = order.map((slot) => {
    const offset = slot - mid;
    const n = mid === 0 ? 0 : offset / mid;
    return {
      dx: offset * card * advance,
      dy: card * (0.136 * n * n - 0.076 * (1 - Math.abs(n))),
      rz: n * 11,
      scale: 1.1 - 0.18 * Math.abs(n),
    };
  });
  const stack = order.map((_, i) => ({
    dx: i === 0 ? 0 : (i % 2 ? 1 : -1) * card * 0.045,
    dy: i * card * 0.05,
    rz: i === 0 ? 0 : i % 2 ? 5 : -6,
    scale: 1,
  }));
  return { cards, card, stack, fan, labels: cards <= 3, overflow: Math.max(0, count - cards) };
}
