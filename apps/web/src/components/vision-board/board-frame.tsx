import type { CSSProperties, ReactNode } from "react";
import type { VisionBoardFrame } from "@mentor/types";
import { BOARD_FRAME_MAT, BOARD_FRAME_METRICS, WOOD_GRAIN } from "./board-export-layout";

/**
 * The frame the board hangs in. Pure CSS, three presets — no image asset, so it stays sharp at
 * every size, follows the theme, and the canvas exporter can redraw it as four rectangles instead
 * of slicing a texture.
 *
 * Sizes are in `cqw` so the frame keeps its proportions against the board rather than against the
 * viewport: a thumbnail in the panel card gets a thumbnail-sized frame, not a hairline.
 *
 * That only holds because the size container is a wrapper of its own. A container's `cqw` lengths
 * on itself resolve against the container *above* it, and with none above, against the viewport:
 * while the moulding sat on the container element, it was 2.2% of the window, not of the board.
 */

interface FramePreset {
  /** Outer moulding. */
  border: string;
  /** Gallery mat between moulding and artwork. */
  mat: string;
  matColor: string;
  radius: string;
  shadow: string;
  background: string;
}

/** A share of the framed board's width, as the `cqw` length that draws it. */
function cqw(share: number): string {
  return `${Number((share * 100).toFixed(3))}cqw`;
}

/*
 * Thicknesses, the wood grain and the mat colours come from `board-export-layout.ts`, the table
 * the exporter reads too. What stays here is what only the screen has: a shadow, and for the
 * gallery frame a moulding and a corner that follow the theme.
 */
const PRESETS: Record<VisionBoardFrame, FramePreset> = {
  wood: {
    border: cqw(BOARD_FRAME_METRICS.wood.border),
    mat: cqw(BOARD_FRAME_METRICS.wood.mat),
    matColor: BOARD_FRAME_MAT.wood,
    radius: cqw(BOARD_FRAME_METRICS.wood.radius),
    shadow: "0 1.2cqw 2.6cqw rgba(37, 73, 150, 0.18)",
    background: `linear-gradient(${WOOD_GRAIN.angle}deg, ${WOOD_GRAIN.stops
      .map(([at, color]) => `${color} ${at * 100}%`)
      .join(", ")})`,
  },
  gallery: {
    border: cqw(BOARD_FRAME_METRICS.gallery.border),
    mat: cqw(BOARD_FRAME_METRICS.gallery.mat),
    matColor: BOARD_FRAME_MAT.gallery,
    radius: "var(--radius-card)",
    shadow: "var(--shadow-card)",
    background: "color-mix(in srgb, var(--color-main) 12%, transparent)",
  },
  none: {
    border: "0cqw",
    mat: "0cqw",
    matColor: "transparent",
    radius: "var(--radius-card)",
    shadow: "var(--shadow-card)",
    background: "transparent",
  },
};

export interface BoardFrameProps {
  frame: VisionBoardFrame;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /**
   * Multiplies the moulding and the mat. The editor's frame picker draws them heavier than scale:
   * true to scale, a 2% moulding on an 80px tile is a hairline nobody can tell from its neighbour.
   */
  thickness?: number;
}

export function BoardFrame({ frame, children, className, style, thickness = 1 }: BoardFrameProps) {
  const preset = PRESETS[frame];
  return (
    <div className={className} style={{ containerType: "inline-size", ...style }}>
      <div
        style={{
          padding: `calc(${preset.border} * ${thickness})`,
          borderRadius: preset.radius,
          background: preset.background,
          boxShadow: preset.shadow,
        }}
      >
        <div
          style={{
            padding: `calc(${preset.mat} * ${thickness})`,
            backgroundColor: preset.matColor,
            borderRadius: `calc(${preset.radius} / 2)`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
