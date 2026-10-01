/**
 * Canvas primitives for the achievement scene: soft glows, four-point sparkles, velocity streaks,
 * rings, light rays and the ellipse the swoosh and motes travel on.
 */
import { rgba, type Point } from "./scene-engine";

export type Paint = CanvasRenderingContext2D;

export const WHITE = "#FFFFFF";
/** The near-white at the heart of every light; warm, never blue. */
export const WARM_WHITE = "#FFF6E3";

/** The scene was choreographed around a 236 px badge; distances scale from there. */
export const REFERENCE_BADGE = 236;

export function glow(g: Paint, x: number, y: number, r: number, hex: string, a: number): void {
  if (a <= 0.002 || r <= 0.2) return;
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, rgba(hex, a));
  grad.addColorStop(0.32, rgba(hex, a * 0.5));
  grad.addColorStop(1, rgba(hex, 0));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

/** The reference's twinkle: four points with concave sides. */
export function sparkle(
  g: Paint,
  x: number,
  y: number,
  r: number,
  rotation: number,
  hex: string,
  a: number,
): void {
  if (a <= 0.002 || r <= 0.2) return;
  g.save();
  g.translate(x, y);
  g.rotate(rotation);
  g.fillStyle = rgba(hex, a);
  g.beginPath();
  const inner = r * 0.14;
  for (let i = 0; i < 4; i += 1) {
    const a0 = (i / 4) * Math.PI * 2;
    const a1 = ((i + 0.5) / 4) * Math.PI * 2;
    const a2 = ((i + 1) / 4) * Math.PI * 2;
    if (i === 0) g.moveTo(Math.cos(a0) * r, Math.sin(a0) * r);
    g.quadraticCurveTo(Math.cos(a1) * inner, Math.sin(a1) * inner, Math.cos(a2) * r, Math.sin(a2) * r);
  }
  g.closePath();
  g.fill();
  g.restore();
}

/** A diamond stretched along its velocity: fast light reads as a streak. */
export function streak(
  g: Paint,
  at: Point,
  velocity: Point,
  length: number,
  width: number,
  hex: string,
  a: number,
): void {
  if (a <= 0.002) return;
  const speed = Math.hypot(velocity.x, velocity.y) || 1;
  const ux = velocity.x / speed;
  const uy = velocity.y / speed;
  g.fillStyle = rgba(hex, a);
  g.beginPath();
  g.moveTo(at.x + (ux * length) / 2, at.y + (uy * length) / 2);
  g.lineTo(at.x - (uy * width) / 2, at.y + (ux * width) / 2);
  g.lineTo(at.x - (ux * length) / 2, at.y - (uy * length) / 2);
  g.lineTo(at.x + (uy * width) / 2, at.y - (ux * width) / 2);
  g.closePath();
  g.fill();
}

/** A hairline ring with a soft halo of the same colour. */
export function ring(g: Paint, x: number, y: number, r: number, width: number, hex: string, a: number): void {
  if (a <= 0.002 || r <= 0.2) return;
  g.strokeStyle = rgba(hex, a * 0.35);
  g.lineWidth = width * 2.6;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = rgba(hex, a);
  g.lineWidth = width;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
}

/** A beam fanning out from the burst, fading along its length. */
export function ray(
  g: Paint,
  from: Point,
  angle: number,
  length: number,
  width: number,
  hex: string,
  a: number,
): void {
  if (a <= 0.002) return;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const px = -uy;
  const py = ux;
  const end = { x: from.x + ux * length, y: from.y + uy * length };
  const grad = g.createLinearGradient(from.x, from.y, end.x, end.y);
  grad.addColorStop(0, rgba(hex, a));
  grad.addColorStop(0.4, rgba(hex, a * 0.32));
  grad.addColorStop(1, rgba(hex, 0));
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(from.x + px * 2, from.y + py * 2);
  g.lineTo(end.x + (px * width) / 2, end.y + (py * width) / 2);
  g.lineTo(end.x - (px * width) / 2, end.y - (py * width) / 2);
  g.lineTo(from.x - px * 2, from.y - py * 2);
  g.closePath();
  g.fill();
}

/** A point on an ellipse tilted by `tilt` radians. */
export function ellipsePoint(
  center: Point,
  rx: number,
  ry: number,
  tilt: number,
  angle: number,
): Point {
  const ex = Math.cos(angle) * rx;
  const ey = Math.sin(angle) * ry;
  return {
    x: center.x + ex * Math.cos(tilt) - ey * Math.sin(tilt),
    y: center.y + ex * Math.sin(tilt) + ey * Math.cos(tilt),
  };
}
