import {
  VISION_BOARD_CANVAS,
  type VisionBoardDoc,
  type VisionBoardFrame,
  type VisionBoardImageItem,
  type VisionBoardItem,
  type VisionBoardTextItem,
} from "@mentor/types";
import { appFontFamily } from "@/lib/app-font";
import { FONT_FAMILIES } from "./board-font-families";
import {
  BOARD_FRAME_MAT,
  BOARD_WALLPAPER,
  GALLERY_MOULDING,
  WOOD_GRAIN,
  alignAnchorX,
  boardImageSrc,
  canvasTextAlign,
  coverRect,
  cssGradientLine,
  frameHasPlate,
  frameInsets,
  framedBoardLayout,
  needsCrossOrigin,
  textBlockTop,
  wallpaperLayout,
  wrapText,
  type FramedBoardLayout,
} from "./board-export-layout";
import { STICKER_ART } from "./board-stickers";

export { FONT_FAMILIES } from "./board-font-families";

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
    image.referrerPolicy = "no-referrer";
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

export class BoardExportMediaUnavailableError extends Error {
  constructor() { super("board_export_media_unavailable"); this.name="BoardExportMediaUnavailableError"; }
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

function drawTextItem(ctx: CanvasRenderingContext2D, item: VisionBoardTextItem): void {
  const { width, height } = item;
  const weight = item.bold ? 700 : 400;
  const style = item.italic ? "italic" : "normal";
  const family = item.font === "body" ? appFontFamily() : FONT_FAMILIES[item.font];
  ctx.font = `${style} ${weight} ${item.size}px ${family}`;
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
    if (!image) throw new BoardExportMediaUnavailableError();
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

/** The board's own frame: the moulding, then the mat over it. Drawn at the origin, in board units. */
function paintFrame(
  ctx: CanvasRenderingContext2D,
  frame: VisionBoardFrame,
  layout: FramedBoardLayout,
): void {
  if (frame === "none") return;
  const { width, height, border, radius } = layout;

  if (frame === "wood") {
    const line = cssGradientLine(width, height, WOOD_GRAIN.angle);
    const grain = ctx.createLinearGradient(line.x0, line.y0, line.x1, line.y1);
    for (const [at, color] of WOOD_GRAIN.stops) grain.addColorStop(at, color);
    ctx.fillStyle = grain;
  } else {
    ctx.fillStyle = GALLERY_MOULDING;
  }
  roundedPath(ctx, 0, 0, width, height, radius);
  ctx.fill();

  ctx.fillStyle = BOARD_FRAME_MAT[frame];
  roundedPath(ctx, border, border, width - 2 * border, height - 2 * border, radius / 2);
  ctx.fill();
}

/** The framed board, at the origin and in board units: frame first, then the board inside it. */
async function paintFramedBoard(
  ctx: CanvasRenderingContext2D,
  doc: VisionBoardDoc,
  layout: FramedBoardLayout,
): Promise<void> {
  paintFrame(ctx, doc.frame, layout);

  const inset = layout.border + layout.mat;
  ctx.save();
  ctx.translate(inset, inset);
  // The stage hides whatever hangs over its edge. A bare canvas did the same at its own edge;
  // inside a frame that edge has to be drawn.
  ctx.beginPath();
  ctx.rect(0, 0, VISION_BOARD_CANVAS.width, VISION_BOARD_CANVAS.height);
  ctx.clip();
  paintBackground(ctx, doc);
  for (const item of [...doc.items].sort((a, b) => a.z - b.z)) {
    await drawItem(ctx, item);
  }
  ctx.restore();
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("board_export_no_context");
  return { canvas, ctx };
}

/**
 * Web fonts load asynchronously; measuring before they land wraps the text against a fallback
 * face and the picture comes out laid out differently from the screen.
 */
async function fontsReady(): Promise<void> {
  if (typeof document !== "undefined" && document.fonts?.ready) await document.fonts.ready;
}

type PictureType = "image/png" | "image/jpeg";

/** Light enough for a photo-heavy board to stay well under a forum's limit, with no visible loss. */
const JPEG_QUALITY = 0.9;

/**
 * Throws {@link BoardExportTaintedError} when the canvas cannot be read back — that happens when a
 * board photo was served without CORS headers, and it is deliberately loud: silently returning a
 * blank image would look like a bug in the user's board rather than a storage misconfiguration.
 */
function canvasToBlob(canvas: HTMLCanvasElement, type: PictureType = "image/png"): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("board_export_failed"));
        },
        type,
        JPEG_QUALITY,
      );
    } catch {
      reject(new BoardExportTaintedError());
    }
  });
}

