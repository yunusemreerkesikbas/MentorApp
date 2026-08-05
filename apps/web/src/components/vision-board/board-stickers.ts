import { VISION_STICKERS, type VisionSticker } from "@mentor/types";

/**
 * What each built-in sticker actually draws.
 *
 * Two kinds on purpose. The career Puhus are the mascot art already shipped under
 * `public/mascot/career/` — same-origin PNGs, so the canvas exporter can draw them without CORS.
 * The five shapes are SVG path data rather than files: a star does not need a network request, it
 * scales for free, and `new Path2D(d)` lets the exporter draw the exact same outline the DOM shows.
 */

export type StickerArt =
  | { kind: "image"; src: string }
  | { kind: "path"; path: string; fill: string };

/** Paths are authored in a 0..100 box so both renderers can scale them the same way. */
const SHAPES: Record<string, { path: string; fill: string }> = {
  STAR: {
    path: "M50 4 L62 36 L96 38 L69 59 L79 93 L50 73 L21 93 L31 59 L4 38 L38 36 Z",
    fill: "var(--color-star)",
  },
  HEART: {
    path: "M50 88 C14 62 6 42 18 26 C29 12 45 16 50 30 C55 16 71 12 82 26 C94 42 86 62 50 88 Z",
    fill: "var(--color-streak)",
  },
  SPARKLE: {
    path: "M50 2 C56 34 66 44 98 50 C66 56 56 66 50 98 C44 66 34 56 2 50 C34 44 44 34 50 2 Z",
    fill: "var(--color-chip)",
  },
  ARROW: {
    path: "M10 56 L62 56 L62 82 L96 50 L62 18 L62 44 L10 44 Z",
    fill: "var(--color-accent)",
  },
  PIN: {
    path: "M50 6 C33 6 20 19 20 36 C20 58 50 94 50 94 C50 94 80 58 80 36 C80 19 67 6 50 6 Z M50 48 C43 48 38 43 38 36 C38 29 43 24 50 24 C57 24 62 29 62 36 C62 43 57 48 50 48 Z",
    fill: "var(--color-danger)",
  },
};

function artFor(sticker: VisionSticker): StickerArt {
  const shape = SHAPES[sticker];
  if (shape) return { kind: "path", ...shape };
  // MASCOT_YAZILIM → /mascot/career/yazilim.png — the enum mirrors CAREER_GROUPS by construction.
  return {
    kind: "image",
    src: `/mascot/career/${sticker.replace(/^MASCOT_/, "").toLowerCase()}.png`,
  };
}

export const STICKER_ART: Record<VisionSticker, StickerArt> = Object.fromEntries(
  VISION_STICKERS.map((sticker) => [sticker, artFor(sticker)]),
) as Record<VisionSticker, StickerArt>;
