/**
 * The light before the badge: the spark leaving the student's tap, the orb it becomes, the motes
 * it pulls in on a tilted ring (far half behind, near half in front) and the badge outline drawing
 * itself around them.
 */
import { BADGE_PENTAGON, CHOREO, type SceneBeats } from "./scene-choreography";
import { clamp, ease, lerp, progress, quadPoint, quadTangent, rng, rgba, type Point } from "./scene-engine";
import { orbPose } from "./scene-poses";
import { REFERENCE_BADGE, WARM_WHITE, WHITE, glow, ring, type Paint } from "./paint-primitives";

export interface LightScene {
  back: Paint;
  front: Paint;
  t: number;
  beats: SceneBeats;
  center: Point;
  /** Badge edge, px. */
  size: number;
  origin: Point;
  glow: string;
  alt: string;
}

interface Mote {
  start: number;
  radius: number;
  orbit: number;
  speed: number;
  size: number;
  alpha: number;
  delay: number;
  tone: number;
}

const MOTES: ReadonlyArray<Mote> = (() => {
  const random = rng(11);
  return Array.from({ length: 26 }, (_, i) => ({
    start: random() * Math.PI * 2,
    radius: 240 + random() * 150,
    orbit: 70 + random() * 62,
    speed: 1.5 + random() * 1.3,
    size: 1.1 + random() * 1.7,
    alpha: 0.55 + random() * 0.45,
    delay: i * 0.02,
    tone: random(),
  }));
})();

const RING_TILT = -0.2;

function sparkPath(scene: LightScene): [Point, Point, Point] {
  const k = scene.size / REFERENCE_BADGE;
  const { origin, center } = scene;
  const control = {
    x: (origin.x + center.x) / 2 + (origin.x <= center.x ? -70 : 70) * k,
    y: Math.min(origin.y, center.y) - 150 * k,
  };
  return [origin, control, center];
}

