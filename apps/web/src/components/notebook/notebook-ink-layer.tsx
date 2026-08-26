"use client";

import { memo } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { NotebookInkStroke } from "@mentor/types";
import { NOTEBOOK_PAGE_CANVAS } from "@mentor/types";
import { INK_TOOLS, strokeToPath } from "@/lib/notebook-ink";

/**
 * The ink on a page: one SVG in the page's own design space, sitting above the item stage.
 *
 * SVG rather than `<canvas>` because the surface it covers is already a scaled design space —
 * `NotebookPageStage` places every item in 1080×1527 A4 units and lets the container size decide the
 * pixels. A canvas would need its backing store resized and every stroke repainted on each layout
 * change, and would come out soft on a high-DPI screen unless that were handled too. A `viewBox`
 * gets all of it for free, and stays sharp when the page is printed or zoomed.
 *
 * perfect-freehand and the fountain nib both return a filled *outline*, not a centre line, so every
 * stroke is a `fill` — `stroke`/`stroke-width` are deliberately unused here.
 *
 * Ceiling: this is a path per stroke, and the document caps ink at 200 of them. That renders
 * smoothly; a page allowed thousands would want tiling or a raster cache instead.
 */

const InkPath = memo(function InkPath({
  stroke,
  fading,
}: {
  stroke: NotebookInkStroke;
  /** True while the eraser is sweeping over it — committed only when the pointer lifts. */
  fading?: boolean;
}) {
  const path = strokeToPath(stroke);
  if (!path) return null;
  return (
    <path
      d={path}
      fill={stroke.color}
      fillOpacity={fading ? stroke.opacity * 0.25 : stroke.opacity}
      // `evenodd` so a stroke that loops back over itself does not punch a hole where it crosses.
      fillRule="evenodd"
      style={{ mixBlendMode: INK_TOOLS[stroke.tool].blend }}
    />
  );
});

export interface NotebookInkLayerProps {
  strokes: NotebookInkStroke[];
  /** The stroke under the pointer right now, drawn on top of the committed ones. */
  liveStroke?: NotebookInkStroke | null;
  /** Ids the eraser is currently over, faded to preview what lifting the finger will remove. */
  erasing?: ReadonlySet<string>;
  /**
   * Passing the pointer handlers is what turns the layer from a picture into a drawing surface.
   * Without them it stays `pointer-events: none`, so taps fall through to the cards underneath and
   * the notebook behaves exactly as it did before drawing existed.
   */
  onPointerDown?: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<SVGSVGElement>) => void;
}

export function NotebookInkLayer({
  strokes,
  liveStroke,
  erasing,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: NotebookInkLayerProps) {
  const drawable = Boolean(onPointerDown);

  if (!drawable && strokes.length === 0) return null;

  return (
    <svg
      viewBox={`0 0 ${NOTEBOOK_PAGE_CANVAS.width} ${NOTEBOOK_PAGE_CANVAS.height}`}
      // Decorative to a screen reader either way: the ink is the student's own marks, and there is
      // nothing truthful to announce about a shape somebody drew freehand.
      aria-hidden
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: drawable ? "auto" : "none",
        // Without this the browser claims a touch-drag as a page scroll before the first
        // `pointermove` ever arrives, and the stroke comes out as a single dot.
        touchAction: drawable ? "none" : undefined,
        cursor: drawable ? "crosshair" : undefined,
      }}
    >
      {strokes.map((stroke) => (
        <InkPath key={stroke.id} stroke={stroke} fading={erasing?.has(stroke.id)} />
      ))}
      {liveStroke ? <InkPath stroke={liveStroke} /> : null}
    </svg>
  );
}
