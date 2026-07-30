import type { WeeklyRecapShareCardModel } from "./weekly-recap";
import { WEEKLY_RECAP_FIGMA_ASSETS } from "./weekly-recap";

export const WEEKLY_RECAP_SHARE_CARD_DIMENSIONS = {
  width: 1080,
  height: 1920,
} as const;

interface WeeklyRecapShareCardRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const WEEKLY_RECAP_SHARE_CARD_DECORATIONS = {
  greenShape: { x: -290, y: 1640, width: 280, height: 280 },
  lavenderShape: { x: 1010, y: 1640, width: 260, height: 300 },
} as const satisfies Record<string, WeeklyRecapShareCardRect>;

const WEEKLY_RECAP_SHARE_CARD_TEXT_SAFE_REGIONS = [
  { x: 80, y: 760, width: 920, height: 240 },
  { x: 80, y: 1040, width: 920, height: 300 },
  { x: 80, y: 1380, width: 920, height: 220 },
  { x: 80, y: 1640, width: 920, height: 170 },
  { x: 80, y: 1830, width: 920, height: 70 },
] as const satisfies readonly WeeklyRecapShareCardRect[];

export interface WeeklyRecapShareCardRowCopy {
  focus: string;
  activeDays: string;
  sessions: string;
  completedTasks: string;
  longestSession: string;
  longestRun: string;
  topSubject: string;
  minutes: (count: number) => string;
  days: (count: number) => string;
  count: (count: number) => string;
  subject: (name: string, minutes: number) => string;
}

export interface WeeklyRecapShareCardCopy extends WeeklyRecapShareCardRowCopy {
  title: string;
  weeklyTitleLabel: string;
  weeklyTitleFallback: string;
  signature: string;
}

export interface WeeklyRecapShareCardRow {
  label: string;
  value: string;
}

const PUHU_PROUD_SRC = "/mascot/puhu/puhu-proud.png";

export function hasWeeklyRecapShareCardDecorationOverlap(): boolean {
  return Object.values(WEEKLY_RECAP_SHARE_CARD_DECORATIONS).some((decoration) =>
    WEEKLY_RECAP_SHARE_CARD_TEXT_SAFE_REGIONS.some((region) =>
      doRectanglesOverlap(decoration, region),
    ),
  );
}

export function buildWeeklyRecapShareCardRows(
  model: WeeklyRecapShareCardModel,
  copy: WeeklyRecapShareCardRowCopy,
): WeeklyRecapShareCardRow[] {
  const rows: WeeklyRecapShareCardRow[] = [];

  if (model.focusMinutes > 0) {
    rows.push({
      label: copy.focus,
      value: copy.minutes(model.focusMinutes),
    });
  }
  if (model.activeDays > 0) {
    rows.push({
      label: copy.activeDays,
      value: copy.count(model.activeDays),
    });
  }
  if (model.qualifyingSessionCount > 0) {
    rows.push({
      label: copy.sessions,
      value: copy.count(model.qualifyingSessionCount),
    });
  }
  if (model.completedTaskCount > 0) {
    rows.push({
      label: copy.completedTasks,
      value: copy.count(model.completedTaskCount),
    });
  }
  if (model.longestSessionMinutes > 0) {
    rows.push({
      label: copy.longestSession,
      value: copy.minutes(model.longestSessionMinutes),
    });
  }
  if (model.longestActiveRun > 0) {
    rows.push({
      label: copy.longestRun,
      value: copy.days(model.longestActiveRun),
    });
  }
  if (model.topSubject) {
    rows.push({
      label: copy.topSubject,
      value: copy.subject(
        model.topSubject.subjectName,
        model.topSubject.focusMinutes,
      ),
    });
  }

  return rows;
}

