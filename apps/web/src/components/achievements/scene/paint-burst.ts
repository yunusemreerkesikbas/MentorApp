/**
 * From the burst on: rays, shockwaves and particles; the comet swoosh and edge flash of every
 * flip; the corner twinkles; the trail of the flight home and the ring it leaves on the avatar.
 */
import { CHOREO, flightControl, type SceneBeats, type SceneLight } from "./scene-choreography";
import { clamp, ease, keys, progress, quadPoint, rng, rgba, type Point } from "./scene-engine";
import { paintOutline } from "./paint-light";
import {
  REFERENCE_BADGE,
  WARM_WHITE,
  WHITE,
  ellipsePoint,
  glow,
  ray,
  ring,
  sparkle,
  streak,
  type Paint,
} from "./paint-primitives";

export interface BurstScene {
  back: Paint;
  front: Paint;
  t: number;
  beats: SceneBeats;
  center: Point;
  size: number;
  lights: ReadonlyArray<SceneLight>;
  /** 0..1 as the curtain lifts on the exit; lingering light fades with it. */
  lift: number;
}

const RAYS = (() => {
  const random = rng(31);
  return Array.from({ length: 12 }, (_, i) => ({
    angle: (i / 12) * Math.PI * 2 + (random() - 0.5) * 0.3,
    length: 380 + random() * 230,
    width: 30 + random() * 64,
    alpha: 0.32 + random() * 0.42,
  }));
})();

const PARTICLES = (() => {
  const random = rng(23);
  return Array.from({ length: 46 }, (_, i) => {
    const kind = i % 3 === 0 ? "streak" : i % 3 === 1 ? "sparkle" : "dot";
    const fast = kind === "streak";
    return {
      kind,
      angle: random() * Math.PI * 2,
      speed: (fast ? 420 : 170) + random() * (fast ? 360 : 300),
      drag: 2.1 + random() * 1.7,
      gravity: kind === "dot" ? 80 : 26,
      life: fast ? 0.5 + random() * 0.35 : 0.95 + random() * 0.8,
      size: kind === "sparkle" ? 5 + random() * 9 : fast ? 12 + random() * 16 : 1.6 + random() * 2.4,
      front: i % 2 === 0,
      light: i,
      warm: random() < 0.6,
      rotation: random() * Math.PI,
      spin: (random() - 0.5) * 7,
      delay: random() * 0.05,
      phase: random() * 6,
    };
  });
})();

const TRAIL = (() => {
  const random = rng(41);
  return Array.from({ length: 22 }, (_, j) => ({
    at: j / 22,
    dx: (random() - 0.5) * 22,
    dy: (random() - 0.5) * 22,
    size: 2.5 + random() * 4.5,
    rotation: random() * Math.PI,
    sparkle: random() < 0.55,
  }));
})();

const ARRIVAL = (() => {
  const random = rng(53);
  return Array.from({ length: 9 }, (_, i) => ({
    angle: (i / 9) * Math.PI * 2 + random() * 0.4,
    speed: 110 + random() * 110,
    size: 3 + random() * 4,
    rotation: random() * Math.PI,
  }));
})();

