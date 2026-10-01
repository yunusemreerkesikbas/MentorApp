/**
 * Writes a badge pose to its DOM: position and squash in 2D, the flip in 3D, the light the face
 * catches as it turns, the specular band that travels with the turn and the glint sweeps.
 */
import { BADGE_GLINTS, CHOREO } from "./scene-choreography";
import { clamp, ease, progress, rgba } from "./scene-engine";
import type { BadgeDom } from "./scene-dom";
import type { BadgePose } from "./scene-poses";

export function applyBadgePose(badge: BadgeDom, pose: BadgePose, edge: number): void {
  const half = edge / 2;
  const stretch = pose.stretch
    ? `rotate(${pose.dir}rad) scale(${1 + pose.stretch}, ${1 / (1 + pose.stretch)}) rotate(${-pose.dir}rad) `
    : "";
  badge.root.style.transform = `translate3d(${pose.x - half}px, ${pose.y - half}px, 0)`;
  badge.root.style.opacity = String(clamp(pose.opacity));
  badge.tf.style.transform = `${stretch}rotate(${pose.rz}deg) scale(${pose.sx}, ${pose.sy})`;
  badge.rot.style.transform = `rotateY(${pose.theta}deg)`;
}

/**
 * Edge-on, the card brightens and a sheen crosses it in the direction of the turn; the rim plane
 * only exists while the card is turned (face-on it would be a hairline down the middle). The
 * Puhu mark on the back burns hotter as the flip approaches.
 */
export function lightBadge(badge: BadgeDom, theta: number, markHeat: number, glow: string): void {
  const rad = (theta * Math.PI) / 180;
  const edgeOn = clamp((Math.abs(Math.sin(rad)) - 0.3) / 0.7);
  const shade = 0.7 + 0.3 * Math.abs(Math.cos(rad));
  for (const face of badge.faces) face.style.filter = `brightness(${shade + edgeOn * 0.35})`;
  const sweep = ((((theta % 360) + 360) % 360) / 180) * 140 - 70;
  for (const sheen of badge.sheens) {
    sheen.style.opacity = String(edgeOn * 0.8);
    sheen.style.transform = `translateX(${sweep}%)`;
  }
  badge.edge.style.opacity = String(clamp((Math.abs(Math.sin(rad)) - 0.12) / 0.25));
  badge.mark.style.filter = `drop-shadow(0 0 ${6 + 12 * markHeat}px ${rgba(glow, 0.55 + 0.4 * markHeat)})`;
}

/** A glint band is this fraction of the badge wide; it sweeps from 40 % off the left edge to 35 % off the right. */
export const GLINT_BAND = 0.34;
const GLINT_TILT = -14;

/** Glint sweeps across the art once it faces the student. */
export function sweepGlints(badge: BadgeDom, t: number, flipStart: number): void {
  const landed = flipStart + CHOREO.flipWindup;
  BADGE_GLINTS.forEach((glint, i) => {
    const band = badge.glints[i];
    if (!band) return;
    const p = progress(t, landed + glint.delay, glint.duration);
    const left = -0.4 + 1.75 * ease.outExpo(p);
    band.style.transform = `translateX(${(left / GLINT_BAND) * 100}%) skewX(${GLINT_TILT}deg)`;
    band.style.opacity = String(p <= 0 || p >= 1 ? 0 : glint.peak * Math.sin(Math.PI * p));
  });
}
