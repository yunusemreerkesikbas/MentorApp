import type { VisionBoardTextItem, VisionImageFrame } from "@mentor/types";
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
