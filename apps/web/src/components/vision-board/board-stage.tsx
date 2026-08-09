"use client";

import { memo } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
  VISION_BOARD_CANVAS,
  type VisionBoardDoc,
  type VisionBoardItem,
} from "@mentor/types";
import { BoardItemView, cq } from "./board-item-view";

/**
 * The board surface — the single place a document turns into pixels.
 *
 * Deliberately shared by the editor and the read-only panel card: two renderers would drift, and
 * the drift would only ever show up as "my board looks wrong on the panel". The editor layers
 * selection and handles *around* this, never inside it.
 *
 * Layout is `container-type: inline-size` plus `cqw` lengths, so nothing here measures anything.
 */

/** Board backgrounds. Procedural on purpose — the canvas exporter has to reproduce each one. */
const BACKGROUNDS: Record<string, CSSProperties> = {
  cork: {
    backgroundColor: "#d8b083",
    backgroundImage:
      "radial-gradient(rgba(120, 82, 47, 0.35) 1px, transparent 1.4px), radial-gradient(rgba(160, 116, 70, 0.3) 1px, transparent 1.4px)",
    backgroundSize: "7px 7px, 11px 11px",
    backgroundPosition: "0 0, 4px 5px",
  },
  paper: {
    backgroundColor: "#faf7f2",
    backgroundImage: "radial-gradient(rgba(0, 0, 0, 0.045) 1px, transparent 1.2px)",
    backgroundSize: "5px 5px",
  },
  grid: {
    backgroundColor: "#ffffff",
    backgroundImage:
      "linear-gradient(rgba(17, 17, 17, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(17, 17, 17, 0.07) 1px, transparent 1px)",
    backgroundSize: "28px 28px",
  },
  linen: {
    backgroundColor: "#f2efe9",
    backgroundImage:
      "repeating-linear-gradient(45deg, rgba(0,0,0,0.03) 0 2px, transparent 2px 4px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.03) 0 2px, transparent 2px 4px)",
  },
  dots: {
    backgroundColor: "#f5f6fb",
    backgroundImage: "radial-gradient(rgba(85, 172, 238, 0.28) 3px, transparent 3.5px)",
    backgroundSize: "24px 24px",
  },
  stripes: {
    backgroundColor: "#fdf6f0",
    backgroundImage:
      "repeating-linear-gradient(135deg, rgba(243, 112, 90, 0.14) 0 6px, transparent 6px 16px)",
  },
};

function backgroundStyle(background: VisionBoardDoc["background"]): CSSProperties {
  if (background.kind === "color") return { backgroundColor: background.value };
  return BACKGROUNDS[background.value] ?? BACKGROUNDS.paper!;
}

/**
 * One placed item.
 *
 * Memoised, and that is what makes dragging smooth: a gesture patches only the item under the
 * pointer, so every other item keeps its object identity and skips re-rendering entirely. Without
 * this, one pointer move re-renders the whole board — twenty photos included.
 */
const StageItem = memo(function StageItem({
  item,
  selected,
  interactive,
  hideContent,
  onSelect,
  onItemPointerDown,
  onItemDoubleClick,
  overlay,
}: {
  item: VisionBoardItem;
  selected: boolean;
  interactive: boolean;
  /** True while an overlay (e.g. the inline text editor) fully replaces the item's own render. */
  hideContent?: boolean;
  /** Must be referentially stable, or the memo above never skips anything. */
  onSelect?: (id: string | null) => void;
  onItemPointerDown?: (event: ReactPointerEvent, item: VisionBoardItem) => void;
  onItemDoubleClick?: (item: VisionBoardItem) => void;
  overlay?: ReactNode;
}) {
  return (
    <div
      data-board-item={item.id}
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
      onDoubleClick={
        interactive
          ? (event) => {
              event.stopPropagation();
              onItemDoubleClick?.(item);
            }
          : undefined
      }
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: cq(item.width),
        height: cq(item.height),
        /*
         * Position via `translate` rather than `left`/`top`: those trigger layout on every frame of
         * a drag, a transform does not. `cqw` is a length unit (a share of the container's width),
         * not a percentage of the element, so it composes correctly inside `translate`.
         */
        transform: `translate(${cq(item.x)}, ${cq(item.y)}) rotate(${item.rotation}deg)`,
        transformOrigin: "center center",
        opacity: item.opacity,
        cursor: interactive ? (selected ? "move" : "pointer") : undefined,
        touchAction: interactive ? "none" : undefined,
      }}
    >
      {hideContent ? null : <BoardItemView item={item} />}
      {overlay}
    </div>
  );
});

export interface BoardStageProps {
  doc: VisionBoardDoc;
  /** Read-only surfaces (panel card, export preview) pass nothing else. */
  onSelect?: (id: string | null) => void;
  onItemPointerDown?: (event: ReactPointerEvent, item: VisionBoardItem) => void;
  onItemDoubleClick?: (item: VisionBoardItem) => void;
  /** Delegated on the stage root so a drag keeps tracking wherever the pointer goes. */
  onPointerMove?: (event: ReactPointerEvent) => void;
  onPointerUp?: (event: ReactPointerEvent) => void;
  selectedId?: string | null;
  /** The one item, if any, whose overlay fully replaces its own render (the inline text editor). */
  contentHiddenId?: string | null;
  /** Selection outline + resize/rotate handles, rendered by the editor for the selected item. */
  renderOverlay?: (item: VisionBoardItem) => ReactNode;
  className?: string;
}

export function BoardStage({
  doc,
  onSelect,
  onItemPointerDown,
  onItemDoubleClick,
  onPointerMove,
  onPointerUp,
  selectedId = null,
  contentHiddenId = null,
  renderOverlay,
  className,
}: BoardStageProps) {
  const interactive = Boolean(onSelect || onItemPointerDown);
  const ordered = [...doc.items].sort((a, b) => a.z - b.z);

  return (
    <div
      className={className}
      data-board-stage={interactive ? "" : undefined}
      onPointerDown={interactive ? () => onSelect?.(null) : undefined}
      /*
       * Move/up live here, not on each item. Pointer capture keeps delivering events to the item
       * that was pressed and they bubble to this root, so one pair of handlers serves every
       * gesture — and a fast drag that leaves the item (or the stage) never drops it.
       */
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        containerType: "inline-size",
        position: "relative",
        width: "100%",
        aspectRatio: `${VISION_BOARD_CANVAS.width} / ${VISION_BOARD_CANVAS.height}`,
        overflow: "hidden",
        touchAction: interactive ? "none" : undefined,
        ...backgroundStyle(doc.background),
      }}
    >
      {ordered.map((item) => (
        <StageItem
          key={item.id}
          item={item}
          selected={item.id === selectedId}
          interactive={interactive}
          hideContent={item.id === contentHiddenId}
          onSelect={onSelect}
          onItemPointerDown={onItemPointerDown}
          onItemDoubleClick={onItemDoubleClick}
          overlay={item.id === selectedId ? renderOverlay?.(item) : undefined}
        />
      ))}
    </div>
  );
}
