import type { StudyRoomTheme } from "@mentor/types";
import { appFontFamily } from "@/lib/app-font";
import { STUDY_ROOM_BACKDROP_SRC } from "@/lib/study-room-theme";

/** The shared PNG is a phone story frame. */
export const SESSION_SHARE_CARD_SIZE = { width: 1080, height: 1920 } as const;

/** How long the preview takes to put the card together (DESIGN.md §9.1); the PNG is its last frame. */
export const SESSION_SHARE_CARD_SECONDS = 2.6;

const HAND = '"Caveat Variable", "Segoe Print", cursive';
const PUHU_SRC = "/mascot/puhu/puhu-happy.png";

export interface SessionShareCardModel {
  theme: StudyRoomTheme;
  /** The print's handwritten line, e.g. "50 dk Matematik". */
  caption: string;
  /** e.g. "kütüphanede, öğleden sonra". */
  placeLine: string;
  /** e.g. "6 Ekim, Salı". */
  dateLabel: string;
  /** Star fill out of three, in 0.5 steps. */
  stars: number;
  /** The site's host under the wordmark. */
  siteLabel: string;
}

export interface SessionShareCardAssets {
  photo: HTMLImageElement | null;
  puhu: HTMLImageElement | null;
}

type Rgb = readonly [number, number, number];

interface RoomLook {
  from: string;
  to: string;
  glow: Rgb;
  glowAlpha: number;
  ink: string;
  inkSoft: string;
  drop: string;
  /** Horizontal crop of the room photo into the square print (0 = left edge). */
  focal: number;
}

/**
 * The `.room-stage[data-room-theme]` palettes from `packages/ui/src/theme.css`, fixed here because
 * a card that leaves the app does not follow the light/dark cookie (the stage's own rule).
 */
const ROOM: Record<StudyRoomTheme, RoomLook> = {
  LIBRARY: { from: "#3a2e23", to: "#241b14", glow: [255, 190, 110], glowAlpha: 0.3, ink: "#f7f0e4", inkSoft: "#cdb99f", drop: "rgba(0, 0, 0, 0.55)", focal: 0.16 },
  CAFE: { from: "#2a1f1a", to: "#171110", glow: [232, 168, 124], glowAlpha: 0.26, ink: "#f5ede6", inkSoft: "#c2ac9c", drop: "rgba(0, 0, 0, 0.6)", focal: 0.88 },
  HOME: { from: "#f3eff9", to: "#e3daf1", glow: [255, 255, 255], glowAlpha: 0.8, ink: "#2a2438", inkSoft: "#665c7c", drop: "rgba(60, 40, 90, 0.3)", focal: 0.1 },
};

// The notebook's taped print (`--notebook-*` in theme.css) and the done card's star.
const PRINT = "#ffffff";
const PRINT_UNDEVELOPED = "#d9dad4";
const PRINT_INK = "#26304a";
const PRINT_CAPTION = "#6f6656";
const TAPE = "rgba(236, 214, 170, 0.78)";
const STAR_GOLD = "#ffc700";
const STAR_EMPTY = "#ece7df";

/** Beats in seconds: the approved canvas loop, played once (DESIGN.md §9.1, "Seans paylaşım kartı"). */
const BEAT = {
  date: [0.12, 0.54],
  drop: [0, 0.6],
  develop: [0.42, 1.8],
  tapeLeft: [0.48, 0.78],
  tapeRight: [0.6, 0.9],
  line1: [0.96, 1.62],
  line2: [1.44, 1.98],
  puhu: [1.98, 2.4],
  foot: [2.22, 2.58],
} as const;
const STARS_AT = 1.62;
const STAR_POP = 0.42;
const STAR_STEP = 0.14;

/** Sticker stars under the print, by centre: left, centre (largest, lands last), right. */
const STARS = [
  { x: 210, y: 1458, size: 120, rot: -12, step: 0 },
  { x: 343, y: 1443, size: 150, rot: 5, step: 2 },
  { x: 474, y: 1456, size: 120, rot: 15, step: 1 },
] as const;

const STAR_POINTS = [
  [50, 6], [63.52, 33.39], [93.75, 37.79], [71.87, 59.11], [77.04, 89.21],
  [50, 75], [22.96, 89.21], [28.13, 59.11], [6.25, 37.79], [36.48, 33.39],
] as const;

