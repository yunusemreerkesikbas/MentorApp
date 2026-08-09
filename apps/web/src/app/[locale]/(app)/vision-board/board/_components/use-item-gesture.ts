"use client";

import { useCallback, useMemo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { VISION_BOARD_CANVAS, type VisionBoardItem } from "@mentor/types";
import {
  angleFromCentre,
  applyMove,
  applyResize,
  snapAngle,
  toCanvasScale,
  type GestureMode,
  type ResizeCorner,
} from "./board-gesture-math";

/**
 * One pointer system for move, resize and rotate.
 *
 * Framer Motion's `drag` would only cover the first of the three, and the resize/rotate handles
 * need their own maths anyway — two systems sharing one element is how you get a photo that jumps
 * when you switch from dragging it to scaling it. Precedent for hand-rolled pointer work in this
 * codebase: `use-map-viewport.ts` and `CircularTimerRing`.
 *
 * Pointer capture means a fast drag that leaves the stage keeps tracking, and `touch-action: none`
 * on the stage stops the browser scrolling the page instead.
 */

interface DragSession {
  pointerId: number;
  mode: GestureMode;
  /** The item as it was when the gesture started — every frame is computed from this, not the last. */
  origin: VisionBoardItem;
  startX: number;
  startY: number;
  /** Canvas units per screen px, sampled once: the stage cannot resize mid-gesture. */
  scale: number;
  /** Item centre in screen coords, for rotation. */
  centreX: number;
  centreY: number;
  moved: boolean;
}

export interface UseItemGestureOptions {
  /** Always transient — the gesture takes its own history snapshot via {@link checkpoint}. */
  patch: (id: string, patch: Partial<VisionBoardItem>) => void;
  /** Snapshot the pre-gesture document. Called once, on the first move that actually happens. */
  checkpoint: () => void;
  /** Photos keep their proportions unless the user says otherwise. */
  lockRatioFor: (item: VisionBoardItem) => boolean;
}

export function useItemGesture({ patch, checkpoint, lockRatioFor }: UseItemGestureOptions) {
  const session = useRef<DragSession | null>(null);

  const begin = useCallback(
    (event: ReactPointerEvent, item: VisionBoardItem, mode: GestureMode) => {
      // Only the primary button starts a gesture; right-click belongs to the browser menu.
      if (event.button !== 0) return;
      const stage = (event.currentTarget as HTMLElement).closest<HTMLElement>(
        "[data-board-stage]",
      );
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const scale = toCanvasScale(rect.width);

      session.current = {
        pointerId: event.pointerId,
        mode,
        origin: item,
        startX: event.clientX,
        startY: event.clientY,
        scale,
        centreX: rect.left + ((item.x + item.width / 2) / VISION_BOARD_CANVAS.width) * rect.width,
        centreY: rect.top + ((item.y + item.height / 2) / VISION_BOARD_CANVAS.width) * rect.width,
        moved: false,
      };
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [],
  );

  const move = useCallback(
    (event: ReactPointerEvent) => {
      const drag = session.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      const dx = (event.clientX - drag.startX) * drag.scale;
      const dy = (event.clientY - drag.startY) * drag.scale;
      // Snapshot once, here: this is the last instant the pre-gesture document still exists.
      if (!drag.moved) {
        drag.moved = true;
        checkpoint();
      }

      if (drag.mode.kind === "move") {
        patch(drag.origin.id, applyMove(drag.origin, dx, dy));
        return;
      }
      if (drag.mode.kind === "resize") {
        patch(
          drag.origin.id,
          applyResize(
            drag.origin,
            drag.mode.corner,
            dx,
            dy,
            // Shift is the universal "let me break the ratio" modifier, so it inverts the default.
            lockRatioFor(drag.origin) !== event.shiftKey,
          ),
        );
        return;
      }
      const raw = angleFromCentre(drag.centreX, drag.centreY, event.clientX, event.clientY);
      patch(drag.origin.id, { rotation: snapAngle(raw, event.shiftKey) });
    },
    [checkpoint, lockRatioFor, patch],
  );

  const end = useCallback(
    (event: ReactPointerEvent) => {
      const drag = session.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      session.current = null;
      try {
        (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
      } catch {
        /* Capture is already gone when the pointer was cancelled — nothing to release. */
      }
      // Nothing to close: the checkpoint at first-move already put exactly one entry on the undo
      // stack, and a click that never moved took no checkpoint at all.
    },
    [],
  );

  const handlersFor = useCallback(
    (item: VisionBoardItem, mode: GestureMode) => ({
      onPointerDown: (event: ReactPointerEvent) => {
        // Without this, the pointerdown bubbles to the item's own handler right after this one
        // runs, which starts a *second*, "move" gesture on the same pointer and stomps the
        // resize/rotate session this handler just began.
        event.stopPropagation();
        begin(event, item, mode);
      },
      onPointerMove: move,
      onPointerUp: end,
      onPointerCancel: end,
    }),
    [begin, end, move],
  );

  // Memoised so consumers can depend on the whole object without rebuilding their own callbacks
  // every render — `BoardStage`'s memoised items rely on those staying stable.
  return useMemo(
    () => ({ begin, move, end, handlersFor, isDragging: () => session.current != null }),
    [begin, end, handlersFor, move],
  );
}

export type { ResizeCorner };