export interface BoardRenderOptions {
  /**
   * PNG keeps the frame's rounded corners transparent. JPEG is for a place that caps a picture's
   * weight (a community post); it has no transparency, so the corners sit on white.
   */
  type?: PictureType;
  /** Pixels per canvas unit. 2 by default: sharp on retina, still a sane file for sharing. */
  scale?: number;
}

/** The board as a picture, in the frame it wears on screen. */
export async function renderBoardToBlob(
  doc: VisionBoardDoc,
  { type = "image/png", scale = EXPORT_SCALE }: BoardRenderOptions = {},
): Promise<Blob> {
  const layout = framedBoardLayout(doc.frame);
  const { canvas, ctx } = createCanvas(layout.width * scale, layout.height * scale);
  ctx.scale(scale, scale);
  await fontsReady();
  if (type === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, layout.width, layout.height);
  }
  await paintFramedBoard(ctx, doc, layout);
  return canvasToBlob(canvas, type);
}

/**
 * The board as a JPEG no heavier than `maxBytes`, for a place that caps a picture's weight: the
 * full picture when it fits, else one drawn at half the pixels (a quarter of the weight).
 * `render` is the board's own renderer unless a test hands in another.
 * ponytail: one fallback step. Add a quality ladder if a board ever outgrows the half-size picture too.
 */
export async function renderBoardWithinBytes(
  doc: VisionBoardDoc,
  maxBytes: number,
  render: (doc: VisionBoardDoc, options?: BoardRenderOptions) => Promise<Blob> = renderBoardToBlob,
): Promise<Blob> {
  const full = await render(doc, { type: "image/jpeg" });
  if (full.size <= maxBytes) return full;
  return render(doc, { type: "image/jpeg", scale: 1 });
}

/** The wall a wallpaper hangs the board on: the editor's light wall. A picture is not themed. */
const WALL = "#f0edec";

/**
 * The board as a phone wallpaper: hung on the wall from a nail, clear of a lock screen's clock.
 * Everything is placed by `wallpaperLayout`; this only paints.
 */
export async function renderBoardWallpaperBlob(doc: VisionBoardDoc): Promise<Blob> {
  const { width, height } = BOARD_WALLPAPER;
  const { canvas, ctx } = createCanvas(width, height);
  await fontsReady();
  const hang = wallpaperLayout(doc.frame);

  ctx.fillStyle = WALL;
  ctx.fillRect(0, 0, width, height);
  // Light from above, falling off before the board: an ellipse wider than the wall is tall.
  const reach = height * 0.45;
  ctx.save();
  ctx.translate(width / 2, 0);
  ctx.scale((width * 1.1) / reach, 1);
  const light = ctx.createRadialGradient(0, 0, 0, 0, 0, reach);
  light.addColorStop(0, "rgba(255, 255, 255, 0.75)");
  light.addColorStop(0.7, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = light;
  ctx.fillRect(-reach, 0, reach * 2, reach);
  ctx.restore();

  // The cord runs behind the board, so it ends a little way inside the top edge.
  const cordEndY = hang.y + hang.height * 0.02;
  ctx.strokeStyle = "#8a6a45";
  ctx.lineWidth = width * 0.004;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(hang.cordLeftX, cordEndY);
  ctx.lineTo(hang.nail.x, hang.nail.y);
  ctx.lineTo(hang.cordRightX, cordEndY);
  ctx.stroke();
  ctx.fillStyle = "#9a7440";
  ctx.beginPath();
  ctx.arc(hang.nail.x, hang.nail.y, width * 0.0115, 0, Math.PI * 2);
  ctx.fill();

  // The shadow the board throws on the wall. The rect that casts it is painted over next.
  ctx.save();
  ctx.shadowColor = "rgba(37, 73, 150, 0.24)";
  ctx.shadowBlur = hang.width * 0.084;
  ctx.shadowOffsetY = hang.width * 0.048;
  ctx.fillStyle = WALL;
  ctx.fillRect(hang.x, hang.y, hang.width, hang.height);
  ctx.restore();

  ctx.save();
  ctx.translate(hang.x, hang.y);
  ctx.scale(hang.scale, hang.scale);
  await paintFramedBoard(ctx, doc, hang.framed);
  ctx.restore();

  return canvasToBlob(canvas);
}

/**
 * Whether this browser can hand an image file to the system share sheet.
 * ponytail: the same probe as `session-share-sheet.tsx`; give them one helper when a third image share appears.
 */
export function canShareImageFile(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [new File([""], "board.png", { type: "image/png" })] });
  } catch {
    return false;
  }
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
