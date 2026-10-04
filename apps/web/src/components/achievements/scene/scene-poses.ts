/**
 * Pure poses: where every moving part of the achievement scene is at scene time `t`. The frame
 * painter (scene-frame.ts) only writes these to the DOM and canvases, so the whole choreography is
 * assertable without a browser.
 */
import {
  AUTO_IGNITE_AT,
  CHOREO,
  SPRINGS,
  flightControl,
  type DeckLayout,
  type SceneBeats,
} from "./scene-choreography";
import {
  clamp,
  ease,
  keys,
  kick,
  lerp,
  progress,
  quadPoint,
  quadTangent,
  spring,
  type Point,
} from "./scene-engine";

const SP = {
  badge: spring(SPRINGS.badge),
  badgeLag: spring(SPRINGS.badgeLag),
  badgeRise: spring(SPRINGS.badgeRise),
  badgeTilt: spring(SPRINGS.badgeTilt),
  flip: spring(SPRINGS.flip),
  title: spring(SPRINGS.title),
  ledge: spring(SPRINGS.ledge),
  orbLand: spring(SPRINGS.orbLand),
  toss: spring(SPRINGS.toss),
};
export const KICK = {
  punch: kick(SPRINGS.punch),
  pulse: kick(SPRINGS.pulse),
  land: kick(SPRINGS.land),
};

/** How a corner twinkle grows: the badge's own overshoot, so the two read as one material. */
export const sparklePop = (since: number): number => SP.badge.value(since);

export interface StageGeometry {
  /** Badge slot centre, viewport px. */
  center: Point;
  /** Single badge edge, px. */
  size: number;
  viewport: { width: number; height: number };
}

/**
 * `shift` in curtain-sheet heights (the sheet is 1.6 viewports tall); `night` 0..1; `lift` 0..1 as
 * the curtain rises on the exit (the light still on screen fades with it).
 */
export function curtainPose(t: number, beats: SceneBeats): { shift: number; night: number; lift: number } {
  const dusk = ease.inOutCubic(progress(t, 0, CHOREO.dusk));
  const lift =
    beats.exit === null
      ? 0
      : ease.inOutCubic(
          progress(t, beats.exit + CHOREO.exit.curtainLift, CHOREO.exit.curtainDuration),
        );
  return { shift: -(1 - dusk) - lift, night: clamp(dusk - lift), lift };
}

/** A slow push while the light gathers, a punch on the burst. */
export function cameraScale(t: number, beats: SceneBeats): number {
  const gatheredUntil = beats.ignite ?? t;
  const push = ease.inOutSine(
    progress(Math.min(t, gatheredUntil), CHOREO.orbReady, AUTO_IGNITE_AT - CHOREO.orbReady),
  );
  if (beats.burst === null) return 1 + 0.04 * push;
  const release = 1 - ease.outCubic(progress(t, beats.burst, 0.5));
  return 1 + 0.04 * push * release + 0.035 * KICK.punch(t - beats.burst);
}

/** The light that stays on behind the badge after the burst. */
export function haloPose(t: number, beats: SceneBeats, night: number): { opacity: number; scale: number } {
  if (beats.burst === null) return { opacity: 0.2 * night, scale: 0.85 };
  const b = beats.burst;
  const opacity = keys(t, [
    [b, 0.2],
    [b + 0.25, 0.95, ease.outQuad],
    [b + 1.6, 0.6, ease.inOutSine],
  ]);
  return { opacity: opacity * night, scale: 0.85 + 0.15 * ease.outCubic(progress(t, b, 0.6)) };
}

/** The light comes on across the whole screen, then settles back into the halo. */
export function flashOpacity(t: number, beats: SceneBeats): number {
  if (beats.burst === null || t < beats.burst) return 0;
  const b = beats.burst;
  return keys(t, [
    [b, 0],
    [b + 0.05, 0.92, ease.outQuad],
    [b + 0.3, 0.3, ease.outQuad],
    [b + 1.05, 0, ease.outQuad],
  ]);
}

export interface OrbPose {
  /** Core radius and glow radius, px at the 236 px reference badge. */
  core: number;
  glow: number;
  sx: number;
  sy: number;
  /** 0..1: how long the light has been waiting (it burns hotter). */
  heat: number;
  /** 0..1: the anticipation squash before the burst. */
  windup: number;
}

