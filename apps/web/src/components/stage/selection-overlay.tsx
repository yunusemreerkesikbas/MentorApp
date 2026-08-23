"use client";

import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { ResizeCorner } from "./gesture-math";

/**
 * Selection outline plus the four resize corners and a rotate grip.
 *
 * Handles are sized in fixed CSS px, not `cqw`: a touch target has to stay tappable at 44px no
 * matter how small the stage is drawn, which is the one place where scaling with the board would
 * be exactly wrong.
 *
 * Takes no item: the outline fills its parent and the handles sit at percentages of it, so the
 * overlay never needs to know the design space it is drawn in — which is what lets one component
 * serve both the 1620-unit board and the 1080-unit notebook page.
 */

const HANDLE_HIT = 44;
const HANDLE_DOT = 14;

const CORNERS: {
  corner: ResizeCorner;
  top: string;
  left: string;
  cursor: string;
}[] = [
  { corner: "nw", top: "0%", left: "0%", cursor: "nwse-resize" },
  { corner: "ne", top: "0%", left: "100%", cursor: "nesw-resize" },
  { corner: "se", top: "100%", left: "100%", cursor: "nwse-resize" },
  { corner: "sw", top: "100%", left: "0%", cursor: "nesw-resize" },
];

export interface SelectionOverlayProps {
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
  /**
   * One thing to do with the selected item, drawn under the box.
   *
   * The overlay is shared with the vision board, which passes nothing — this is a slot, not a
   * feature. It exists because the notebook needs a visible way into "study this card": the card
   * has always opened on double-click, and a double-click is not a thing anyone finds.
   */
  action?: { label: string; icon: ReactNode; onClick: () => void };
}

export function SelectionOverlay({
  resizeHandlers,
  rotateHandlers,
  resizeLabel,
  rotateLabel,
  action,
}: SelectionOverlayProps) {
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
          transform: "translate(-50%, calc(-100% - 4%))",
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

      {/* Below the box, opposite the rotate handle: the corners and the top are already spoken for,
          and a label that overlapped the item would hide what it is about to open. */}
      {action ? (
        <button
          type="button"
          onClick={(event) => {
            // The stage treats a pointer on the item as the start of a drag; this is a control on
            // top of it, not a grab of it.
            event.stopPropagation();
            action.onClick();
          }}
          onPointerDown={(event) => event.stopPropagation()}
          style={{
            position: "absolute",
            left: "50%",
            top: "100%",
            transform: "translate(-50%, 6px)",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            minHeight: 32,
            padding: "0 10px",
            borderRadius: "var(--radius-card)",
            // Outlined on the page's own surface, not a filled accent pill. Solid, it read as a new
            // object someone had dropped onto the paper; this way it belongs to the selection
            // outline it hangs from — the same accent, borrowed rather than blocked in.
            border: "1px solid var(--color-accent)",
            cursor: "pointer",
            whiteSpace: "nowrap",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--color-accent)",
            backgroundColor: "var(--color-surface)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          {action.icon}
          {action.label}
        </button>
      ) : null}
    </>
  );
}
