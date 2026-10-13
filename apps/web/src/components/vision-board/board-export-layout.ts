import {
  VISION_BOARD_CANVAS,
  type VisionBoardFrame,
  type VisionBoardTextItem,
  type VisionImageFrame,
} from "@mentor/types";
import { resolveApiUrl } from "@/lib/api-base";

/**
 * Layout maths shared by the DOM stage and the canvas exporter.
 *
 * Pure and separately tested because this is where the two renderers can silently disagree: if
 * wrapping or frame insets drift, the PNG stops matching what the user arranged, and nobody finds
 * out until they download it.
 */

/**
 * Board photo `url` → something an `<img>` can load.
 *
 * `resolveApiUrl` only recognises http(s) and prefixes everything else with the API base, which
 * silently mangles the `blob:` previews a just-uploaded photo renders from. Those are already
 * absolute and same-origin, so they pass through untouched — and that is also what keeps a canvas
 * export taken before the next reload untainted.
 */
export function boardImageSrc(url: string): string {
  return url.startsWith("blob:") || url.startsWith("data:") ? url : resolveApiUrl(url);
}

/** True when the browser must be told to make a CORS request to read these pixels back. */
export function needsCrossOrigin(url: string): boolean {
  return !url.startsWith("blob:") && !url.startsWith("data:");
}

/**
 * The board's own frame, as shares of the framed board's whole width: the moulding, the mat
 * inside it and the corner radius. One table for both renderers: `BoardFrame` writes a share as
 * `cqw`, the exporter multiplies it out, so the PNG's frame is the one on screen.
 */
export const BOARD_FRAME_METRICS: Record<
  VisionBoardFrame,
  { border: number; mat: number; radius: number }
> = {
  wood: { border: 0.022, mat: 0.026, radius: 0.005 },
  // The DOM rounds the gallery frame by the card radius, a fixed 10px; this is that corner on a
  // board drawn at desk size.
  gallery: { border: 0.006, mat: 0.034, radius: 0.008 },
  none: { border: 0, mat: 0, radius: 0 },
};

/**
 * The wood moulding: alternating stops of one hue read as grain at a glance; a photographic wood
 * texture scaled down to a 20px moulding just looks like noise.
 */
export const WOOD_GRAIN = {
  angle: 100,
  stops: [
    [0, "#c99a5f"],
    [0.18, "#e0b782"],
    [0.42, "#c08a4c"],
    [0.68, "#dcb17c"],
    [1, "#b8813f"],
  ],
} as const;

export const BOARD_FRAME_MAT = { wood: "#fbfaf8", gallery: "#ffffff" } as const;

/** The gallery moulding as a picture has to paint it: the DOM's 12% ink over a white wall, made opaque. */
export const GALLERY_MOULDING = "#e2e2e2";

export interface FramedBoardLayout {
  /** The whole framed board, in the board's own canvas units. */
  width: number;
  height: number;
  border: number;
  mat: number;
  radius: number;
}

/** The box a frame adds around a board, with the board's own size left exactly as it was. */
export function framedBoardLayout(
  frame: VisionBoardFrame,
  boardWidth: number = VISION_BOARD_CANVAS.width,
  boardHeight: number = VISION_BOARD_CANVAS.height,
): FramedBoardLayout {
  const metrics = BOARD_FRAME_METRICS[frame];
  // The shares are of the outer width, so the outer width is what the board's is divided up to.
  const width = boardWidth / (1 - 2 * (metrics.border + metrics.mat));
  const border = width * metrics.border;
  const mat = width * metrics.mat;
  return {
    width,
    height: boardHeight + 2 * (border + mat),
    border,
    mat,
    radius: width * metrics.radius,
  };
}

/**
 * A CSS `linear-gradient(<angle>deg, …)` across a box, as the two end points a canvas gradient
 * wants. CSS measures the angle clockwise from "to top" and stretches the line until its ends
 * reach the box's far corners; canvas has to be told both of those.
 */
export function cssGradientLine(
  width: number,
  height: number,
  angleDeg: number,
): { x0: number; y0: number; x1: number; y1: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
  return {
    x0: width / 2 - dx * half,
    y0: height / 2 - dy * half,
    x1: width / 2 + dx * half,
    y1: height / 2 + dy * half,
  };
}

/**
 * The phone wallpaper: 9:19.5, a tall modern screen. On a 9:16 phone only wall is cropped away,
 * top and bottom; a 9:16 picture on a tall phone would lose the board's sides instead.
 */
export const BOARD_WALLPAPER = { width: 1170, height: 2532 } as const;

