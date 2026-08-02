"use client";

import { useCallback, useRef, useState } from "react";
import { animate, useReducedMotion, type AnimationPlaybackControls } from "framer-motion";

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
/** City zoom-in — content-layer motion (DESIGN.md §9), ease-out expo family. */
const ZOOM_DURATION_S = 0.48;
const ZOOM_EASE = [0.22, 1, 0.36, 1] as const;
/**
 * Pointer must move this far before pan starts. Below that, the gesture stays a click so a
 * neighbouring province remains selectable while zoomed (immediate capture was eating clicks).
 */
const DRAG_THRESHOLD_PX = 6;

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

function lerpView(from: Viewport, to: Viewport, t: number): Viewport {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    w: from.w + (to.w - from.w) * t,
    h: from.h + (to.h - from.h) * t,
  };
}

type DragState = {
  pointerId: number;
  pointerX: number;
  pointerY: number;
  view: Viewport;
  /** False until movement crosses `DRAG_THRESHOLD_PX` — keeps province clicks alive. */
  active: boolean;
};

/**
 * Zoom and pan over the SVG `viewBox`.
 *
 * The viewBox is the only thing that moves — no CSS transform, no canvas, no map library. That
 * keeps the province paths as plain static strings and leaves hit-testing native: a click lands
 * on the `<path>` the browser says it landed on, at any zoom.
 *
 * Province framing (`zoomToBox` / `reset`) tweens via Framer Motion; wheel/drag stay immediate
 * so the map never feels laggy under the finger.
 */
export function useMapViewport() {
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState<Viewport>(FULL);
  const [isPanning, setIsPanning] = useState(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  const animRef = useRef<AnimationPlaybackControls | null>(null);
  const dragRef = useRef<DragState | null>(null);
  /** After a real pan, the following click on a path must be ignored. */
  const suppressClickRef = useRef(false);

  const cancelAnimation = useCallback(() => {
    animRef.current?.stop();
    animRef.current = null;
  }, []);

  const setViewInstant = useCallback(
    (next: Viewport) => {
      cancelAnimation();
      const clamped = clamp(next);
      viewRef.current = clamped;
      setView(clamped);
    },
    [cancelAnimation],
  );

  const animateTo = useCallback(
    (next: Viewport) => {
      const to = clamp(next);
      const from = viewRef.current;
      cancelAnimation();

      if (
        reduceMotion ||
        (from.x === to.x && from.y === to.y && from.w === to.w && from.h === to.h)
      ) {
        viewRef.current = to;
        setView(to);
        return;
      }

      animRef.current = animate(0, 1, {
        duration: ZOOM_DURATION_S,
        ease: ZOOM_EASE,
        onUpdate: (t) => {
          const frame = lerpView(from, to, t);
          viewRef.current = frame;
          setView(frame);
        },
        onComplete: () => {
          animRef.current = null;
          viewRef.current = to;
          setView(to);
        },
      });
    },
    [cancelAnimation, reduceMotion],
  );

  const reset = useCallback(() => animateTo(FULL), [animateTo]);
  const isZoomed = view.w < WORLD.w;

  /** Frame a province bbox with a margin so its shape does not touch the edges. */
  const zoomToBox = useCallback(
    (bbox: [number, number, number, number]) => {
      const [x0, y0, x1, y1] = bbox;
      const boxW = x1 - x0;
      const boxH = y1 - y0;
      if (boxW <= 0 || boxH <= 0) return;

      // Match the world aspect ratio, otherwise the SVG letterboxes the province and the effective
      // zoom stops matching what the cluster sizing assumes.
      const w = Math.max(boxW, boxH * (WORLD.w / WORLD.h)) * 1.25;
      const h = w * (WORLD.h / WORLD.w);
      animateTo({
        w,
        h,
        x: (x0 + x1) / 2 - w / 2,
        y: (y0 + y1) / 2 - h / 2,
      });
    },
    [animateTo],
  );

  const zoomBy = useCallback(
    (factor: number, origin?: { x: number; y: number }, animated = false) => {
      const current = viewRef.current;
      const w = current.w * factor;
      const anchorX = origin?.x ?? current.x + current.w / 2;
      const anchorY = origin?.y ?? current.y + current.h / 2;
      // Keep the anchor pinned under the cursor: its distance to the left edge shrinks by the
      // same ratio the viewport does.
      const ratio = w / current.w;
      const next = clamp({
        w,
        h: w * (WORLD.h / WORLD.w),
        x: anchorX - (anchorX - current.x) * ratio,
        y: anchorY - (anchorY - current.y) * ratio,
      });
      if (animated) animateTo(next);
      else setViewInstant(next);
    },
    [animateTo, setViewInstant],
  );

  /** Screen point → world point, from the element's own box so it holds at any rendered size. */
  const toWorld = useCallback(
    (element: SVGSVGElement, clientX: number, clientY: number) => {
      const rect = element.getBoundingClientRect();
      const current = viewRef.current;
      return {
        x: current.x + ((clientX - rect.left) / rect.width) * current.w,
        y: current.y + ((clientY - rect.top) / rect.height) * current.h,
      };
    },
    [],
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
      // Primary button only, and only while zoomed — at country view there is nothing to pan to.
      // Do NOT capture yet: capture before the threshold turns every province tap into a pan.
      if (e.button !== 0 || !isZoomed) return;
      dragRef.current = {
        pointerId: e.pointerId,
        pointerX: e.clientX,
        pointerY: e.clientY,
        view: viewRef.current,
        active: false,
      };
    },
    [isZoomed],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;

      if (!drag.active) {
        const dist = Math.hypot(e.clientX - drag.pointerX, e.clientY - drag.pointerY);
        if (dist < DRAG_THRESHOLD_PX) return;
        drag.active = true;
        cancelAnimation();
        // Re-anchor so the first pan frame does not jump by the threshold delta.
        drag.pointerX = e.clientX;
        drag.pointerY = e.clientY;
        drag.view = viewRef.current;
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsPanning(true);
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const dx = ((e.clientX - drag.pointerX) / rect.width) * drag.view.w;
      const dy = ((e.clientY - drag.pointerY) / rect.height) * drag.view.h;
      const next = clamp({ ...drag.view, x: drag.view.x - dx, y: drag.view.y - dy });
      viewRef.current = next;
      setView(next);
    },
    [cancelAnimation],
  );

  const endDrag = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (drag.active) {
      suppressClickRef.current = true;
      setIsPanning(false);
    }
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  /** Call from path/pin click handlers; returns true when the gesture was a pan. */
  const consumeClickSuppression = useCallback(() => {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    return true;
  }, []);

  return {
    view,
    viewBox: `${view.x} ${view.y} ${view.w} ${view.h}`,
    /** 1 at country zoom, smaller as you zoom in — marks multiply by this to keep their size. */
    unit: view.w / WORLD.w,
    isZoomed,
    isPanning,
    reset,
    zoomToBox,
    zoomIn: () => zoomBy(1 / ZOOM_STEP, undefined, true),
    zoomOut: () => zoomBy(ZOOM_STEP, undefined, true),
    consumeClickSuppression,
    handlers: {
      onWheel,
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  };
}
