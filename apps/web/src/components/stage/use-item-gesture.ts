"use client";

import { useCallback, useMemo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { VisionBoardItemBase } from "@mentor/types";
import {
  angleFromCentre,
  applyMove,
  applyResize,
  snapAngle,
  toCanvasScale,
  type GestureMode,
  type ResizeCorner,
} from "./gesture-math";

/**
 * One pointer system for move, resize and rotate, for any stage that places rectangles.
 *
 *
 * Framer Motion's `drag` would only cover the first of the three, and the resize/rotate handles
 * need their own maths anyway — two systems sharing one element is how you get a photo that jumps
 * when you switch from dragging it to scaling it. Precedent for hand-rolled pointer work in this
 * codebase: `use-map-viewport.ts` and `CircularTimerRing`.
 *
 * Pointer capture means a fast drag that leaves the stage keeps tracking, and `touch-action: none`
 * on the stage stops the browser scrolling the page instead.
 */

interface DragSession<T extends VisionBoardItemBase> {
  pointerId: number;
  mode: GestureMode;
  /** The item as it was when the gesture started — every frame is computed from this, not the last. */
  origin: T;
  /** The element the press started on, so the deferred pointer capture lands on the right one. */
  element: HTMLElement;
  startX: number;
  startY: number;
  /** Canvas units per screen px, sampled once: the stage cannot resize mid-gesture. */
  scale: number;
  /** Item centre in screen coords, for rotation. */
  centreX: number;
  centreY: number;
  moved: boolean;
}

export interface UseItemGestureOptions<T extends VisionBoardItemBase> {
  /** Always transient — the gesture takes its own history snapshot via {@link checkpoint}. */
  patch: (id: string, patch: Partial<T>) => void;
  /** Snapshot the pre-gesture document. Called once, on the first move that actually happens. */
  checkpoint: () => void;
  /** Photos keep their proportions unless the user says otherwise. */
  lockRatioFor: (item: T) => boolean;
  /**
   * Width of the stage's design space. Screen deltas mean nothing until they are divided by this,
   * and the two stages disagree on it — passing it beats importing one stage's constant into both.
   */
  canvasWidth: number;
}

export function useItemGesture<T extends VisionBoardItemBase>({
  patch,
  checkpoint,
  lockRatioFor,
  canvasWidth,
}: UseItemGestureOptions<T>) {
  const session = useRef<DragSession<T> | null>(null);

  const begin = useCallback(
    (event: ReactPointerEvent, item: T, mode: GestureMode) => {
      // Only the primary button starts a gesture; right-click belongs to the browser menu.
      if (event.button !== 0) return;
      const stage = (event.currentTarget as HTMLElement).closest<HTMLElement>(
        "[data-board-stage]",
      );
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const scale = toCanvasScale(rect.width, canvasWidth);

      session.current = {
        pointerId: event.pointerId,
        mode,
        origin: item,
        element: event.currentTarget as HTMLElement,
        startX: event.clientX,
        startY: event.clientY,
        scale,
        centreX: rect.left + ((item.x + item.width / 2) / canvasWidth) * rect.width,
        centreY: rect.top + ((item.y + item.height / 2) / canvasWidth) * rect.width,
        moved: false,
      };
      /*
       * Capture is taken on the first real move, NOT here.
       *
       * Capturing at pointerdown retargets every later pointer event for this pointer to the
       * captured element, so `pointerup` lands on the item wrapper rather than on whatever child
       * was actually pressed — and the browser then fires `click` at the nearest common ancestor
       * of the two, which is that same wrapper. The effect is that NO click handler on any child
       * of a stage item can ever fire from a mouse or a finger. That is how the notebook's photo
       * cards ended up with a "Fotoğrafı büyüt" button reachable only by keyboard.
       *
       * Deferring costs nothing: capture exists so a fast drag that leaves the element keeps
       * tracking, and until the pointer has moved there is no drag to lose. Until then the moves
       * bubble to the stage's own handler, which is where `move` is bound anyway.
       */
      event.preventDefault();
    },
    [canvasWidth],
  );

  const move = useCallback(
    (event: ReactPointerEvent) => {
      const drag = session.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      const dx = (event.clientX - drag.startX) * drag.scale;
      const dy = (event.clientY - drag.startY) * drag.scale;
      // Snapshot once, here: this is the last instant the pre-gesture document still exists.
      // This is also where the pointer is captured — see `begin` for why not there.
      if (!drag.moved) {
        drag.moved = true;
        drag.element.setPointerCapture(drag.pointerId);
        checkpoint();
      }

      if (drag.mode.kind === "move") {
        patch(drag.origin.id, applyMove(drag.origin, dx, dy) as Partial<T>);
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
          ) as Partial<T>,
        );
        return;
      }
      const raw = angleFromCentre(drag.centreX, drag.centreY, event.clientX, event.clientY);
      patch(drag.origin.id, { rotation: snapAngle(raw, event.shiftKey) } as Partial<T>);
    },
    [checkpoint, lockRatioFor, patch],
  );

  const end = useCallback(
    (event: ReactPointerEvent) => {
      const drag = session.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      session.current = null;
      try {
        // Released from the element that took it, which is only ever the one the press started
        // on — and only if the gesture actually moved far enough to take it at all.
        if (drag.moved) drag.element.releasePointerCapture(event.pointerId);
      } catch {
        /* Capture is already gone when the pointer was cancelled — nothing to release. */
      }
      // Nothing to close: the checkpoint at first-move already put exactly one entry on the undo
      // stack, and a click that never moved took no checkpoint at all.
    },
    [],
  );

  const handlersFor = useCallback(
    (item: T, mode: GestureMode) => ({
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