export function orbPose(t: number, beats: SceneBeats): OrbPose | null {
  if (t < CHOREO.sparkLand || (beats.burst !== null && t >= beats.burst + 0.02)) return null;
  const since = t - CHOREO.sparkLand;
  const squash = SP.orbLand.x(since);
  const breathe =
    t > CHOREO.breatheAt ? 1 + 0.09 * Math.sin(((t - CHOREO.breatheAt) / 0.82) * Math.PI * 2) : 1;
  const windup = beats.ignite === null ? 0 : ease.inCubic(progress(t, beats.ignite, CHOREO.windup));
  const waitEnd = beats.ignite ?? AUTO_IGNITE_AT;
  return {
    core: (4 + 12 * SP.badge.value(since)) * breathe,
    glow: (20 + 64 * ease.outCubic(clamp(since / 0.5))) * breathe * (1 - 0.22 * windup),
    sx: (1 + 0.55 * squash) * (1 + 0.3 * windup),
    sy: (1 - 0.42 * squash) * (1 - 0.34 * windup),
    heat: progress(t, CHOREO.orbReady, waitEnd - CHOREO.orbReady),
    windup,
  };
}

export interface BadgePose {
  x: number;
  y: number;
  sx: number;
  sy: number;
  /** Degrees, around the view axis. */
  rz: number;
  /** Degrees, the flip around the vertical axis; 0 shows the back, 180 the art. */
  theta: number;
  opacity: number;
  flipStart: number;
  /** In flight: stretch along `dir` (radians). */
  stretch: number;
  dir: number;
  /** Deck: the card has left the stack / its label may show (0..1). */
  tossed: boolean;
  settle: number;
}

export function flipAngle(t: number, start: number): number {
  if (t < start) return 0;
  if (t < start + CHOREO.flipWindup) {
    return -14 * ease.outQuad(progress(t, start, CHOREO.flipWindup));
  }
  return -14 + 194 * SP.flip.value(t - start - CHOREO.flipWindup);
}

function landKick(t: number, flipStart: number): number {
  return KICK.land(t - (flipStart + CHOREO.flipWindup + 0.16));
}

export function singleBadgePose(t: number, beats: SceneBeats, geo: StageGeometry): BadgePose | null {
  if (beats.burst === null) return null;
  const birth = beats.burst + CHOREO.birth;
  const since = t - birth;
  const flipStart = beats.burst + CHOREO.flip;
  const land = landKick(t, flipStart);
  return {
    x: geo.center.x,
    y: geo.center.y + geo.size * 0.254 * (1 - SP.badgeRise.value(since)),
    sx: (0.15 + 0.85 * SP.badge.value(since)) * (1 + 0.08 * land),
    sy: (0.15 + 0.85 * SP.badgeLag.value(since - 0.035)) * (1 - 0.1 * land),
    rz: -18 * (1 - SP.badgeTilt.value(since)),
    theta: flipAngle(t, flipStart),
    opacity: progress(t, birth, 0.1),
    flipStart,
    stretch: 0,
    dir: 0,
    tossed: false,
    settle: 1,
  };
}

/** Card i of a backfill deck: born stacked, flipped in turn, tossed into the fan. */
export function deckBadgePose(
  i: number,
  t: number,
  beats: SceneBeats,
  layout: DeckLayout,
  geo: StageGeometry,
): BadgePose | null {
  const stack = layout.stack[i];
  const fan = layout.fan[i];
  if (beats.burst === null || !stack || !fan) return null;
  const birth = beats.burst + CHOREO.birth + i * 0.04;
  const since = t - birth;
  const flipStart = beats.burst + CHOREO.deck.flip + i * CHOREO.deck.step;
  const toss = flipStart + CHOREO.deck.toss;
  // The middle card is not thrown; it rises in place while the others fly out.
  const middle = i === layout.cards - 1;
  const p = SP.toss.value(t - toss);
  const flick = middle ? 0 : Math.sin(Math.PI * ease.outCubic(progress(t, toss, 0.5)));
  const land = landKick(t, flipStart);
  const born = 0.15 + 0.85 * SP.badge.value(since);
  return {
    x: geo.center.x + lerp(stack.dx, fan.dx, p),
    y:
      geo.center.y +
      lerp(stack.dy, fan.dy, p) +
      layout.card * 0.45 * (1 - SP.badgeRise.value(since)) -
      layout.card * 0.3 * flick,
    sx: born * lerp(1, fan.scale, p) * (1 + 0.08 * land),
    sy: (0.15 + 0.85 * SP.badgeLag.value(since - 0.035)) * lerp(1, fan.scale, p) * (1 - 0.1 * land),
    rz:
      lerp(stack.rz - 18 * (1 - SP.badgeTilt.value(since)), fan.rz, p) +
      (fan.dx < 0 ? -26 : 26) * flick,
    theta: flipAngle(t, flipStart),
    opacity: progress(t, birth, 0.1),
    flipStart,
    stretch: 0,
    dir: 0,
    tossed: t >= toss,
    settle: progress(t, toss + 0.25, 0.3),
  };
}