export async function renderWeeklyRecapShareCard(
  model: WeeklyRecapShareCardModel,
  copy: WeeklyRecapShareCardCopy,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WEEKLY_RECAP_SHARE_CARD_DIMENSIONS.width;
  canvas.height = WEEKLY_RECAP_SHARE_CARD_DIMENSIONS.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable");
  }

  await document.fonts?.ready;
  const [character, puhu, greenShape, lavenderShape] = await Promise.all([
    model.characterImageSrc
      ? loadCanvasImage(model.characterImageSrc)
      : Promise.resolve(null),
    loadCanvasImage(PUHU_PROUD_SRC),
    loadCanvasImage(WEEKLY_RECAP_FIGMA_ASSETS.greenShape),
    loadCanvasImage(WEEKLY_RECAP_FIGMA_ASSETS.lavenderShape),
  ]);

  context.fillStyle = "#090611";
  context.fillRect(
    0,
    0,
    WEEKLY_RECAP_SHARE_CARD_DIMENSIONS.width,
    WEEKLY_RECAP_SHARE_CARD_DIMENSIONS.height,
  );

  if (character) {
    drawCanvasImageCover(context, character, {
      x: 0,
      y: 0,
      width: 1080,
      height: 760,
    });
  } else {
    drawCanvasImage(context, puhu, {
      x: 340,
      y: 190,
      width: 400,
      height: 400,
    });
  }

  const heroGradient = context.createLinearGradient(0, 300, 0, 760);
  heroGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  heroGradient.addColorStop(1, "rgba(0, 0, 0, 0.82)");
  context.fillStyle = heroGradient;
  context.fillRect(0, 260, 1080, 500);

  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillStyle = "rgba(255, 255, 255, 0.72)";
  context.font = '800 28px "Nunito Sans", sans-serif';
  context.fillText(copy.weeklyTitleLabel, 90, 570, 760);
  context.fillStyle = "#ffffff";
  context.font = '900 82px "Nunito Sans", sans-serif';
  drawFittedCanvasText(
    context,
    model.weeklyTitle ?? copy.weeklyTitleFallback,
    90,
    615,
    900,
    82,
    48,
  );

  context.fillStyle = "#ff5b49";
  context.fillRect(0, 760, 1080, 1160);

  drawCanvasImage(
    context,
    greenShape,
    WEEKLY_RECAP_SHARE_CARD_DECORATIONS.greenShape,
  );
  drawCanvasImage(
    context,
    lavenderShape,
    WEEKLY_RECAP_SHARE_CARD_DECORATIONS.lavenderShape,
  );

  context.fillStyle = "#000000";
  context.font = '900 60px "Nunito Sans", sans-serif';
  drawFittedCanvasText(context, copy.title, 90, 815, 900, 60, 44);

  const rows = buildWeeklyRecapShareCardRows(model, copy);
  const subjectRow = rows.find((row) => row.label === copy.topSubject) ?? null;
  const metricRows = rows.filter((row) => row !== subjectRow);
  const leadRow = metricRows[0] ?? null;
  const statRows = metricRows.slice(1, 6);

  context.fillStyle = "rgba(0, 0, 0, 0.16)";
  context.fillRect(90, 920, 900, 3);

  if (leadRow) {
    context.fillStyle = "#000000";
    context.font = '900 108px "Nunito Sans", sans-serif';
    drawFittedCanvasText(context, leadRow.value, 90, 970, 800, 108, 72);
    context.fillStyle = "rgba(0, 0, 0, 0.66)";
    context.font = '800 32px "Nunito Sans", sans-serif';
    context.fillText(leadRow.label, 96, 1095, 760);
  }

  statRows.forEach((row, index) => {
    const column = index % 2;
    const rowIndex = Math.floor(index / 2);
    const x = column === 0 ? 110 : 580;
    const y = 1225 + rowIndex * 155;

    context.textAlign = "left";
    context.fillStyle = "#000000";
    context.font = '900 58px "Nunito Sans", sans-serif';
    drawFittedCanvasText(context, row.value, x, y, 380, 58, 38);
    context.fillStyle = "rgba(0, 0, 0, 0.62)";
    context.font = '800 25px "Nunito Sans", sans-serif';
    context.fillText(row.label, x, y + 66, 380);
  });

  if (subjectRow) {
    context.fillStyle = "#000000";
    context.fillRect(90, 1650, 900, 4);
    context.textAlign = "left";
    context.fillStyle = "rgba(0, 0, 0, 0.62)";
    context.font = '800 28px "Nunito Sans", sans-serif';
    context.fillText(subjectRow.label, 90, 1690, 760);
    context.fillStyle = "#000000";
    context.font = '900 58px "Nunito Sans", sans-serif';
    drawFittedCanvasText(context, subjectRow.value, 90, 1735, 900, 58, 40);
  }

  context.textAlign = "left";
  context.fillStyle = "#000000";
  context.font = '900 30px "Nunito Sans", sans-serif';
  context.fillText(copy.signature, 90, 1855, 760);

  return canvasToBlob(canvas);
}

function loadCanvasImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function drawCanvasImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  rect: WeeklyRecapShareCardRect,
): void {
  if (image) {
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  }
}

function drawCanvasImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  rect: WeeklyRecapShareCardRect,
): void {
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = rect.width / rect.height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;

  if (sourceRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / targetRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
  );
}

function doRectanglesOverlap(
  first: WeeklyRecapShareCardRect,
  second: WeeklyRecapShareCardRect,
): boolean {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

function drawFittedCanvasText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  initialSize: number,
  minimumSize: number,
): void {
  let size = initialSize;
  while (size > minimumSize && context.measureText(value).width > maxWidth) {
    size -= 2;
    context.font = `900 ${size}px "Nunito Sans", sans-serif`;
  }
  context.fillText(value, x, y, maxWidth);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Share image could not be created"));
      }
    }, "image/png");
  });
}
