"use client";

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
    backgroundImage:
      "radial-gradient(rgba(0, 0, 0, 0.045) 1px, transparent 1.2px)",
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
};

function backgroundStyle(background: VisionBoardDoc["background"]): CSSProperties {
  if (background.kind === "color") return { backgroundColor: background.value };
  return BACKGROUNDS[background.value] ?? BACKGROUNDS.paper!;
}

export interface BoardStageProps {
  doc: VisionBoardDoc;
  /** Read-only surfaces (panel card, export preview) pass nothing else. */
  onSelect?: (id: string | null) => void;
  onItemPointerDown?: (event: ReactPointerEvent, item: VisionBoardItem) => void;
  selectedId?: string | null;
  /** Selection outline + resize/rotate handles, rendered by the editor for the selected item. */
  renderOverlay?: (item: VisionBoardItem) => ReactNode;
  className?: string;
}

export function BoardStage({
  doc,
  onSelect,
  onItemPointerDown,
  selectedId = null,
  renderOverlay,
  className,
}: BoardStageProps) {
  const interactive = Boolean(onSelect || onItemPointerDown);
  const ordered = [...doc.items].sort((a, b) => a.z - b.z);

  return (
    <div
      className={className}
      onPointerDown={interactive ? () => onSelect?.(null) : undefined}
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
      {ordered.map((item) => {
        const selected = item.id === selectedId;
        return (
          <div
            key={item.id}
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
            style={{
              position: "absolute",
              left: cq(item.x),
              top: cq(item.y),
              width: cq(item.width),
              height: cq(item.height),
              transform: `rotate(${item.rotation}deg)`,
              opacity: item.opacity,
              cursor: interactive ? (selected ? "move" : "pointer") : undefined,
              // Rotation happens about the middle so a tilted item stays where it looks like it is.
              transformOrigin: "center center",
            }}
          >
            <BoardItemView item={item} />
            {selected ? renderOverlay?.(item) : null}
          </div>
        );
      })}
    </div>
  );
}