/** The flight path is scaled from the stage badge; the landing scale from this card's own edge. */
export interface FlightScale {
  size: number;
  edge: number;
}

/** "Devam edelim": squash, lift, dive into the avatar (or shrink away where there is none). */
export function exitBadgePose(
  pose: BadgePose,
  i: number,
  t: number,
  beats: SceneBeats,
  scale: FlightScale,
  target: { center: Point; size: number } | null,
): BadgePose {
  if (beats.exit === null) return pose;
  const stagger = i * CHOREO.exit.stagger;
  const windStart = beats.exit + CHOREO.exit.windup + stagger;
  if (t < windStart) return pose;
  const wind = ease.outQuad(progress(t, windStart, 0.12));
  const wound = { ...pose, sx: pose.sx * (1 + 0.1 * wind), sy: pose.sy * (1 - 0.14 * wind), rz: pose.rz + 6 * wind };
  const start = beats.exit + CHOREO.exit.launch + stagger;
  if (t < start) return wound;
  const flight = CHOREO.exit.flight;
  const at = (time: number) => ease.dive(progress(time, start, flight));
  const p = at(t);
  const from: Point = { x: pose.x, y: pose.y };
  const baseScale = (pose.sx + pose.sy) / 2;
  if (!target) {
    // No avatar on this surface: the badge folds into its own light.
    return { ...wound, sx: baseScale * (1 - p), sy: baseScale * (1 - p), opacity: pose.opacity * (1 - p) };
  }
  const control = flightControl(from, target.center, scale.size);
  const position = quadPoint(from, control, target.center, p);
  const tangent = quadTangent(from, control, target.center, p);
  const speed = Math.hypot(tangent.x, tangent.y) * ((at(t + 0.004) - at(t - 0.004)) / 0.008);
  const landing = lerp(baseScale, target.size / scale.edge, ease.inOutCubic(p));
  return {
    ...wound,
    x: position.x,
    y: position.y,
    sx: landing,
    sy: landing,
    rz: lerp(wound.rz, -12, ease.outCubic(p)) * (1 - ease.inQuad(p)),
    stretch: clamp(speed / 2400, 0, 0.42),
    dir: Math.atan2(tangent.y, tangent.x),
    opacity: pose.opacity * (1 - progress(t, start + flight - 0.05, 0.07)),
  };
}

export interface CopyPose {
  eyebrow: { opacity: number; y: number };
  words: Array<{ opacity: number; y: number; scale: number }>;
  body: { opacity: number; y: number };
  ledge: { opacity: number; y: number; pressed: boolean };
}

export function copyPose(t: number, beats: SceneBeats, wordCount: number): CopyPose {
  const base = beats.copy ?? Number.POSITIVE_INFINITY;
  const out = beats.exit === null ? 0 : ease.inQuad(progress(t, beats.exit + CHOREO.exit.copyOut, 0.18));
  const eyebrow = ease.outQuint(progress(t, base, 0.36));
  const body = ease.outQuint(progress(t, base + (CHOREO.body - CHOREO.eyebrow), 0.42));
  const titleAt = base + (CHOREO.title - CHOREO.eyebrow);
  const ledgeAt = base + (CHOREO.ledge - CHOREO.eyebrow);
  const ledge = SP.ledge.value(t - ledgeAt);
  const ledgeOut = beats.exit === null ? 0 : ease.inQuad(progress(t, beats.exit + 0.1, 0.2));
  return {
    eyebrow: { opacity: eyebrow * (1 - out), y: 10 * (1 - eyebrow) + 8 * out },
    words: Array.from({ length: wordCount }, (_, i) => {
      const since = t - (titleAt + i * CHOREO.titleStagger);
      const v = SP.title.value(since);
      return { opacity: progress(since, 0, 0.12) * (1 - out), y: 18 * (1 - v) + 8 * out, scale: 0.4 + 0.6 * v };
    }),
    body: { opacity: body * (1 - out), y: 10 * (1 - body) + 8 * out },
    ledge: {
      opacity: progress(t - ledgeAt, 0, 0.15) * (1 - ledgeOut),
      y: 70 * (1 - ledge) + 20 * ledgeOut,
      pressed: beats.exit !== null && t >= beats.exit && t < beats.exit + CHOREO.exit.press,
    },
  };
}
