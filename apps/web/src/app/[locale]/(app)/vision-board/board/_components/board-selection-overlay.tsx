"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import type { VisionBoardItem } from "@mentor/types";
import { cq } from "@/components/vision-board/board-item-view";
import type { ResizeCorner } from "./board-gesture-math";

/**
 * Selection outline plus the four resize corners and a rotate grip.
 *
 * Handles are sized in fixed CSS px, not `cqw`: a touch target has to stay tappable at 44px no
 * matter how small the stage is drawn, which is the one place where scaling with the board would
 * be exactly wrong.
 */

const HANDLE_HIT = 44;
const HANDLE_DOT = 14;

const CORNERS: { corner: ResizeCorner; top: string; left: string; cursor: string }[] = [
  { corner: "nw", top: "0%", left: "0%", cursor: "nwse-resize" },
  { corner: "ne", top: "0%", left: "100%", cursor: "nesw-resize" },
  { corner: "se", top: "100%", left: "100%", cursor: "nwse-resize" },
  { corner: "sw", top: "100%", left: "0%", cursor: "nesw-resize" },
];

export interface BoardSelectionOverlayProps {
  item: VisionBoardItem;
  resizeHandlers: (corner: ResizeCorner) => {
    onPointerDown: (event: ReactPointerEvent) => void;
    onPointerMove: (event: ReactPointerEvent) => void;
    onPointerUp: (event: ReactPointerEvent) => void;
    onPointerCancel: (event: ReactPointerEvent) => void;
  };
  rotateHandlers: {
    onPointerDown: (event: ReactPointerEvent) => void;
    onPointerMove: (event: ReactPointerEvent) => void;
    onPointerUp: (event: ReactPointerEvent) => void;
    onPointerCancel: (event: ReactPointerEvent) => void;
  };
  resizeLabel: string;
  rotateLabel: string;
}

export function BoardSelectionOverlay({
  item,
  resizeHandlers,
  rotateHandlers,
  resizeLabel,
  rotateLabel,
}: BoardSelectionOverlayProps) {
  return (
    <>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          outline: `2px solid var(--color-accent)`,
          outlineOffset: "1px",
          pointerEvents: "none",
        }}
      />

      {CORNERS.map(({ corner, top, left, cursor }) => (
        <button
          key={corner}
          type="button"
          aria-label={`${resizeLabel} (${corner})`}
          {...resizeHandlers(corner)}
          style={{
            position: "absolute",
            top,
            left,
            width: HANDLE_HIT,
            height: HANDLE_HIT,
            transform: "translate(-50%, -50%)",
            // Transparent hit area with a small visible dot: 44px of solid colour on each corner
            // would cover the artwork it is meant to frame.
            background: "transparent",
            border: "none",
            padding: 0,
            cursor,
            touchAction: "none",
            display: "grid",
            placeItems: "center",
          }}
        >
          <span
            style={{
              width: HANDLE_DOT,
              height: HANDLE_DOT,
              borderRadius: "50%",
              backgroundColor: "var(--color-surface)",
              border: "2px solid var(--color-accent)",
              boxShadow: "var(--shadow-card)",
            }}
          />
        </button>
      ))}

      <button
        type="button"
        aria-label={rotateLabel}
        {...rotateHandlers}
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: HANDLE_HIT,
          height: HANDLE_HIT,
          // Sits above the box, clear of the top corners.
          transform: `translate(-50%, calc(-100% - ${cq(item.height * 0.04)}))`,
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "grab",
          touchAction: "none",
          display: "grid",
          placeItems: "center",
        }}
      >
        <span
          style={{
            width: HANDLE_DOT + 2,
            height: HANDLE_DOT + 2,
            borderRadius: "50%",
            backgroundColor: "var(--color-accent)",
            boxShadow: "var(--shadow-card)",
          }}
        />
      </button>
    </>
  );
}
