import { VISION_STICKERS, type VisionSticker } from "@mentor/types";

/**
 * What each built-in sticker actually draws.
 *
 * Two kinds on purpose. The Puhu images are mascot art already shipped under
 * `public/mascot/career/` and `public/mascot/puhu/` — same-origin PNGs, so the canvas exporter
 * can draw them without CORS. The shapes are SVG path data rather than files: a star does not
 * need a network request, it scales for free, and `new Path2D(d)` lets the exporter draw the
 * exact same outline the DOM shows.
 */

export type StickerArt =
  | { kind: "image"; src: string }
  | { kind: "path"; path: string; fill: string; fillRule?: "nonzero" | "evenodd" };

/** Paths are authored in a 0..100 box so both renderers can scale them the same way. */
const SHAPES: Record<
  string,
  { path: string; fill: string; fillRule?: "nonzero" | "evenodd" }
> = {
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
  // Bullseye: three concentric circles, `evenodd` alternates ring / gap / centre dot for free.
  TARGET: {
    path: "M98 50 A48 48 0 1 0 2 50 A48 48 0 1 0 98 50 Z M82 50 A32 32 0 1 0 18 50 A32 32 0 1 0 82 50 Z M66 50 A16 16 0 1 0 34 50 A16 16 0 1 0 66 50 Z",
    fill: "var(--color-danger)",
    fillRule: "evenodd",
  },
  FLAG: {
    path: "M20 6 L28 6 L28 96 L20 96 Z M28 12 L84 26 L28 42 Z",
    fill: "var(--color-accent)",
  },
  CHECK: {
    path: "M18 52 L38 72 L84 22 L74 12 L38 50 L28 40 Z",
    fill: "var(--color-success)",
  },
  TROPHY: {
    path: "M28 8 L72 8 L68 32 C68 46 58 56 50 56 C42 56 32 46 32 32 Z M46 56 L54 56 L54 66 L46 66 Z M30 66 L70 66 L76 80 L24 80 Z",
    fill: "var(--color-star)",
  },
  ROCKET: {
    path: "M50 4 C60 14 64 30 64 46 L64 66 L36 66 L36 46 C36 30 40 14 50 4 Z M36 58 L20 78 L36 70 Z M64 58 L80 78 L64 70 Z M42 66 L58 66 L50 92 Z",
    fill: "var(--color-streak)",
  },
  GRADCAP: {
    path: "M50 15 L92 35 L50 55 L8 35 Z M30 42 L70 42 L64 62 C64 68 36 68 36 62 Z",
    fill: "var(--color-main)",
  },
  CROWN: {
    path: "M15 55 L20 30 L35 55 L50 15 L65 55 L80 30 L85 55 L85 80 L15 80 Z",
    fill: "var(--color-chip)",
  },
  LIGHTNING: {
    path: "M58 4 L26 52 L46 52 L38 96 L76 42 L54 42 Z",
    fill: "var(--color-star)",
  },
};

/** Puhu's own expressions — distinct from the career mascots, which live under a different path. */
const PUHU_IMAGES: Partial<Record<VisionSticker, string>> = {
  PUHU_HAPPY: "/mascot/puhu/puhu-happy.png",
  PUHU_PROUD: "/mascot/puhu/puhu-proud.png",
  PUHU_ENCOURAGING: "/mascot/puhu/puhu-encouraging.png",
  PUHU_SURPRISED: "/mascot/puhu/puhu-surprised.png",
  PUHU_SLEEPY: "/mascot/puhu/puhu-sleepy.png",
};

/**
 * Stationery/paper stickers — each cut out (own transparent PNG) from a single Illustrator
 * collage that shipped as `public/img/sticker.svg` (see docs/features/coaching.md for how).
 */
