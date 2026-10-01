/**
 * The scene's three canvases (stars behind everything, light behind and in front of the badge)
 * cover the viewport. Their backing store is capped: soft light needs no retina pixels, and a 4K
 * desktop would otherwise clear tens of millions of pixels every frame.
 */
import type { Paint } from "./paint-primitives";
import type { SceneDom } from "./scene-dom";

const MAX_RATIO = 1.5;
/** Backing-store pixels allowed per canvas. */
const PIXEL_BUDGET = 2_500_000;

export interface ScenePaints {
  stars: Paint;
  back: Paint;
  front: Paint;
  ratio: number;
}

export function canvasRatio(viewport: { width: number; height: number }, deviceRatio: number): number {
  const area = Math.max(1, viewport.width * viewport.height);
  return Math.min(Math.max(1, deviceRatio), MAX_RATIO, Math.sqrt(PIXEL_BUDGET / area));
}

/** Sizes the backing stores for `viewport`; a no-op for canvases already at that size. */
export function prepareCanvases(
  dom: SceneDom,
  viewport: { width: number; height: number },
  deviceRatio: number,
): ScenePaints | null {
  const ratio = canvasRatio(viewport, deviceRatio);
  const width = Math.max(1, Math.round(viewport.width * ratio));
  const height = Math.max(1, Math.round(viewport.height * ratio));
  const context = (canvas: HTMLCanvasElement) => {
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    return canvas.getContext("2d");
  };
  const stars = context(dom.stars);
  const back = context(dom.back);
  const front = context(dom.front);
  if (!stars || !back || !front) return null;
  return { stars, back, front, ratio };
}

/** Clears a canvas and leaves it drawing in CSS pixels. */
export function beginPaint(g: Paint, ratio: number): void {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = 1;
  g.clearRect(0, 0, g.canvas.width, g.canvas.height);
  g.setTransform(ratio, 0, 0, ratio, 0, 0);
}