/** How wide the framed board hangs, as a share of the wallpaper's width. */
const WALLPAPER_BOARD_WIDTH = 0.856;
/** Where its top edge sits, as a share of the height: under a lock screen's clock. */
const WALLPAPER_BOARD_TOP = 0.38;
/** How far above the board the nail is, as a share of the height. */
const WALLPAPER_NAIL_RISE = 0.07;
/** Where the cord meets the board's top edge, in from each side, as a share of its width. */
const WALLPAPER_CORD_INSET = 0.19;

/** Where the framed board, its nail and its cord go on the wallpaper. */
export function wallpaperLayout(frame: VisionBoardFrame) {
  const framed = framedBoardLayout(frame);
  const width = BOARD_WALLPAPER.width * WALLPAPER_BOARD_WIDTH;
  const scale = width / framed.width;
  const x = (BOARD_WALLPAPER.width - width) / 2;
  const y = BOARD_WALLPAPER.height * WALLPAPER_BOARD_TOP;
  return {
    framed,
    x,
    y,
    width,
    height: framed.height * scale,
    /** Framed-board units → wallpaper pixels. */
    scale,
    nail: { x: BOARD_WALLPAPER.width / 2, y: y - BOARD_WALLPAPER.height * WALLPAPER_NAIL_RISE },
    cordLeftX: x + width * WALLPAPER_CORD_INSET,
    cordRightX: x + width * (1 - WALLPAPER_CORD_INSET),
  };
}

/** Inner insets a frame preset eats out of the item box, in canvas units. */
export interface FrameInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
  radius: number;
}

export function frameInsets(frame: VisionImageFrame): FrameInsets {
  switch (frame) {
    // Mirrors `frameStyle()` in board-item-view.tsx — change both together.
    case "polaroid":
      return { top: 14, right: 14, bottom: 52, left: 14, radius: 0 };
    case "white":
      return { top: 12, right: 12, bottom: 12, left: 12, radius: 0 };
    case "rounded":
      return { top: 0, right: 0, bottom: 0, left: 0, radius: 28 };
    case "tape":
    case "none":
    default:
      return { top: 0, right: 0, bottom: 0, left: 0, radius: 0 };
  }
}

/** True when the preset paints a card behind the photo (and so needs a filled rect drawn first). */
export function frameHasPlate(frame: VisionImageFrame): boolean {
  return frame === "polaroid" || frame === "white";
}

/**
 * `object-fit: cover` as source-rectangle maths: fill the box, crop the overflowing axis evenly.
 * Canvas has no equivalent, so the DOM's behaviour has to be reproduced by hand.
 */
export function coverRect(
  sourceWidth: number,
  sourceHeight: number,
  boxWidth: number,
  boxHeight: number,
): { sx: number; sy: number; sw: number; sh: number } {
  if (sourceWidth <= 0 || sourceHeight <= 0 || boxWidth <= 0 || boxHeight <= 0) {
    return { sx: 0, sy: 0, sw: Math.max(sourceWidth, 0), sh: Math.max(sourceHeight, 0) };
  }
  const sourceRatio = sourceWidth / sourceHeight;
  const boxRatio = boxWidth / boxHeight;
  if (sourceRatio > boxRatio) {
    // Too wide: keep full height, crop the sides.
    const sw = sourceHeight * boxRatio;
    return { sx: (sourceWidth - sw) / 2, sy: 0, sw, sh: sourceHeight };
  }
  const sh = sourceWidth / boxRatio;
  return { sx: 0, sy: (sourceHeight - sh) / 2, sw: sourceWidth, sh };
}

/**
 * Greedy word wrap, with a per-character fallback for a single word longer than the line — the same
 * outcome as the DOM's `word-break: break-word`. `measure` is injected so this stays testable
 * without a canvas.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (line: string) => number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(" ")) {
      const candidate = line === "" ? word : `${line} ${word}`;
      if (measure(candidate) <= maxWidth || line === "") {
        // A single over-long word still has to be broken, or it would overflow the box silently.
        if (line === "" && measure(word) > maxWidth) {
          let chunk = "";
          for (const char of word) {
            if (chunk !== "" && measure(chunk + char) > maxWidth) {
              lines.push(chunk);
              chunk = char;
            } else {
              chunk += char;
            }
          }
          line = chunk;
          continue;
        }
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Where a wrapped block starts vertically, so the text sits centred like the flexbox does. */
export function textBlockTop(
  boxHeight: number,
  lineCount: number,
  lineHeightPx: number,
): number {
  return (boxHeight - lineCount * lineHeightPx) / 2;
}

/** x of a line's anchor point for the given alignment, relative to the box. */
export function alignAnchorX(align: VisionBoardTextItem["align"], boxWidth: number): number {
  if (align === "left") return 0;
  if (align === "right") return boxWidth;
  return boxWidth / 2;
}

export function canvasTextAlign(
  align: VisionBoardTextItem["align"],
): CanvasTextAlign {
  return align === "left" ? "left" : align === "right" ? "right" : "center";
}