const STATIONERY_IMAGES: Partial<Record<VisionSticker, string>> = {
  CARD_STACKED_RED: "/img/stickers/card_stacked_red.png",
  PAPER_LINED_TAN: "/img/stickers/paper_lined_tan.png",
  PAPER_GRID: "/img/stickers/paper_grid.png",
  CARD_PLAIN_BROWN: "/img/stickers/card_plain_brown.png",
  PAPER_LINED_VERTICAL: "/img/stickers/paper_lined_vertical.png",
  NOTEPAD_SPIRAL: "/img/stickers/notepad_spiral.png",
  CARD_BLANK_PINK: "/img/stickers/card_blank_pink.png",
  CARD_BLANK_LARGE: "/img/stickers/card_blank_large.png",
  TAPE_HATCHED: "/img/stickers/tape_hatched.png",
  TAPE_DIAGONAL: "/img/stickers/tape_diagonal.png",
  TAPE_STRIP_CREAM: "/img/stickers/tape_strip_cream.png",
  TAPE_STRIP_PLAIN: "/img/stickers/tape_strip_plain.png",
  TAPE_STRIP_TAN: "/img/stickers/tape_strip_tan.png",
  NOTEPAD_HOLES_FOLD: "/img/stickers/notepad_holes_fold.png",
  FABRIC_PLAID_PEACH: "/img/stickers/fabric_plaid_peach.png",
  NOTEPAD_LINED_RED: "/img/stickers/notepad_lined_red.png",
  FRAME_POLAROID: "/img/stickers/frame_polaroid.png",
  PAPER_DOTGRID_DARK: "/img/stickers/paper_dotgrid_dark.png",
  TAPE_CORAL: "/img/stickers/tape_coral.png",
  NOTEPAD_SPIRAL_SMALL: "/img/stickers/notepad_spiral_small.png",
  TAPE_CHECKERED: "/img/stickers/tape_checkered.png",
  CARD_ROUNDED_OLIVE: "/img/stickers/card_rounded_olive.png",
};

/**
 * Vision-board scene stickers — a second Illustrator collage (`public/img/sticker-2.svg`), several
 * combining a shape with its own baked-in text (e.g. "MY VISION BOARD"), cut out the same way as
 * `STATIONERY_IMAGES`.
 */
const SCENE_IMAGES: Partial<Record<VisionSticker, string>> = {
  STAR_OUTLINE_1: "/img/stickers/star_outline_1.png",
  STAR_OUTLINE_2: "/img/stickers/star_outline_2.png",
  SPARKLE_CROSS: "/img/stickers/sparkle_cross.png",
  SPARKLE_DASH: "/img/stickers/sparkle_dash.png",
  RAINBOW_SQUIGGLE: "/img/stickers/rainbow_squiggle.png",
  SCENE_DREAM_BIG: "/img/stickers/scene_dream_big.png",
  CARD_TRAVEL: "/img/stickers/card_travel.png",
  CARD_INSPIRATION: "/img/stickers/card_inspiration.png",
  CARD_GOALS: "/img/stickers/card_goals.png",
  CARD_VISION_BOARD: "/img/stickers/card_vision_board.png",
  HEART_LOVE: "/img/stickers/heart_love.png",
};

function artFor(sticker: VisionSticker): StickerArt {
  const shape = SHAPES[sticker];
  if (shape) return { kind: "path", ...shape };
  const puhu = PUHU_IMAGES[sticker];
  if (puhu) return { kind: "image", src: puhu };
  const stationery = STATIONERY_IMAGES[sticker];
  if (stationery) return { kind: "image", src: stationery };
  const scene = SCENE_IMAGES[sticker];
  if (scene) return { kind: "image", src: scene };
  // MASCOT_YAZILIM → /mascot/career/yazilim.png — the enum mirrors CAREER_GROUPS by construction.
  return {
    kind: "image",
    src: `/mascot/career/${sticker.replace(/^MASCOT_/, "").toLowerCase()}.png`,
  };
}

export const STICKER_ART: Record<VisionSticker, StickerArt> = Object.fromEntries(
  VISION_STICKERS.map((sticker) => [sticker, artFor(sticker)]),
) as Record<VisionSticker, StickerArt>;
