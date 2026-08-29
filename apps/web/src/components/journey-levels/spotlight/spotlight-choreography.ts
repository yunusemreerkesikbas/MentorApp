/**
 * Pure timing and geometry for the Gece Yolculuğu spotlight scene.
 *
 * The rig is a pendulum: cable, lamp and beam are one group pivoting at a ceiling anchor, so a
 * single rotation moves all three and the lit spot on the floor follows for free. Everything the
 * scene renders derives from one number — `lightX`, in 0..1 across the stage.
 *
 * Lives apart from the components because `apps/web` unit tests run in a Node env: this file is
 * the part worth asserting on, the rest is DOM and belongs to e2e.
 */

/** Milliseconds. Each step starts when the previous one ends. */
export interface SpotlightTimeline {
  /** Page fades to black. */
  dimMs: number;
  /** Beat of empty darkness before anything descends — the house lights are simply out. */
  darkHoldMs: number;
  /** Lamp drops in on its cable. */
  lampDropMs: number;
  /** Beam swings and settles. */
  sweepMs: number;
  /** Badge rises out of the dark once the beam is centred. */
  badgeRevealMs: number;
}

export const SPOTLIGHT_TIMELINE: SpotlightTimeline = {
  dimMs: 1100,
  darkHoldMs: 700,
  lampDropMs: 900,
  sweepMs: 1800,
  badgeRevealMs: 800,
};

/** Reduced motion keeps the scene, drops the show: lamp already lit, badge already up. */
export const SPOTLIGHT_TIMELINE_REDUCED: SpotlightTimeline = {
  dimMs: 0,
  darkHoldMs: 0,
  lampDropMs: 0,
  sweepMs: 0,
  badgeRevealMs: 0,
};

export function resolveSpotlightTimeline(reducedMotion: boolean): SpotlightTimeline {
  return reducedMotion ? SPOTLIGHT_TIMELINE_REDUCED : SPOTLIGHT_TIMELINE;
}

/** Centre of the stage. The rig hangs here and returns here. */
export const SPOTLIGHT_CENTER_X = 0.5;

/**
 * Damped swing, as framer-motion keyframes on `lightX`.
 *
 * Starts hard over at one edge so the badge begins in darkness and is *found* by the beam on the
 * first pass — starting centred lit the badge before the swing and then took it away, which read
 * backwards. Ends centred so the rig never jumps when control passes to the pointer.
 */
export const SPOTLIGHT_SWEEP_KEYFRAMES = [
  0.07, 0.92, 0.22, 0.75, 0.38, 0.56, 0.5,
];

/** Widest tilt of the rig, in degrees either side of straight down. */
export const SPOTLIGHT_MAX_ANGLE_DEG = 38;

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return SPOTLIGHT_CENTER_X;
  return Math.min(1, Math.max(0, value));
}

/** Pointer or drag position → `lightX`. Both inputs write the same value; the rig has one owner. */
export function lightXFromPointer(clientX: number, left: number, width: number): number {
  if (width <= 0) return SPOTLIGHT_CENTER_X;
  return clamp01((clientX - left) / width);
}

/**
 * `lightX` → the CSS rotation to apply to the rig. 0.5 hangs straight down.
 *
 * Sign matters and is easy to get backwards: CSS rotates clockwise on positive degrees, and the
 * rig points *down*, so a clockwise turn swings the beam to the **left**. Light on the left of the
 * stage therefore needs a positive angle.
 */
export function beamAngleDeg(
  lightX: number,
  maxAngleDeg: number = SPOTLIGHT_MAX_ANGLE_DEG,
): number {
  return (SPOTLIGHT_CENTER_X - clamp01(lightX)) * 2 * maxAngleDeg;
}

/**
 * How lit the centre badge is, 0..1. This is the "beam crosses the badge and it appears" rule:
 * full at centre, dark once the beam has swung away. Quadratic falloff reads softer than linear.
 */
export function badgeLightIntensity(lightX: number): number {
  const offset = Math.abs(clamp01(lightX) - SPOTLIGHT_CENTER_X) / SPOTLIGHT_CENTER_X;
  return clamp01(1 - offset * offset);
}

/**
 * Beam brightness as the rig swings, 0..1. A tilted lamp throws further, and light falls off over
 * distance, so the cone should dim as it leaves centre. Subtle on purpose — this is a lighting
 * cue, not a vignette.
 */
export function beamThrowFalloff(lightX: number): number {
  const offset = Math.abs(clamp01(lightX) - SPOTLIGHT_CENTER_X) / SPOTLIGHT_CENTER_X;
  return 1 - offset * 0.45;
}

/**
 * Where the rig has to point for a neighbour to be fully lit. Shared with `neighbourLightIntensity`
 * so that aiming the light at a slot and asking how lit that slot is agree — a test locks the pair
 * together, because drifting them apart would light the badge next to the one being travelled to.
 */
export const NEIGHBOUR_SLOT_X = {
  previous: SPOTLIGHT_CENTER_X - 0.42,
  next: SPOTLIGHT_CENTER_X + 0.42,
} as const;

/** Travelling to a neighbour: the beam reaches it, then carries it back to centre. */
export interface SpotlightTravelTiming {
  reachMs: number;
  settleMs: number;
}

export const SPOTLIGHT_TRAVEL: SpotlightTravelTiming = { reachMs: 450, settleMs: 550 };

export function resolveSpotlightTravel(reducedMotion: boolean): SpotlightTravelTiming {
  return reducedMotion ? { reachMs: 0, settleMs: 0 } : SPOTLIGHT_TRAVEL;
}

/**
 * How long the pointer must rest before the beam drifts home to the badge.
 *
 * `null` under reduced motion: drifting back is movement the student did not ask for, and the
 * whole point of the setting is that only their own input moves things.
 */
export function resolveIdleRecentreMs(reducedMotion: boolean): number | null {
  return reducedMotion ? null : 1300;
}

/**
 * How lit a neighbour badge is (phase 3). `slot` is -1 for the previous level and 1 for the next;
 * they sit near the edges, so each lights as the beam swings to its side.
 */
export function neighbourLightIntensity(lightX: number, slot: -1 | 1): number {
  const target = SPOTLIGHT_CENTER_X + slot * 0.42;
  const offset = Math.abs(clamp01(lightX) - target) / 0.42;
  return clamp01(1 - offset * offset);
}
