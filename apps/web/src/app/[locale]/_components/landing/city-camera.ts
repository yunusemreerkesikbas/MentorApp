/**
 * The landing's camera: pure math from scroll progress (0..1) to where the scene looks.
 *
 * The world is the approved canvas: 1600×1000 with Puhu's building in the middle. Every layer is a
 * 2400×1400 box whose own origin sits at world x = -400, scaled from its top-left corner.
 */

export const STOP_COUNT = 9;

/** x, y (world px), zoom, where that point sits on screen (0..1 across, 0..1 down), sky (0 night, 1 dawn). */
export type CameraKey = readonly [number, number, number, number, number, number];

export interface Camera {
  x: number;
  y: number;
  z: number;
  ax: number;
  ay: number;
  sky: number;
}

/**
 * One key per stop. `wide` puts the window on the right of a landscape screen with the note on the
 * left; `tall` keeps the window in the top part of a portrait screen, above the bottom sheet.
 */
export const CAMERA_KEYS: { wide: readonly CameraKey[]; tall: readonly CameraKey[] } = {
  wide: [
    [800, 560, 1.05, 0.7, 0.58, 0],
    [615, 396, 3.6, 0.68, 0.5, 0],
    [990, 396, 3.6, 0.68, 0.5, 0],
    [615, 629, 3.6, 0.68, 0.5, 0.02],
    [990, 629, 3.6, 0.68, 0.5, 0.04],
    [615, 875, 3.6, 0.68, 0.5, 0.06],
    [990, 875, 3.6, 0.68, 0.5, 0.1],
    [707, 396, 2.3, 0.66, 0.5, 0.3],
    [800, 240, 1, 0.5, 0.66, 1],
  ],
  tall: [
    [800, 560, 0.62, 0.5, 0.3, 0],
    [615, 396, 2.37, 0.5, 0.27, 0],
    [990, 396, 2.37, 0.5, 0.27, 0],
    [615, 629, 2.37, 0.5, 0.27, 0.02],
    [990, 629, 2.37, 0.5, 0.27, 0.04],
    [615, 875, 2.37, 0.5, 0.27, 0.06],
    [990, 875, 2.37, 0.5, 0.27, 0.1],
    [707, 396, 1.36, 0.5, 0.26, 0.3],
    [800, 300, 0.72, 0.5, 0.42, 1],
  ],
};

const SEGMENT = 1 / (STOP_COUNT - 1);
/** Share of a segment the camera rests at each end, so a stop holds still while its note is read. */
const HOLD = SEGMENT * 0.18;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function toCamera([x, y, z, ax, ay, sky]: CameraKey): Camera {
  return { x, y, z, ax, ay, sky };
}

export function cameraAt(progress: number, keys: readonly CameraKey[]): Camera {
  const p = clamp01(progress);
  for (let i = 0; i < STOP_COUNT - 1; i++) {
    const start = i * SEGMENT + HOLD;
    const end = (i + 1) * SEGMENT - HOLD;
    if (p <= start) return toCamera(keys[i]);
    if (p < end) {
      const t = (p - start) / (end - start);
      const e = t * t * (3 - 2 * t);
      const a = toCamera(keys[i]);
      const b = toCamera(keys[i + 1]);
      let z = Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * e);
      // Window to window: step back a little on the way, like a crane move, instead of sliding past glass.
      if (a.z > 1.5 && b.z > 1.5) z *= 1 - 0.32 * Math.sin(Math.PI * e);
      const mix = (from: number, to: number) => from + (to - from) * e;
      return { x: mix(a.x, b.x), y: mix(a.y, b.y), z, ax: mix(a.ax, b.ax), ay: mix(a.ay, b.ay), sky: mix(a.sky, b.sky) };
    }
  }
  return toCamera(keys[STOP_COUNT - 1]);
}

export function stopAt(progress: number): number {
  return Math.round(clamp01(progress) * (STOP_COUNT - 1));
}

/** 1 while the camera rests on `stop`, 0 before it starts moving to a neighbour. */
export function panelPresence(progress: number, stop: number): number {
  return clamp01(1 - (Math.abs(progress - stop * SEGMENT) - HOLD) / (SEGMENT * 0.2));
}

/** The other windows' rooms appear as the camera comes close; from afar the facade art shows lit glass. */
export function interiorOpacity(zoom: number): number {
  return clamp01((zoom - 1.3) / 0.9);
}

/** The foreground (roof corner, branches) is gone before the camera is close enough for it to cover a window. */
export function frontOpacity(zoom: number): number {
  return clamp01((2.1 - zoom) / 0.7);
}

type Rgb = readonly [number, number, number];
const NIGHT_TOP: Rgb = [7, 18, 42];
const NIGHT_BOTTOM: Rgb = [27, 53, 99];
const DUSK_TOP: Rgb = [28, 42, 94];
const DUSK_BOTTOM: Rgb = [126, 94, 150];
const DAWN_TOP: Rgb = [141, 178, 230];
const DAWN_BOTTOM: Rgb = [255, 210, 160];

function mixRgb(a: Rgb, b: Rgb, t: number): string {
  const [r, g, bl] = a.map((v, k) => Math.round(v + (b[k] - v) * t));
  return `rgb(${r}, ${g}, ${bl})`;
}

/** Night → dusk over the first 45%, dusk → dawn after. */
export function skyGradient(sky: number): string {
  const s = clamp01(sky);
  const [top, bottom] =
    s < 0.45
      ? [mixRgb(NIGHT_TOP, DUSK_TOP, s / 0.45), mixRgb(NIGHT_BOTTOM, DUSK_BOTTOM, s / 0.45)]
      : [mixRgb(DUSK_TOP, DAWN_TOP, (s - 0.45) / 0.55), mixRgb(DUSK_BOTTOM, DAWN_BOTTOM, (s - 0.45) / 0.55)];
  return `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`;
}

/**
 * Transform for a layer at `depth` (0 = sky, 1 = the building, >1 = in front of it). Deeper layers
 * follow the camera less, which is what makes the city feel layered. `liftY` raises a layer on
 * screens where it would otherwise cover the building.
 */
export function layerTransform(camera: Camera, depth: number, width: number, height: number, liftY = 0): string {
  const fit = Math.max(width / 1600, height / 1000);
  const scale = fit * (1 + (camera.z - 1) * depth);
  const px = 800 + (camera.x - 800) * depth;
  const py = 560 + (camera.y - 560) * depth - liftY;
  const tx = camera.ax * width - (px + 400) * scale;
  const ty = camera.ay * height - py * scale;
  return `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0) scale(${scale.toFixed(4)})`;
}
