/**
 * The numbers behind the hung board's sway (DESIGN.md §9.1, "the sway decision"): a board on a
 * nail swings about that nail and comes to rest. It is pushed, never looped.
 */

/**
 * A damped pendulum about the nail: a swing every ~0.57 s (what a cord this short gives), losing
 * most of its height in three, so it reads as settled at about 1.3 s.
 */
export const SWAY_SPRING = {
  type: "spring",
  stiffness: 120,
  damping: 4,
  mass: 1,
  restDelta: 0.02,
  restSpeed: 0.5,
} as const;

/**
 * How hard each cause pushes, in degrees per second. With `SWAY_SPRING` the first swing peaks at
 * roughly a fifteenth of the push: just under 3° for an arrival, 1.5° for a mouse, 1° for a rehang.
 */
export const SWAY_KICK = { arrival: 42, hover: 22, rehang: 16 } as const;

/**
 * The push a mouse gives on its way in. Positive rotation is clockwise, and about a pivot at the
 * top that carries the bottom to the left: so a mouse from the left pushes negative.
 */
export function hoverKick(pointerX: number, box: { left: number; width: number }): number {
  return pointerX < box.left + box.width / 2 ? -SWAY_KICK.hover : SWAY_KICK.hover;
}

const KEY = "mentor.visionBoardHung";

/** The editor saved a published board: the next sight of it on the panel is a fresh hanging. */
export function markBoardHung(): void {
  try {
    window.sessionStorage.setItem(KEY, "1");
  } catch {
    // Storage unavailable (private mode, quota): the board simply does not sway on arrival.
  }
}

/** Reads and spends the flag, so a refresh does not sway the board again. */
export function takeBoardHung(): boolean {
  try {
    const hung = window.sessionStorage.getItem(KEY) === "1";
    window.sessionStorage.removeItem(KEY);
    return hung;
  } catch {
    return false;
  }
}
