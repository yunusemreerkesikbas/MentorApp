import {
  VISION_BOARD_CANVAS,
  type VisionBoardDoc,
  type VisionBoardImageItem,
  type VisionBoardItem,
  type VisionBoardTextItem,
} from "@mentor/types";
import {
  alignAnchorX,
  boardImageSrc,
  canvasTextAlign,
  coverRect,
  frameHasPlate,
  frameInsets,
  needsCrossOrigin,
  textBlockTop,
  wrapText,
} from "./board-export-layout";
import { STICKER_ART } from "./board-stickers";

/**
 * Renders a board document to a PNG, by hand, with the Canvas 2D API.
 *
 * No html2canvas, no server round-trip: the document is a flat list of rectangles with block-level
 * styling, which is exactly what `drawImage`/`fillText` already do. That is only true because the
 * text model is per block rather than per character — keep it that way or this file grows into a
 * text engine.
 *
 * Geometry, wrapping and frame insets come from `board-export-layout.ts`, shared with the DOM
 * renderer so the two cannot drift apart unnoticed.
 */

/** 2× the design canvas: sharp on retina, still a sane PNG for sharing. */
const EXPORT_SCALE = 2;

/** Resolved from CSS custom properties at export time so stickers match the live theme. */
function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function loadImage(src: string, crossOrigin: boolean): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    // Same-origin assets must NOT set crossOrigin: it turns a plain load into a CORS request the
    // dev server has no reason to answer.
    if (crossOrigin) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    // A photo that will not load is skipped, not fatal: one missing picture beats no download.
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

export class BoardExportTaintedError extends Error {
  constructor() {
    super("board_export_tainted");
    this.name = "BoardExportTaintedError";
  }
}

