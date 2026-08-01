"use client";

import { useCallback, useRef, useState } from "react";

export interface Viewport {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** World size the province paths were generated in. */
const WORLD = { w: 1000, h: 420 } as const;
/** Deepest zoom: ~25x is enough to separate universities inside one city. */
const MIN_WIDTH = 40;
const ZOOM_STEP = 1.3;

const FULL: Viewport = { x: 0, y: 0, w: WORLD.w, h: WORLD.h };

function clamp(view: Viewport): Viewport {
  // Never zoom out past the whole country, and never pan it off screen: the map has hard edges,
  // and letting the user lose it entirely is a dead end they have to guess their way out of.
  const w = Math.min(WORLD.w, Math.max(MIN_WIDTH, view.w));
  const h = w * (WORLD.h / WORLD.w);
  return {
    w,
    h,
    x: Math.min(Math.max(0, view.x), WORLD.w - w),
    y: Math.min(Math.max(0, view.y), WORLD.h - h),
  };
}

/**
 * Zoom and pan over the SVG `viewBox`.
 *
 * The viewBox is the only thing that moves — no CSS transform, no canvas, no map library. That
 * keeps the province paths as plain static strings and leaves hit-testing native: a click lands
 * on the `<path>` the browser says it landed on, at any zoom.
 */
export function useMapViewport() {
  const [view, setView] = useState<Viewport>(FULL);
  const dragRef = useRef<{
    pointerX: number;
    pointerY: number;
    view: Viewport;
  } | null>(null);

  const reset = useCallback(() => setView(FULL), []);
  const isZoomed = view.w < WORLD.w;

  /** Frame a province bbox with a margin so its shape does not touch the edges. */
  const zoomToBox = useCallback((bbox: [number, number, number, number]) => {
    const [x0, y0, x1, y1] = bbox;
    const boxW = x1 - x0;
    const boxH = y1 - y0;
    if (boxW <= 0 || boxH <= 0) return;

    // Match the world aspect ratio, otherwise the SVG letterboxes the province and the effective
    // zoom stops matching what the cluster sizing assumes.
    const w = Math.max(boxW, boxH * (WORLD.w / WORLD.h)) * 1.25;
    const h = w * (WORLD.h / WORLD.w);
    setView(
      clamp({
        w,
        h,
        x: (x0 + x1) / 2 - w / 2,
        y: (y0 + y1) / 2 - h / 2,
      }),
    );
  }, []);

  const zoomBy = useCallback(
    (factor: number, origin?: { x: number; y: number }) => {
      setView((current) => {
        const w = current.w * factor;
        const anchorX = origin?.x ?? current.x + current.w / 2;
        const anchorY = origin?.y ?? current.y + current.h / 2;
        // Keep the anchor pinned under the cursor: its distance to the left edge shrinks by the
        // same ratio the viewport does.
        const ratio = w / current.w;
        return clamp({
          w,
          h: w * (WORLD.h / WORLD.w),
          x: anchorX - (anchorX - current.x) * ratio,
          y: anchorY - (anchorY - current.y) * ratio,
        });
      });
    },
    [],
  );

  /** Screen point → world point, from the element's own box so it holds at any rendered size. */
  const toWorld = useCallback(
    (element: SVGSVGElement, clientX: number, clientY: number) => {
      const rect = element.getBoundingClientRect();
      return {
        x: view.x + ((clientX - rect.left) / rect.width) * view.w,
        y: view.y + ((clientY - rect.top) / rect.height) * view.h,
      };
    },
    [view],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      const origin = toWorld(e.currentTarget, e.clientX, e.clientY);
      zoomBy(e.deltaY > 0 ? ZOOM_STEP : 1 / ZOOM_STEP, origin);
    },
    [toWorld, zoomBy],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      // Primary button only, and only while zoomed — at country view there is nothing to pan to,
      // and swallowing the gesture there would break plain clicking on a province.
      if (e.button !== 0 || !isZoomed) return;
      dragRef.current = { pointerX: e.clientX, pointerY: e.clientY, view };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [isZoomed, view],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = ((e.clientX - drag.pointerX) / rect.width) * drag.view.w;
    const dy = ((e.clientY - drag.pointerY) / rect.height) * drag.view.h;
    setView(clamp({ ...drag.view, x: drag.view.x - dx, y: drag.view.y - dy }));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  return {
    view,
    viewBox: `${view.x} ${view.y} ${view.w} ${view.h}`,
    /** 1 at country zoom, smaller as you zoom in — marks multiply by this to keep their size. */
    unit: view.w / WORLD.w,
    isZoomed,
    reset,
    zoomToBox,
    zoomIn: () => zoomBy(1 / ZOOM_STEP),
    zoomOut: () => zoomBy(ZOOM_STEP),
    handlers: {
      onWheel,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
