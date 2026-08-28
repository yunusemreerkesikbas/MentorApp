/**
 * Auth hang-Puhu: sprite choice and the inspect-png box from the shared 384 canvas.
 * Idle blink/gaze cadence is the lamp's — same companion, same saccade hide.
 */

export type AuthHangFocus = "idle" | "text" | "password";

export type HangGaze = "centre" | "left" | "right";

export type HangPose =
  | "rest"
  | "blink"
  | "gazeLeft"
  | "gazeRight"
  | "lookDown"
  | "cover";

export const HANG_SPRITES: Record<HangPose, string> = {
  rest: "/mascot/puhu/auth/hang-rest.png",
  blink: "/mascot/puhu/auth/hang-blink.png",
  gazeLeft: "/mascot/puhu/auth/hang-gaze-left.png",
  gazeRight: "/mascot/puhu/auth/hang-gaze-right.png",
  lookDown: "/mascot/puhu/auth/hang-look-down.png",
  cover: "/mascot/puhu/auth/hang-cover.png",
};

export const HANG_POSES: HangPose[] = [
  "rest",
  "blink",
  "gazeLeft",
  "gazeRight",
  "lookDown",
  "cover",
];

/** `inspect-png.mjs` on hang-rest — layout pins to this box so cover's raised wings don't slide. */
export const HANG_ART = {
  source: 384,
  left: 78,
  top: 15,
  width: 228,
  height: 181,
} as const;

/**
 * Canvas row that sits on the sheet rim. hang-rest wings rest on the baked card
 * around y=153–168; pin there so the face stays above the sheet and the hands
 * can be painted in front. (The alpha box runs to y=195 as fringe.)
 */
export const HANG_GRIP_ROW = 160;

/** Display size (px). Numeric override of DESIGN.md §8.2 — hang needs more than `lg` (120). */
export const HANG_DISPLAY_PX = 176;

/** Fraction of the canvas where the wings meet the sheet rim. */
export const HANG_GRIP_Y = HANG_GRIP_ROW / HANG_ART.source;

/** Pixels the hang sits above the sheet — `main` keeps this as padding so overflow-hidden does not clip it. */
export const HANG_OVERHANG_PX = Math.round(HANG_DISPLAY_PX * HANG_GRIP_Y);

export const HANG_POSE_FADE_MS = 130;

/** Same cadence as `.mentor-puhu-bounce` (DESIGN.md §9.1 presence cue). */
export const HANG_BOB_PX = 4;
export const HANG_BOB_DURATION_S = 2;

/**
 * Front-layer windows for the rim grip (canvas fractions).
 * Two `clip-path: inset()` rects — CSS mask luminance treated #000 as “hide”.
 */
export const HANG_WING_CLIP = {
  left: { top: 148 / 384, right: 1 - 136 / 384, bottom: 1 - 200 / 384, left: 74 / 384 },
  right: { top: 148 / 384, right: 1 - 310 / 384, bottom: 1 - 200 / 384, left: 248 / 384 },
} as const;

export function hangWingClipPaths(): { left: string; right: string } {
  const box = (c: (typeof HANG_WING_CLIP)["left"]) => {
    const pct = (n: number) => `${(n * 100).toFixed(3)}%`;
    return `inset(${pct(c.top)} ${pct(c.right)} ${pct(c.bottom)} ${pct(c.left)})`;
  };
  return { left: box(HANG_WING_CLIP.left), right: box(HANG_WING_CLIP.right) };
}

/** Hang listens on the sheet (focusin) so Field forwarding cannot drop the pose. */
export function hangFocusFromTarget(target: EventTarget | null): AuthHangFocus | null {
  if (!(target instanceof HTMLInputElement)) return null;
  if (target.name === "password") return "password";
  if (target.name === "email" || target.name === "displayName") return "text";
  return null;
}

export function isPasswordRevealControl(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest("button[aria-pressed]") != null &&
    target.closest("label")?.querySelector('input[name="password"]') != null
  );
}

/**
 * Cover/look-down outrank a blink the way lamp `reach` does — those sprites already carry
 * their own eyes. Idle gaze only plays when no field is focused.
 */
export function hangPose(
  focus: AuthHangFocus,
  blinking: boolean,
  gaze: HangGaze,
): HangPose {
  if (focus === "password") return "cover";
  if (focus === "text") return "lookDown";
  if (blinking) return "blink";
  if (gaze === "left") return "gazeLeft";
  if (gaze === "right") return "gazeRight";
  return "rest";
}
