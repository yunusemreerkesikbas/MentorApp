import type { NotebookContentsPageDto, NotebookInkStroke, NotebookPageDoc, NotebookPageItem, VisionBoardTextItem } from "@mentor/types";
import { notebookPageIndexSchema } from "@mentor/validation";

export function nextPageIndex(pages: Pick<NotebookContentsPageDto, "pageIndex">[]) {
  return pages.reduce((next, page) => Math.max(next, page.pageIndex + 1), 0);
}
export function readPageParam(raw?: string) {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const page = notebookPageIndexSchema.safeParse(raw);
  return page.success ? page.data : null;
}
export function itemPlacement(doc: NotebookPageDoc, id: string) {
  const row = doc.items.length % 4;
  return { id, x: 52, y: 68 + row * 350, width: 968, height: 320, rotation: 0, opacity: 1,
    z: doc.items.reduce((top, item) => Math.max(top, item.z + 1), 0) };
}
export function newWriting(doc: NotebookPageDoc, id: string, color: string): VisionBoardTextItem {
  return { ...itemPlacement(doc, id), kind: "text", text: "", font: "body", size: 44,
    color, bold: false, italic: false, align: "left", lineHeight: 1.3, letterSpacing: 0, background: null };
}
export function replacePageItem(doc: NotebookPageDoc, item: NotebookPageItem): NotebookPageDoc {
  return { ...doc, items: doc.items.map((old) => old.id === item.id ? item : old) };
}
export function strokeCoordinates(points: number[]) {
  const pairs: string[] = [];
  for (let pos = 0; pos < points.length; pos += 3) pairs.push(points[pos] + "," + points[pos + 1]);
  return pairs.join(" ");
}

export function appendStroke(doc: NotebookPageDoc, stroke: NotebookInkStroke, maxStrokes: number, maxPoints: number): NotebookPageDoc {
  if (doc.ink.length >= maxStrokes) return doc;
  const usedPoints = doc.ink.reduce((total, line) => total + line.points.length / 3, 0);
  const remaining = maxPoints - usedPoints;
  if (remaining < 2) return doc;
  const points = stroke.points.slice(0, remaining * 3);
  return { ...doc, ink: [...doc.ink, { ...stroke, points }] };
}
