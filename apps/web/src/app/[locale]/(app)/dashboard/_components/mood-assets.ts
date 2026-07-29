/**
 * Daily mood check-in assets — generic 3D emoji faces (not Puhu).
 * Files live under `apps/web/public/img/`. Mood 5 (`great`) pending; reuse `good` until delivered.
 */
export const MOOD_IMAGE_BY_VALUE: Record<number, string> = {
  1: "/img/draining.png",
  2: "/img/low.png",
  3: "/img/balanced.png",
  4: "/img/good.png",
  /** Replace with `/img/great.jpg` when the asset arrives. */
  5: "/img/very-good.png",
};

export const MOOD_WHEEL_OPTIONS = (
  [1, 2, 3, 4, 5] as const
).map((value) => ({
  value,
  src: MOOD_IMAGE_BY_VALUE[value]!,
}));
