"use client";

import { memo } from "react";
import type { NotebookEntryDto, NotebookPageItem } from "@mentor/types";
import { NOTEBOOK_PAGE_CANVAS } from "@mentor/types";
import { BoardItemView } from "@/components/vision-board/board-item-view";
import { NotebookEntryCard } from "./notebook-entry-card";

/**
 * Turns a page document into pixels.
 *
 * Positioning is `BoardStage`'s: absolute px in a fixed design space, converted to `cqw` and
 * applied with `translate` rather than `left`/`top` so a future drag never triggers layout. Kept
 * separate from `BoardStage` itself because that component's document type is the vision board's
 * contract, and widening it to carry a notebook item would leak the notebook into the board's
 * exporter and panel card.
 *
 * ponytail: render-only for now — stickers and notes are placed by the add flow, not dragged.
 * Reusing `use-item-gesture` needs it made generic over the item type, which means re-verifying the
 * board editor; that is its own change.
 */

/** Design-space px → a share of the container's width. */
function cq(value: number): string {
  return `${(value / NOTEBOOK_PAGE_CANVAS.width) * 100}cqw`;
}

const StageItem = memo(function StageItem({
  item,
  entry,
  due,
  onOpenEntry,
}: {
  item: NotebookPageItem;
  entry?: NotebookEntryDto;
  due?: boolean;
  onOpenEntry?: (entry: NotebookEntryDto) => void;
}) {
  return (
    <div
      data-notebook-item={item.id}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: cq(item.width),
        height: cq(item.height),
        transform: `translate(${cq(item.x)}, ${cq(item.y)}) rotate(${item.rotation}deg)`,
        transformOrigin: "center center",
        opacity: item.opacity,
      }}
    >
      {item.kind === "entry" ? (
        // An item whose entry was deleted renders as nothing rather than as a broken card: the
        // page repairs itself on its next save, which is cheaper than rewriting every page on
        // delete.
        entry ? (
          <NotebookEntryCard entry={entry} due={due} onOpen={onOpenEntry} />
        ) : null
      ) : (
        <BoardItemView item={item} />
      )}
    </div>
  );
});

export interface NotebookPageStageProps {
  items: NotebookPageItem[];
  entries: NotebookEntryDto[];
  /** Entry ids whose review moment has arrived — the page lifts them out of the crowd. */
  dueIds?: ReadonlySet<string>;
  onOpenEntry?: (entry: NotebookEntryDto) => void;
}

export function NotebookPageStage({
  items,
  entries,
  dueIds,
  onOpenEntry,
}: NotebookPageStageProps) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const ordered = [...items].sort((a, b) => a.z - b.z);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {ordered.map((item) => (
        <StageItem
          key={item.id}
          item={item}
          entry={item.kind === "entry" ? byId.get(item.entryId) : undefined}
          due={item.kind === "entry" ? dueIds?.has(item.entryId) : false}
          onOpenEntry={onOpenEntry}
        />
      ))}
    </div>
  );
}
