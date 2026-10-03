import type { NotebookContentsPageDto } from "@mentor/types";

/**
 * The contents page ("İçindekiler") of a notebook: one line per page that has anything on it.
 *
 * Pure on purpose. The rows come out of jsonb, which the write schema validated once on the way in
 * and nobody has validated since, so everything here reads defensively and nothing throws: a page
 * that cannot be summarised still gets its line, it just has no title.
 */

/** Cap on a note's first line. The contents line truncates visually; this only bounds the payload. */
export const CONTENTS_NOTE_TITLE_MAX = 80;

export interface ContentsPageInput {
  pageIndex: number;
  /** `doc.items` as stored. */
  items: unknown;
  /** Number of freehand strokes on the page. */
  inkCount: number;
}

export interface ContentsEntryInput {
  id: string;
  subjectRef: string | null;
  subjectName: string | null;
  topicRef: string | null;
  topicName: string | null;
  due: boolean;
}

interface LooseItem {
  kind?: unknown;
  x?: unknown;
  y?: unknown;
  text?: unknown;
  entryId?: unknown;
}

function looseItems(items: unknown): LooseItem[] {
  if (!Array.isArray(items)) return [];
  return items.filter(
    (item): item is LooseItem => typeof item === "object" && item !== null,
  );
}

/** The entry ids a page's cards point at, for hydrating their labels in one read. */
export function contentsEntryIds(items: unknown): string[] {
  return looseItems(items).flatMap((item) =>
    item.kind === "entry" && typeof item.entryId === "string"
      ? [item.entryId]
      : [],
  );
}

function coordinate(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * The first line of the note a reader meets first: top-most, then left-most.
 *
 * Reading order rather than z-order or array order, because the array is the order things were
 * added in, and a heading written last but placed at the top is still the heading.
 */
export function firstNoteLine(items: unknown): string | null {
  const notes = looseItems(items)
    .filter((item) => item.kind === "text" && typeof item.text === "string")
    .sort(
      (a, b) =>
        coordinate(a.y) - coordinate(b.y) || coordinate(a.x) - coordinate(b.x),
    );
  for (const note of notes) {
    const line = (note.text as string)
      .split(/\r?\n/)
      .map((part) => part.replace(/\s+/g, " ").trim())
      .find((part) => part.length > 0);
    if (!line) continue;
    return line.length > CONTENTS_NOTE_TITLE_MAX
      ? `${line.slice(0, CONTENTS_NOTE_TITLE_MAX - 1).trimEnd()}…`
      : line;
  }
  return null;
}

/** The value that occurs most often; ties go to the one seen first, which is page order. */
function mostCommon<T>(values: T[], key: (value: T) => string): T | null {
  const counts = new Map<string, { value: T; count: number }>();
  for (const value of values) {
    const k = key(value);
    const current = counts.get(k);
    if (current) current.count += 1;
    else counts.set(k, { value, count: 1 });
  }
  let best: { value: T; count: number } | null = null;
  for (const candidate of counts.values()) {
    if (!best || candidate.count > best.count) best = candidate;
  }
  return best?.value ?? null;
}

export function summarizeNotebookPages(
  pages: ContentsPageInput[],
  entriesById: ReadonlyMap<string, ContentsEntryInput>,
): NotebookContentsPageDto[] {
  return [...pages]
    .sort((a, b) => a.pageIndex - b.pageIndex)
    .flatMap((page) => {
      const items = looseItems(page.items);
      const inkCount = Math.max(0, Math.floor(page.inkCount) || 0);
      if (items.length === 0 && inkCount === 0) return [];

      // A card whose entry was deleted keeps its item until the page is next saved; it is on the
      // page as nothing, so it is not counted as a card either.
      const entries = contentsEntryIds(items)
        .map((id) => entriesById.get(id))
        .filter((entry): entry is ContentsEntryInput => entry !== undefined);
      const subject = mostCommon(
        entries.filter((entry) => entry.subjectRef !== null),
        (entry) => entry.subjectRef as string,
      );
      const topic = mostCommon(
        entries.filter(
          (entry) => entry.topicRef !== null && entry.topicName !== null,
        ),
        (entry) => `${entry.subjectRef ?? ""}/${entry.topicRef}`,
      );

      return [
        {
          pageIndex: page.pageIndex,
          noteTitle: firstNoteLine(items),
          topicName: topic?.topicName ?? null,
          subjectRef: subject?.subjectRef ?? null,
          subjectName: subject?.subjectName ?? null,
          entryCount: entries.length,
          dueCount: entries.filter((entry) => entry.due).length,
          stickerCount: items.filter((item) => item.kind === "sticker").length,
          inkCount,
        },
      ];
    });
}