function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/** Board backgrounds, redrawn rather than screenshotted — see `BACKGROUNDS` in board-stage.tsx. */
function paintBackground(ctx: CanvasRenderingContext2D, doc: VisionBoardDoc): void {
  const { width, height } = VISION_BOARD_CANVAS;
  if (doc.background.kind === "color") {
    ctx.fillStyle = doc.background.value;
    ctx.fillRect(0, 0, width, height);
    return;
  }
  const texture = doc.background.value;
  const base = {
    cork: "#d8b083",
    paper: "#faf7f2",
    grid: "#ffffff",
    linen: "#f2efe9",
    dots: "#f5f6fb",
    stripes: "#fdf6f0",
  }[texture];
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  if (texture === "cork") {
    ctx.fillStyle = "rgba(120, 82, 47, 0.35)";
    for (let y = 0; y < height; y += 7) {
      for (let x = 0; x < width; x += 7) ctx.fillRect(x, y, 1.4, 1.4);
    }
  } else if (texture === "paper") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.045)";
    for (let y = 0; y < height; y += 5) {
      for (let x = 0; x < width; x += 5) ctx.fillRect(x, y, 1.2, 1.2);
    }
  } else if (texture === "grid") {
    ctx.strokeStyle = "rgba(17, 17, 17, 0.07)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  } else if (texture === "linen") {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.03)";
    ctx.lineWidth = 2;
    for (let i = -height; i < width; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + height, height);
      ctx.stroke();
    }
  } else if (texture === "dots") {
    ctx.fillStyle = "rgba(85, 172, 238, 0.28)";
    for (let y = 0; y < height; y += 24) {
      for (let x = 0; x < width; x += 24) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    ctx.strokeStyle = "rgba(243, 112, 90, 0.14)";
    ctx.lineWidth = 6;
    for (let i = -height; i < width; i += 16) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + height, height);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawImageItem(
  ctx: CanvasRenderingContext2D,
  item: VisionBoardImageItem,
  image: HTMLImageElement | null,
): void {
  const insets = frameInsets(item.frame);
  const { width, height } = item;

  if (frameHasPlate(item.frame)) {
    ctx.save();
    ctx.shadowColor = "rgba(37, 73, 150, 0.22)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.restore();
  }

  const innerX = -width / 2 + insets.left;
  const innerY = -height / 2 + insets.top;
  const innerW = width - insets.left - insets.right;
  const innerH = height - insets.top - insets.bottom;

  if (image) {
    ctx.save();
    if (insets.radius > 0) {
      roundedPath(ctx, innerX, innerY, innerW, innerH, insets.radius);
      ctx.clip();
    }
    const { sx, sy, sw, sh } = coverRect(image.naturalWidth, image.naturalHeight, innerW, innerH);
    ctx.drawImage(image, sx, sy, sw, sh, innerX, innerY, innerW, innerH);
    ctx.restore();
  } else {
    // Placeholder rather than a hole, so a failed photo still reads as "a picture goes here".
    ctx.fillStyle = "#f0edec";
    ctx.fillRect(innerX, innerY, innerW, innerH);
  }

  if (item.frame === "tape") {
    ctx.save();
    ctx.translate(0, -height / 2);
    ctx.rotate((-4 * Math.PI) / 180);
    ctx.fillStyle = "rgba(255, 236, 179, 0.72)";
    ctx.fillRect(-60, -16, 120, 38);
    ctx.restore();
  }
}

export const FONT_FAMILIES: Record<VisionBoardTextItem["font"], string> = {
  body: '"Nunito Sans", sans-serif',
  heading: '"Poppins", sans-serif',
  script: '"Caveat", cursive',
  serif: '"Playfair Display", Georgia, serif',
  rounded: '"Baloo 2", sans-serif',
  condensed: '"Oswald", sans-serif',
  classic: '"Merriweather", serif',
};

function drawTextItem(ctx: CanvasRenderingContext2D, item: VisionBoardTextItem): void {
  const { width, height } = item;
  const weight = item.bold ? 700 : 400;
  const style = item.italic ? "italic" : "normal";
  ctx.font = `${style} ${weight} ${item.size}px ${FONT_FAMILIES[item.font]}`;
  ctx.textAlign = canvasTextAlign(item.align);
  ctx.textBaseline = "middle";
  if ("letterSpacing" in ctx) {
    // Chromium/Firefox honour this; where it is missing the block just renders untracked rather
    // than failing the whole export.
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      `${item.letterSpacing}px`;
  }

  const lineHeightPx = item.size * item.lineHeight;
  const padding = item.background?.padding ?? 0;
  const maxWidth = Math.max(1, width - padding * 2);
  const lines = wrapText(item.text, maxWidth, (line) => ctx.measureText(line).width);
  const top = textBlockTop(height, lines.length, lineHeightPx);

  if (item.background) {
    const blockWidth = Math.min(
      width,
      Math.max(...lines.map((line) => ctx.measureText(line).width)) + padding * 2,
    );
    const blockHeight = lines.length * lineHeightPx + padding * 2;
    const anchor = alignAnchorX(item.align, width) - width / 2;
    const plateX =
      item.align === "left"
        ? anchor
        : item.align === "right"
          ? anchor - blockWidth
          : anchor - blockWidth / 2;
    ctx.save();
    ctx.globalAlpha *= item.background.opacity;
    ctx.fillStyle = item.background.color;
    roundedPath(
      ctx,
      plateX,
      top - height / 2 - padding,
      blockWidth,
      blockHeight,
      item.background.radius,
    );
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = item.color;
  const x = alignAnchorX(item.align, width) - width / 2;
  lines.forEach((line, index) => {
    const y = top - height / 2 + (index + 0.5) * lineHeightPx;
    ctx.fillText(line, x, y);
  });
}

async function drawItem(ctx: CanvasRenderingContext2D, item: VisionBoardItem): Promise<void> {
  ctx.save();
  ctx.translate(item.x + item.width / 2, item.y + item.height / 2);
  ctx.rotate((item.rotation * Math.PI) / 180);
  ctx.globalAlpha = item.opacity;

  if (item.kind === "image") {
    const image = item.url
      ? await loadImage(boardImageSrc(item.url), needsCrossOrigin(item.url))
      : null;
    drawImageItem(ctx, item, image);
  } else if (item.kind === "text") {
    drawTextItem(ctx, item);
  } else {
    const art = STICKER_ART[item.asset];
    if (art.kind === "image") {
      const image = await loadImage(art.src, false);
      if (image) {
        const { sx, sy, sw, sh } = coverRect(
          image.naturalWidth,
          image.naturalHeight,
          item.width,
          item.height,
        );
        ctx.drawImage(image, sx, sy, sw, sh, -item.width / 2, -item.height / 2, item.width, item.height);
      }
    } else {
      // Path data is authored in a 0..100 box, so scale it onto the item.
      ctx.scale(item.width / 100, item.height / 100);
      ctx.translate(-50, -50);
      ctx.fillStyle = cssVar(art.fill.replace(/^var\((--[^)]+)\)$/, "$1"), "#111111");
      ctx.fill(new Path2D(art.path), art.fillRule ?? "nonzero");
    }
  }
  ctx.restore();
}

/**
 * Draw the whole board and hand back a PNG blob.
 *
 * Throws {@link BoardExportTaintedError} when the canvas cannot be read back — that happens when a
 * board photo was served without CORS headers, and it is deliberately loud: silently returning a
 * blank image would look like a bug in the user's board rather than a storage misconfiguration.
 */
export async function renderBoardToBlob(doc: VisionBoardDoc): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = VISION_BOARD_CANVAS.width * EXPORT_SCALE;
  canvas.height = VISION_BOARD_CANVAS.height * EXPORT_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("board_export_no_context");
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE);

  // Web fonts load asynchronously; measuring before they land wraps the text against a fallback
  // face and the PNG comes out laid out differently from the screen.
  if (typeof document !== "undefined" && document.fonts?.ready) await document.fonts.ready;

  paintBackground(ctx, doc);
  for (const item of [...doc.items].sort((a, b) => a.z - b.z)) {
    await drawItem(ctx, item);
  }

  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("board_export_failed"));
      }, "image/png");
    } catch {
      reject(new BoardExportTaintedError());
    }
  });
}

/** Native share sheet when the platform has one, plain download when it does not. */
export async function shareOrDownloadBoard(blob: Blob, fileName: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], fileName, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (error) {
      // Dismissing the sheet is a normal outcome, not a failure to report.
      if (error instanceof DOMException && error.name === "AbortError") return "shared";
    }
  }
  downloadBlob(blob, fileName);
  return "downloaded";
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  // Revoking immediately can cancel the download in Safari; one tick is enough for the click.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