/** Torn ends of a strip of masking tape, as fractions of its box. */
const TAPE_EDGE = [
  [0, 0.1], [0.04, 0], [0.96, 0.04], [1, 0.14], [0.98, 0.34], [1, 0.52], [0.97, 0.72],
  [1, 0.9], [0.95, 1], [0.05, 0.96], [0, 0.86], [0.03, 0.66], [0, 0.48], [0.03, 0.28],
] as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const span = (t: number, from: number, to: number) => clamp01((t - from) / (to - from));
const easeOut = (p: number) => 1 - (1 - p) ** 4;
const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
const rad = (deg: number) => (deg * Math.PI) / 180;
const rgba = ([r, g, b]: Rgb, alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`;

/**
 * Draws the card as it stands `seconds` into its entrance, in the card's own 1080×1920 space
 * (the preview scales the context first; the PNG does not). The default is the finished card.
 */
export function drawSessionShareCard(
  ctx: CanvasRenderingContext2D,
  model: SessionShareCardModel,
  assets: SessionShareCardAssets,
  seconds = Number.POSITIVE_INFINITY,
): void {
  const room = ROOM[model.theme];
  const { width, height } = SESSION_SHARE_CARD_SIZE;
  const sans = appFontFamily();
  // Shadow blur and offset ignore the transform; scale them with the preview by hand.
  const base = ctx.getTransform();
  const k = Math.hypot(base.a, base.b) || 1;
  const t = seconds;

  const ground = ctx.createLinearGradient(0, 0, 0, height);
  ground.addColorStop(0, room.from);
  ground.addColorStop(1, room.to);
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, width, height);
  const lamp = ctx.createRadialGradient(540, 730, 0, 540, 730, 820);
  lamp.addColorStop(0, rgba(room.glow, room.glowAlpha));
  lamp.addColorStop(1, rgba(room.glow, 0));
  ctx.fillStyle = lamp;
  ctx.fillRect(0, 0, width, height);

  const date = easeOut(span(t, ...BEAT.date));
  ctx.globalAlpha = date;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = room.ink;
  ctx.font = `700 72px ${HAND}`;
  ctx.fillText(model.dateLabel, 540, 250 - 16 * (1 - date), 900);
  ctx.globalAlpha = 1;

  drawPrint(ctx, model, assets, room, t, k);
  STARS.forEach((star, index) => drawStar(ctx, star, starFill(model.stars, index), t, k));
  drawPuhu(ctx, assets.puhu, t, k);

  const foot = easeOut(span(t, ...BEAT.foot));
  ctx.globalAlpha = foot;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = room.ink;
  ctx.font = `900 60px ${sans}`;
  ctx.fillText("Mentor", 540, 1606 + 16 * (1 - foot));
  ctx.fillStyle = room.inkSoft;
  ctx.font = `700 32px ${sans}`;
  ctx.fillText(model.siteLabel, 540, 1676 + 16 * (1 - foot), 900);
  ctx.globalAlpha = 1;
}

/** Loads what the card draws with: the handwriting face, the room photo and Puhu's sticker. */
export async function loadSessionShareCardAssets(
  theme: StudyRoomTheme,
): Promise<SessionShareCardAssets> {
  const fonts = typeof document === "undefined" ? undefined : document.fonts;
  if (fonts) {
    await Promise.all([fonts.load(`700 72px ${HAND}`), fonts.load(`500 58px ${HAND}`)]).catch(
      () => undefined,
    );
    await fonts.ready;
  }
  const [photo, puhu] = await Promise.all([
    loadImage(STUDY_ROOM_BACKDROP_SRC[theme]),
    loadImage(PUHU_SRC),
  ]);
  return { photo, puhu };
}

/** The finished card as the PNG that gets shared. */
export function renderSessionShareCardPng(
  model: SessionShareCardModel,
  assets: SessionShareCardAssets,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = SESSION_SHARE_CARD_SIZE.width;
  canvas.height = SESSION_SHARE_CARD_SIZE.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas 2D context is unavailable"));
  drawSessionShareCard(ctx, model, assets);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Share card could not be encoded"));
    }, "image/png");
  });
}

function drawPrint(
  ctx: CanvasRenderingContext2D,
  model: SessionShareCardModel,
  assets: SessionShareCardAssets,
  room: RoomLook,
  t: number,
  k: number,
): void {
  const drop = easeOut(span(t, ...BEAT.drop));
  if (drop <= 0) return;
  ctx.save();
  // Dropped onto the table: it falls in tilted and settles at -2.5°. Local space is centred on it.
  ctx.globalAlpha = drop;
  ctx.translate(540, 835 - 110 * (1 - drop));
  ctx.rotate(rad(-10 + 7.5 * drop));
  const scale = 1.05 - 0.05 * drop;
  ctx.scale(scale, scale);

  ctx.save();
  ctx.shadowColor = room.drop;
  ctx.shadowBlur = 60 * k;
  ctx.shadowOffsetY = 34 * k;
  ctx.fillStyle = PRINT;
  ctx.fillRect(-380, -485, 760, 970);
  ctx.restore();

  ctx.fillStyle = PRINT_UNDEVELOPED;
  ctx.fillRect(-340, -445, 680, 680);
  if (assets.photo) drawCover(ctx, assets.photo, -340, -445, 680, room.focal);
  // An instant print: the picture comes up out of a pale grey.
  const develop = easeOut(span(t, ...BEAT.develop));
  if (develop < 1) {
    ctx.globalAlpha = drop * 0.92 * (1 - develop);
    ctx.fillStyle = PRINT_UNDEVELOPED;
    ctx.fillRect(-340, -445, 680, 680);
    ctx.globalAlpha = drop;
  }

  // The caption sits in the 206px of paper under the photo, written in from the left.
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const lead = fitHand(ctx, model.caption, 700, 108, 64, 650);
  const place = fitHand(ctx, model.placeLine, 500, 58, 40, 650);
  const top = 253 + (206 - (lead * 1.08 + 4 + place * 1.1)) / 2;
  writeLine(ctx, model.caption, `700 ${lead}px ${HAND}`, PRINT_INK, top + (lead * 1.08) / 2, easeInOut(span(t, ...BEAT.line1)));
  writeLine(ctx, model.placeLine, `500 ${place}px ${HAND}`, PRINT_CAPTION, top + lead * 1.08 + 4 + (place * 1.1) / 2, easeInOut(span(t, ...BEAT.line2)));

  drawTape(ctx, -308, -479, 236, 68, -14, easeOut(span(t, ...BEAT.tapeLeft)), drop);
  drawTape(ctx, 310, -477, 220, 64, 12, easeOut(span(t, ...BEAT.tapeRight)), drop);
  ctx.restore();
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  side: number,
  focalX: number,
): void {
  const scale = Math.max(side / image.naturalWidth, side / image.naturalHeight);
  const sw = side / scale;
  const sh = side / scale;
  ctx.drawImage(image, (image.naturalWidth - sw) * focalX, (image.naturalHeight - sh) / 2, sw, sh, x, y, side, side);
}

function fitHand(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  max: number,
  min: number,
  width: number,
): number {
  let size = max;
  ctx.font = `${weight} ${size}px ${HAND}`;
  while (size > min && ctx.measureText(text).width > width) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${HAND}`;
  }
  return size;
}

function writeLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
  color: string,
  y: number,
  progress: number,
): void {
  if (progress <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-340, y - 120, 700 * progress, 240);
  ctx.clip();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.fillText(text, -330, y, 660);
  ctx.restore();
}

function drawTape(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  height: number,
  deg: number,
  progress: number,
  alpha: number,
): void {
  if (progress <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha * progress;
  ctx.translate(cx, cy);
  ctx.rotate(rad(deg));
  const scale = 1.35 - 0.35 * progress;
  ctx.scale(scale, scale);
  ctx.beginPath();
  TAPE_EDGE.forEach(([u, v], index) => {
    const x = (u - 0.5) * width;
    const y = (v - 0.5) * height;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = TAPE;
  ctx.fill();
  ctx.restore();
}

function starFill(stars: number, index: number): number {
  return clamp01(Math.round(stars * 2) / 2 - index);
}

function starPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  STAR_POINTS.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x - 50, y - 50);
    else ctx.lineTo(x - 50, y - 50);
  });
  ctx.closePath();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  star: (typeof STARS)[number],
  fill: number,
  t: number,
  k: number,
): void {
  const from = STARS_AT + star.step * STAR_STEP;
  const p = span(t, from, from + STAR_POP);
  if (p <= 0) return;
  // The done card's pop: up to 1.18 with a small turn, then settle (DESIGN.md §9.1).
  const rise = p < 0.57 ? easeOut(p / 0.57) : 1;
  const settle = p < 0.57 ? 0 : easeOut((p - 0.57) / 0.43);
  const scale = (rise * 1.18 - 0.18 * settle) * (star.size / 100);
  ctx.save();
  ctx.globalAlpha = clamp01(p / 0.3);
  ctx.translate(star.x, star.y);
  ctx.rotate(rad(star.rot - 35 + 41 * rise - 6 * settle));
  ctx.scale(scale, scale);

  // A sticker: white edge with its shadow, the paper, then the gold up to the fill.
  starPath(ctx);
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 10 * k;
  ctx.shadowOffsetY = 10 * k;
  ctx.lineJoin = "round";
  ctx.lineWidth = 11;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = STAR_EMPTY;
  ctx.fill();
  if (fill > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-50, -50, 100 * fill, 100);
    ctx.clip();
    starPath(ctx);
    ctx.fillStyle = STAR_GOLD;
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.ellipse(-13, -14, 8, 4.5, rad(-34), 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.fill();
  ctx.restore();
}

function drawPuhu(
  ctx: CanvasRenderingContext2D,
  puhu: HTMLImageElement | null,
  t: number,
  k: number,
): void {
  if (!puhu) return;
  const p = easeOut(span(t, ...BEAT.puhu));
  if (p <= 0) return;
  // Stuck over the print's lower right corner, coming up from below it.
  const width = 290;
  const height = (width * puhu.naturalHeight) / puhu.naturalWidth;
  ctx.save();
  ctx.globalAlpha = p;
  ctx.translate(700 + width / 2, 1272 + height / 2 + 90 * (1 - p));
  ctx.rotate(rad(8 + 10 * (1 - p)));
  ctx.shadowColor = "rgba(0, 0, 0, 0.32)";
  ctx.shadowBlur = 16 * k;
  ctx.shadowOffsetY = 14 * k;
  ctx.drawImage(puhu, -width / 2, -height / 2, width, height);
  ctx.restore();
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}