export function paintSpark(scene: LightScene): void {
  const { front: g, t, origin } = scene;
  const { sparkLaunch: launch, sparkLand: land } = CHOREO;
  if (t >= 0 && t < launch + 0.12) {
    const charge = ease.outCubic(progress(t, 0, launch));
    glow(g, origin.x, origin.y, 8 + 26 * charge, scene.glow, 0.75 * charge * (1 - progress(t, launch, 0.12)));
  }
  if (t >= launch && t < launch + 0.4) {
    const p = ease.outCubic(progress(t, launch, 0.38));
    ring(g, origin.x, origin.y, 8 + 30 * p, 2 * (1 - p) + 0.4, WARM_WHITE, 0.8 * (1 - p));
  }
  if (t < launch || t >= land) return;

  const [p0, p1, p2] = sparkPath(scene);
  const at = (time: number) => ease.launch(progress(time, launch, land - launch));
  const position = quadPoint(p0, p1, p2, at(t));
  const tangent = quadTangent(p0, p1, p2, at(t));
  const rate = (at(t + 0.004) - at(t - 0.004)) / 0.008;
  const speed = Math.hypot(tangent.x, tangent.y) * rate;

  g.globalCompositeOperation = "lighter";
  for (let k = 14; k >= 1; k -= 1) {
    const before = t - k * 0.011;
    if (before < launch) continue;
    const trail = quadPoint(p0, p1, p2, at(before));
    const f = 1 - k / 15;
    glow(g, trail.x, trail.y, 3 + 9 * f, scene.glow, 0.5 * f);
  }
  glow(g, position.x, position.y, 30, scene.glow, 0.75);
  const stretch = clamp(speed / 1500, 0, 1.1);
  g.save();
  g.translate(position.x, position.y);
  g.rotate(Math.atan2(tangent.y, tangent.x));
  g.scale(1 + stretch * 1.6, 1 / (1 + stretch * 0.45));
  glow(g, 0, 0, 9, WHITE, 1);
  g.fillStyle = WHITE;
  g.beginPath();
  g.arc(0, 0, 3.2, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.globalCompositeOperation = "source-over";
}

function motePosition(scene: LightScene, mote: Mote, t: number) {
  const { beats, center } = scene;
  const k = scene.size / REFERENCE_BADGE;
  const since = t - (CHOREO.orbReady + mote.delay);
  if (since < 0 || (beats.burst !== null && t >= beats.burst)) return null;
  const arrive = ease.outCubic(clamp(since / 0.62));
  const waitEnd = beats.ignite ?? CHOREO.orbReady + CHOREO.autoIgniteDelay;
  const tighten = ease.inOutSine(progress(t, CHOREO.orbReady, Math.max(0.01, waitEnd - CHOREO.orbReady)));
  const windup = beats.ignite === null ? 0 : ease.inCubic(progress(t, beats.ignite, CHOREO.windup));
  const radius = lerp(lerp(mote.radius, mote.orbit * (1 - 0.3 * tighten), arrive), 4, windup) * k;
  const angle = mote.start + mote.speed * since + windup * 2.4;
  const flatten = lerp(0.9, 0.38, arrive);
  const ex = Math.cos(angle) * radius;
  const ey = Math.sin(angle) * radius * flatten;
  return {
    x: center.x + ex * Math.cos(RING_TILT) - ey * Math.sin(RING_TILT),
    y: center.y + ex * Math.sin(RING_TILT) + ey * Math.cos(RING_TILT),
    depth: (Math.sin(angle) + 1) / 2,
    alpha: mote.alpha * clamp(since / 0.22),
  };
}

export function paintMotes(scene: LightScene): void {
  for (const mote of MOTES) {
    const at = motePosition(scene, mote, scene.t);
    if (!at) continue;
    const g = at.depth > 0.5 ? scene.front : scene.back;
    const tone = mote.tone < 0.55 ? scene.glow : mote.tone < 0.85 ? scene.alt : WHITE;
    g.globalCompositeOperation = "lighter";
    for (let k = 1; k <= 3; k += 1) {
      const before = motePosition(scene, mote, scene.t - k * 0.018);
      if (before) glow(g, before.x, before.y, mote.size * 2.2, tone, at.alpha * 0.22 * (1 - k / 4));
    }
    glow(g, at.x, at.y, mote.size * (4 + 2 * at.depth), tone, at.alpha * (0.4 + 0.35 * at.depth));
    g.fillStyle = rgba(WHITE, at.alpha * (0.6 + 0.4 * at.depth));
    g.beginPath();
    g.arc(at.x, at.y, mote.size * (0.7 + 0.4 * at.depth), 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = "source-over";
  }
}

/** The badge-to-be draws its own outline around the gathering light; returns the pen tip. */
export function paintOutline(
  g: Paint,
  center: Point,
  size: number,
  drawn: number,
  hex: string,
  alpha: number,
  width: number,
): Point | null {
  if (alpha <= 0.002 || drawn <= 0) return null;
  const points = BADGE_PENTAGON.map(([u, v]) => ({ x: center.x + (u - 0.5) * size, y: center.y + (v - 0.5) * size }));
  const lengths = points.map((p, i) => {
    const next = points[(i + 1) % points.length]!;
    return Math.hypot(next.x - p.x, next.y - p.y);
  });
  let remaining = lengths.reduce((sum, l) => sum + l, 0) * drawn;
  g.strokeStyle = rgba(hex, alpha);
  g.lineWidth = width;
  g.lineJoin = "round";
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(points[0]!.x, points[0]!.y);
  let tip = points[0]!;
  for (let i = 0; i < points.length && remaining > 0; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const f = Math.min(1, remaining / lengths[i]!);
    tip = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    g.lineTo(tip.x, tip.y);
    remaining -= lengths[i]!;
  }
  g.stroke();
  return tip;
}

export function paintOrb(scene: LightScene): void {
  const pose = orbPose(scene.t, scene.beats);
  if (!pose) return;
  const { t, center, front: g } = scene;
  const k = scene.size / REFERENCE_BADGE;

  const drawn = ease.outQuint(progress(t, 0.85, 0.95));
  const tip = paintOutline(scene.back, center, scene.size, drawn, "#FFE2AA", 0.5 * (1 - pose.windup * 0.4), 1.6);
  if (tip && drawn < 1) glow(scene.back, tip.x, tip.y, 10, scene.glow, 0.9);

  g.save();
  g.translate(center.x, center.y);
  g.scale(pose.sx, pose.sy);
  g.globalCompositeOperation = "lighter";
  glow(g, 0, 0, pose.glow * k, scene.glow, 0.45 + 0.35 * pose.heat + 0.2 * pose.windup);
  glow(g, 0, 0, pose.core * 2.6 * k, WARM_WHITE, 0.85);
  g.globalCompositeOperation = "source-over";
  g.fillStyle = WHITE;
  g.beginPath();
  g.arc(0, 0, pose.core * 0.62 * k, 0, Math.PI * 2);
  g.fill();
  g.restore();
}