export function paintBurst(scene: BurstScene): void {
  const { t, beats, center, back, size } = scene;
  if (beats.burst === null || t < beats.burst) return;
  const b = beats.burst;
  const age = t - b;
  const k = size / REFERENCE_BADGE;
  const light = scene.lights[0]!;

  if (age < 0.45) {
    const p = ease.outCubic(age / 0.45);
    paintOutline(back, center, size * (1 + 0.45 * p), 1, "#FFE2AA", 0.5 * (1 - p), 1.6 + 2 * (1 - p));
  }

  const rays =
    keys(t, [
      [b, 0],
      [b + 0.22, 1, ease.outQuad],
      [b + 1.5, 0.58, ease.inOutSine],
      [b + 3.3, 0, ease.inQuad],
    ]) *
    (1 - scene.lift);
  back.globalCompositeOperation = "lighter";
  for (const beam of RAYS) {
    ray(back, center, beam.angle + 0.15 * age, beam.length * k, beam.width * k, light.glow, beam.alpha * rays * 0.7);
  }
  back.globalCompositeOperation = "source-over";

  const wave1 = ease.outExpo(clamp(age / 0.7));
  ring(back, center.x, center.y, (26 + 320 * wave1) * k, 10 * (1 - wave1) + 0.6, WARM_WHITE, 0.9 * (1 - wave1) ** 1.2);
  if (age > 0.08) {
    const wave2 = ease.outExpo(clamp((age - 0.08) / 0.8));
    ring(back, center.x, center.y, (14 + 230 * wave2) * k, 6 * (1 - wave2) + 0.5, light.glow, 0.65 * (1 - wave2));
  }

  for (const p of PARTICLES) {
    const a = age - p.delay;
    if (a <= 0 || a >= p.life) continue;
    const decay = Math.exp(-p.drag * a);
    const travel = ((1 - decay) / p.drag) * k;
    const at = {
      x: center.x + Math.cos(p.angle) * p.speed * travel,
      y: center.y + Math.sin(p.angle) * p.speed * travel + 0.5 * p.gravity * a * a,
    };
    const velocity = { x: Math.cos(p.angle) * p.speed * decay, y: Math.sin(p.angle) * p.speed * decay + p.gravity * a };
    const left = 1 - a / p.life;
    const g = p.front ? scene.front : back;
    const own = scene.lights[p.light % scene.lights.length]!;
    const hue = p.warm ? own.glow : own.alt;
    g.globalCompositeOperation = "lighter";
    if (p.kind === "streak") {
      streak(g, at, velocity, p.size * (0.6 + Math.hypot(velocity.x, velocity.y) / 500), 2.6, WHITE, left ** 1.3);
      glow(g, at.x, at.y, 10, hue, 0.35 * left);
    } else if (p.kind === "sparkle") {
      const flicker = 0.72 + 0.28 * Math.sin(a * 28 + p.phase);
      glow(g, at.x, at.y, p.size * 2.2, hue, 0.35 * left * flicker);
      sparkle(g, at.x, at.y, p.size * (0.55 + 0.45 * left), p.rotation + p.spin * a, WHITE, left ** 1.2 * flicker);
    } else {
      glow(g, at.x, at.y, p.size * 4, hue, 0.8 * left ** 1.5);
    }
    g.globalCompositeOperation = "source-over";
  }
}

export interface FlipMark {
  start: number;
  center: Point;
  /** Card scale relative to the single badge. */
  scale: number;
  theta: number;
}

/** The swoosh: a comet ribbon on a tilted ring, thick at the head, a hairline at the tail. */
function swoosh(scene: BurstScene, mark: FlipMark, hex: string): void {
  const p = progress(scene.t, mark.start + CHOREO.flipWindup - 0.06, 0.5);
  if (p <= 0 || p >= 1) return;
  const envelope = Math.sin(Math.PI * clamp(p * 1.15));
  const head = Math.PI * 1.15 - Math.PI * 2 * 1.25 * ease.outCubic(p);
  const r = (scene.size / REFERENCE_BADGE) * mark.scale;
  const centre = { x: mark.center.x, y: mark.center.y + 8 * r };
  const length = 3.3 * envelope;
  const width = 7 * r;
  const steps = 56;
  for (let i = 0; i < steps; i += 1) {
    const f0 = i / steps;
    const a0 = head + length * f0;
    const a1 = head + length * ((i + 1) / steps);
    const from = ellipsePoint(centre, 168 * r, 36 * r, -0.17, a0);
    const to = ellipsePoint(centre, 168 * r, 36 * r, -0.17, a1);
    const g = Math.sin((a0 + a1) / 2) > 0 ? scene.front : scene.back;
    const fade = (1 - f0) ** 1.5;
    const w = 0.5 + width * (1 - f0) ** 0.85;
    g.lineCap = "round";
    g.strokeStyle = rgba(hex, envelope * fade * 0.42);
    g.lineWidth = w * 2.6;
    g.beginPath();
    g.moveTo(from.x, from.y);
    g.lineTo(to.x, to.y);
    g.stroke();
    g.strokeStyle = rgba(WHITE, envelope * fade);
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(from.x, from.y);
    g.lineTo(to.x, to.y);
    g.stroke();
  }
}

