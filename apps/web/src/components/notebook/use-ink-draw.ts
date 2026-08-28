"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { NotebookInkStroke } from "@mentor/types";
import { NOTEBOOK_PAGE_CANVAS } from "@mentor/types";
import {
  ERASER_RADIUS,
  finalizeStroke,
  hitStroke,
  type InkToolId,
} from "@/lib/notebook-ink";

/**
 * Pointer plumbing for the ink layer: samples in design space, one stroke out.
 *
 * Deliberately the same shape as `use-item-gesture.ts` rather than an extension of it — that hook
 * moves an existing rectangle and every frame recomputes it from a fixed origin, while this one
 * accumulates a list nobody can see yet. What they share is the pattern: primary button only,
 * pointer capture so a fast hand that leaves the element keeps tracking, and the stage measured
 * once per gesture because it cannot resize mid-stroke.
 *
 * The in-progress stroke lives in a ref and is published to React once per animation frame. A
 * `setState` per `pointermove` would re-render on every sample — a stylus sends them faster than
 * the screen refreshes, so most of those renders would be thrown away before anything was painted.
 */

/** Shared empty set so an idle layer is not handed a new identity on every render. */
const EMPTY_ERASING: ReadonlySet<string> = new Set();

interface DrawSession {
  pointerId: number;
  tool: InkToolId;
  /** Element box in screen px, sampled once — the page cannot resize mid-stroke. */
  rect: DOMRect;
  /** Ids the eraser has swept over, flushed as one action when the pointer lifts. */
  erased: Set<string>;
}

export interface UseInkDrawOptions {
  tool: InkToolId;
  color: string;
  size: number;
  opacity: number;
  /** Committed once per finished stroke. Must be referentially stable. */
  onStroke: (stroke: NotebookInkStroke) => void;
  /** Committed once per finished erase gesture, however many strokes it swept. */
  onErase: (ids: string[]) => void;
  /** Read live for hit-testing; a ref-like getter so a swipe sees strokes as they are. */
  getStrokes: () => NotebookInkStroke[];
}

