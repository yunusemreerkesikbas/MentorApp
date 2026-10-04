/**
 * The night sky behind the scene: three depths of stars that only show where the curtain has
 * already fallen, drift a little with the camera push and twinkle on their own phase.
 */
import { clamp, rgba, rng } from "./scene-engine";
import { WHITE, glow, sparkle, type Paint } from "./paint-primitives";

interface Star {
  u: number;
  v: number;
  size: number;
  alpha: number;
  rate: number;
  phase: number;
  depth: 0 | 1 | 2;
}

const MAX_STARS = 180;
/** One star per this many px² of viewport. */
const STAR_AREA = 2800;

const STARS: ReadonlyArray<Star> = (() => {
  const random = rng(7);
  return Array.from({ length: MAX_STARS }, (_, i) => {
    const depth = (i % 9 === 0 ? 2 : i % 3 === 0 ? 1 : 0) as Star["depth"];
    return {
      u: random(),
      v: random(),
      size: [0.7, 1.1, 1.6][depth]! * (0.75 + random() * 0.5),
      alpha: [0.42, 0.62, 0.85][depth]! * (0.6 + random() * 0.4),
      rate: 0.3 + random() * 0.9,
      phase: random(),
      depth,
    };
  });
})();

const PARALLAX = [0.25, 0.55, 1] as const;

/** The night curtain is this many viewports tall: solid for the first, then a soft lower edge. */
export const CURTAIN_SHEET = 1.6;

/** How much of viewport row `y` the night covers (matches the curtain's CSS gradient). */
export function curtainCoverage(y: number, sheetTop: number, height: number): number {
  const solid = sheetTop + height;
  if (y <= solid) return 1;
  return clamp(1 - ((y - solid) / ((CURTAIN_SHEET - 1) * height)) ** 0.8);
}

export function paintSky(
  g: Paint,
  t: number,
  viewport: { width: number; height: number },
  center: { x: number; y: number },
  sheetTop: number,
  night: number,
  camera: number,
): void {
  if (night <= 0.002) return;
  const count = Math.round(clamp((viewport.width * viewport.height) / STAR_AREA, 40, MAX_STARS));
  for (let i = 0; i < count; i += 1) {
    const star = STARS[i]!;
    const depth = PARALLAX[star.depth];
    const baseY = 40 + star.v * (viewport.height - 120);
    const push = 1 + (camera - 1) * depth * 1.6;
    const x = center.x + (star.u * viewport.width - center.x) * push;
    const y = center.y + (baseY - center.y) * push + t * 2.5 * depth;
    const twinkle = 0.62 + 0.38 * Math.sin(Math.PI * 2 * (star.rate * t + star.phase));
    const alpha = star.alpha * twinkle * curtainCoverage(baseY, sheetTop, viewport.height) * night;
    if (alpha <= 0.01) continue;
    if (star.depth === 2) {
      glow(g, x, y, star.size * 5, "#CFE0FF", alpha * 0.35);
      sparkle(g, x, y, star.size * 2.6, 0, WHITE, alpha);
    } else {
      g.fillStyle = rgba(star.depth === 1 ? "#EAF1FF" : "#C9D6FF", alpha);
      g.beginPath();
      g.arc(x, y, star.size * 0.6, 0, Math.PI * 2);
      g.fill();
    }
  }
}