export function paintFlips(scene: BurstScene, marks: ReadonlyArray<FlipMark>): void {
  marks.forEach((mark, i) => {
    const hex = (scene.lights[i] ?? scene.lights[0]!).glow;
    swoosh(scene, mark, hex);
    // Edge-on, the card catches the light.
    const a = clamp(1 - Math.abs(mark.theta - 90) / 24);
    if (a <= 0.01) return;
    const height = scene.size * mark.scale;
    const g = scene.front;
    g.globalCompositeOperation = "lighter";
    g.save();
    g.translate(mark.center.x, mark.center.y);
    g.scale(0.16, 1);
    glow(g, 0, 0, height * 0.62, WARM_WHITE, 0.95 * a);
    g.restore();
    sparkle(g, mark.center.x, mark.center.y - height * 0.36, 10 * a, 0, WHITE, a);
    g.globalCompositeOperation = "source-over";
  });
}

/** Two twinkles on the corners once the art faces the student; they go when the exit starts. */
export function paintCornerSparkles(scene: BurstScene, flipStart: number, pop: (t: number) => number): void {
  const k = scene.size / REFERENCE_BADGE;
  const spots = [
    { dx: 84, dy: -76, at: 0.42, r: 15 },
    { dx: -92, dy: 44, at: 0.66, r: 9 },
  ];
  const g = scene.front;
  g.globalCompositeOperation = "lighter";
  for (const spot of spots) {
    const since = scene.t - (flipStart + spot.at);
    if (since <= 0 || since > 1.6 || (scene.beats.exit !== null && scene.t > scene.beats.exit)) continue;
    const grow = pop(since);
    const fade = 1 - progress(since, 1, 0.6);
    const x = scene.center.x + spot.dx * k;
    const y = scene.center.y + spot.dy * k;
    glow(g, x, y, spot.r * 2.2 * grow * k, scene.lights[0]!.glow, 0.5 * fade);
    sparkle(g, x, y, spot.r * grow * k, (Math.PI / 4) * ease.outCubic(clamp(since / 0.5)), WHITE, fade);
  }
  g.globalCompositeOperation = "source-over";
}

export interface Flight {
  from: Point;
  /** Index into the stagger. */
  order: number;
  light: SceneLight;
}

/** The sparkle trail of the flight home and the ring each badge leaves on the avatar. */
export function paintFlights(
  scene: BurstScene,
  flights: ReadonlyArray<Flight>,
  target: { center: Point; size: number } | null,
): void {
  const exit = scene.beats.exit;
  if (exit === null) return;
  const g = scene.front;
  const { launch, flight, stagger } = CHOREO.exit;
  g.globalCompositeOperation = "lighter";
  for (const f of flights) {
    const start = exit + launch + f.order * stagger;
    const to = target?.center ?? f.from;
    const control = flightControl(f.from, to, scene.size);
    for (const bit of TRAIL) {
      const age = scene.t - (start + bit.at * flight * 0.92);
      if (!target || age <= 0 || age > 0.5) continue;
      const at = quadPoint(f.from, control, to, ease.dive(bit.at * 0.92));
      const life = 1 - age / 0.5;
      const x = at.x + bit.dx * (age / 0.5);
      const y = at.y + bit.dy * (age / 0.5) + 20 * age;
      if (bit.sparkle) sparkle(g, x, y, bit.size * life, bit.rotation, WHITE, life);
      glow(g, x, y, bit.size * 2.4, f.light.glow, 0.55 * life);
    }
    const arrive = scene.t - (start + flight);
    if (arrive <= 0 || arrive >= CHOREO.exit.arrival) continue;
    const p = ease.outCubic(arrive / 0.6);
    const reach = (target?.size ?? scene.size * 0.3) / 2;
    ring(g, to.x, to.y, reach + 46 * p, 3 * (1 - p) + 0.5, f.light.glow, 0.95 * (1 - p));
    const p2 = ease.outCubic(clamp((arrive - 0.08) / 0.6));
    if (arrive > 0.08) ring(g, to.x, to.y, reach + 30 * p2, 1.6 * (1 - p2) + 0.4, WHITE, 0.7 * (1 - p2));
    glow(g, to.x, to.y, reach + 32, f.light.glow, 0.5 * (1 - p));
    const spread = (1 - Math.exp(-4 * arrive)) / 4;
    const fade = 1 - arrive / CHOREO.exit.arrival;
    for (const bit of ARRIVAL) {
      const x = to.x + Math.cos(bit.angle) * bit.speed * spread;
      const y = to.y + Math.sin(bit.angle) * bit.speed * spread;
      sparkle(g, x, y, bit.size * fade, bit.rotation + arrive * 4, WHITE, fade);
    }
  }
  g.globalCompositeOperation = "source-over";
}