export function useInkDraw({
  tool,
  color,
  size,
  opacity,
  onStroke,
  onErase,
  getStrokes,
}: UseInkDrawOptions) {
  const session = useRef<DrawSession | null>(null);
  const points = useRef<number[]>([]);
  const frame = useRef<number | null>(null);
  /** The in-progress stroke, republished at most once a frame. */
  const [live, setLive] = useState<number[] | null>(null);
  /**
   * What the eraser has swept over so far. Published alongside the live stroke so the layer can
   * fade those strokes out under the cursor — without it, an erase swipe looks like it did nothing
   * until the finger lifts and half the page vanishes at once.
   */
  const [erasing, setErasing] = useState<ReadonlySet<string>>(EMPTY_ERASING);

  const cancelFrame = useCallback(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
  }, []);

  // A stroke still in flight when the layer unmounts (page turn, leaving draw mode) would otherwise
  // leave its rAF scheduled against a component that no longer exists.
  useEffect(() => cancelFrame, [cancelFrame]);

  const publish = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const draw = session.current;
      if (!draw) return;
      if (draw.tool === "eraser") {
        setErasing(new Set(draw.erased));
        return;
      }
      setLive([...points.current]);
    });
  }, []);

  /** Screen px → the page's own 1080×1527 A4 space. Returns null past the edge of the page. */
  const toDesign = useCallback(
    (rect: DOMRect, clientX: number, clientY: number) => {
      const x = ((clientX - rect.left) / rect.width) * NOTEBOOK_PAGE_CANVAS.width;
      const y = ((clientY - rect.top) / rect.height) * NOTEBOOK_PAGE_CANVAS.height;
      if (
        x < 0 ||
        y < 0 ||
        x > NOTEBOOK_PAGE_CANVAS.width ||
        y > NOTEBOOK_PAGE_CANVAS.height
      ) {
        return null;
      }
      return { x, y };
    },
    [],
  );

  /** Ends the gesture and commits whatever it produced. Safe to call twice. */
  const finish = useCallback(() => {
    const draw = session.current;
    if (!draw) return;
    session.current = null;
    cancelFrame();

    if (draw.tool === "eraser") {
      if (draw.erased.size > 0) onErase([...draw.erased]);
    } else {
      const finalized = finalizeStroke(points.current);
      if (finalized) {
        onStroke({
          id: crypto.randomUUID(),
          tool: draw.tool,
          color,
          size,
          opacity,
          points: finalized,
        });
      }
    }
    points.current = [];
    setLive(null);
    setErasing(EMPTY_ERASING);
  }, [cancelFrame, color, onErase, onStroke, opacity, size]);

  const sample = useCallback(
    (draw: DrawSession, clientX: number, clientY: number, pressure: number) => {
      const point = toDesign(draw.rect, clientX, clientY);
      // Off the page — the spine, or the outer edge. The stroke ends here rather than jumping
      // across, which is the whole reason each page keeps its own ink.
      if (!point) {
        finish();
        return false;
      }

      if (draw.tool === "eraser") {
        for (const stroke of getStrokes()) {
          if (hitStroke(stroke, point.x, point.y, ERASER_RADIUS)) {
            draw.erased.add(stroke.id);
          }
        }
        return true;
      }

      // A mouse reports 0 and some touchscreens report a constant; the tool's velocity simulation
      // covers those, so an out-of-range value just becomes the neutral half.
      const clamped = pressure > 0 && pressure <= 1 ? pressure : 0.5;
      points.current.push(point.x, point.y, clamped);
      return true;
    },
    [finish, getStrokes, toDesign],
  );

  const begin = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      // Only the primary button draws; right-click belongs to the browser menu.
      if (event.button !== 0) return;
      const element = event.currentTarget;
      const draw: DrawSession = {
        pointerId: event.pointerId,
        tool,
        rect: element.getBoundingClientRect(),
        erased: new Set(),
      };
      session.current = draw;
      points.current = [];

      element.setPointerCapture(event.pointerId);
      // Stops the browser turning the gesture into a scroll or a text selection. `touch-action`
      // handles touch, this handles the rest.
      event.preventDefault();
      sample(draw, event.clientX, event.clientY, event.pressure);
      publish();
    },
    [publish, sample, tool],
  );

  const move = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const draw = session.current;
      if (!draw || draw.pointerId !== event.pointerId) return;

      /*
       * Coalesced events are the samples the browser already captured but batched into this one
       * dispatch. A stylus reports far faster than the display refreshes, and reading only the
       * dispatched event throws that resolution away — fast strokes come out visibly angular.
       */
      const batch =
        typeof event.nativeEvent.getCoalescedEvents === "function"
          ? event.nativeEvent.getCoalescedEvents()
          : [];
      if (batch.length > 0) {
        for (const point of batch) {
          if (!sample(draw, point.clientX, point.clientY, point.pressure)) return;
        }
      } else if (!sample(draw, event.clientX, event.clientY, event.pressure)) {
        return;
      }
      publish();
    },
    [publish, sample],
  );

  const end = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const draw = session.current;
      if (!draw || draw.pointerId !== event.pointerId) return;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* Already released when the pointer was cancelled — nothing to do. */
      }
      finish();
    },
    [finish],
  );

  /**
   * The stroke being drawn right now, shaped like a stored one so the layer renders it through the
   * exact same path — what you see while drawing is what lands on the page.
   *
   * Note it is NOT simplified: `finalizeStroke` runs only on commit, so the live line follows the
   * hand at full resolution and the saved one is the tidied version of the same shape.
   */
  const liveStroke: NotebookInkStroke | null =
    live && live.length >= 6 && tool !== "eraser"
      ? { id: "live", tool, color, size, opacity, points: live }
      : null;

  return { begin, move, end, liveStroke, erasing };
}
