"use client";

import { memo } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { NotebookEntryDto, NotebookPageItem } from "@mentor/types";
import { NOTEBOOK_PAGE_CANVAS } from "@mentor/types";
import { BoardItemView } from "@/components/vision-board/board-item-view";
import { NotebookEntryCard } from "./notebook-entry-card";

/**
 * Turns a page document into pixels.
 *
 * Positioning is `BoardStage`'s: absolute px in a fixed design space, converted to `cqw` and
 * applied with `translate` rather than `left`/`top`, so dragging never triggers layout. Kept
 * separate from `BoardStage` itself because that component's document type is the vision board's
 * contract, and widening it to carry a notebook item would leak the notebook into the board's
 * exporter and panel card. The *gesture* layer underneath is genuinely shared
 * (`components/stage/`) — a rectangle with a rotation behaves the same on either surface.
 */

/** Design-space px → a share of the container's width. */
function cq(value: number): string {
  return `${(value / NOTEBOOK_PAGE_CANVAS.width) * 100}cqw`;
}

const StageItem = memo(function StageItem({
  item,
  entry,
  due,
  interactive,
  selected,
  onSelect,
  onItemPointerDown,
  onOpenEntry,
  overlay,
}: {
  item: NotebookPageItem;
  entry?: NotebookEntryDto;
  due?: boolean;
  interactive: boolean;
  selected: boolean;
  /** Must be referentially stable, or the memo above never skips anything. */
  onSelect?: (id: string | null) => void;
  onItemPointerDown?: (event: ReactPointerEvent, item: NotebookPageItem) => void;
  onOpenEntry?: (entry: NotebookEntryDto) => void;
  overlay?: ReactNode;
}) {
  return (
    <div
      data-notebook-item={item.id}
      onPointerDown={
        interactive
          ? (event) => {
              // Stop the stage's own handler from immediately clearing the selection.
              event.stopPropagation();
              onSelect?.(item.id);
              onItemPointerDown?.(event, item);
            }
          : undefined
      }
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: cq(item.width),
        height: cq(item.height),
        transform: `translate(${cq(item.x)}, ${cq(item.y)}) rotate(${item.rotation}deg)`,
        transformOrigin: "center center",
        opacity: item.opacity,
        cursor: interactive ? (selected ? "move" : "pointer") : undefined,
        touchAction: interactive ? "none" : undefined,
      }}
    >
      {item.kind === "entry" ? (
        // An item whose entry was deleted renders as nothing rather than as a broken card: the
        // page repairs itself on its next save, which is cheaper than rewriting every page on
        // delete.
        entry ? (
          <NotebookEntryCard
            entry={entry}
            due={due}
            // While arranging, a tap selects the card instead of opening it — otherwise every
            // attempt to drag ends in a review sheet.
            onOpen={interactive ? undefined : onOpenEntry}
          />
        ) : null
      ) : (
        <BoardItemView item={item} />
      )}
      {overlay}
    </div>
  );
});

export interface NotebookPageStageProps {
  items: NotebookPageItem[];
  entries: NotebookEntryDto[];
  /** Entry ids whose review moment has arrived — the page lifts them out of the crowd. */
  dueIds?: ReadonlySet<string>;
  onOpenEntry?: (entry: NotebookEntryDto) => void;
  /** Passing any of the editing props below turns the page into an arrangeable surface. */
  onSelect?: (id: string | null) => void;
  onItemPointerDown?: (event: ReactPointerEvent, item: NotebookPageItem) => void;
  onPointerMove?: (event: ReactPointerEvent) => void;
  onPointerUp?: (event: ReactPointerEvent) => void;
  selectedId?: string | null;
  renderOverlay?: (item: NotebookPageItem) => ReactNode;
}

export function NotebookPageStage({
  items,
  entries,
  dueIds,
  onOpenEntry,
  onSelect,
  onItemPointerDown,
  onPointerMove,
  onPointerUp,
  selectedId = null,
  renderOverlay,
}: NotebookPageStageProps) {
  const interactive = Boolean(onSelect || onItemPointerDown);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const ordered = [...items].sort((a, b) => a.z - b.z);

  return (
    <div
      /*
       * `useItemGesture` finds its stage by this attribute to measure the screen→canvas scale.
       * Named for the board because that is where it started; both surfaces are stages.
       */
      data-board-stage={interactive ? "" : undefined}
      onPointerDown={interactive ? () => onSelect?.(null) : undefined}
      // Move/up live here, not on each item: pointer capture keeps delivering to the pressed item
      // and the events bubble here, so one pair of handlers serves every gesture.
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "absolute",
        inset: 0,
        touchAction: interactive ? "none" : undefined,
      }}
    >
      {ordered.map((item) => (
        <StageItem
          key={item.id}
          item={item}
          entry={item.kind === "entry" ? byId.get(item.entryId) : undefined}
          due={item.kind === "entry" ? dueIds?.has(item.entryId) : false}
          interactive={interactive}
          selected={item.id === selectedId}
          onSelect={onSelect}
          onItemPointerDown={onItemPointerDown}
          onOpenEntry={onOpenEntry}
          overlay={item.id === selectedId ? renderOverlay?.(item) : undefined}
        />
      ))}
    </div>
  );
}
