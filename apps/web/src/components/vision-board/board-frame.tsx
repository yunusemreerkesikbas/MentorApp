import type { CSSProperties, ReactNode } from "react";
import type { VisionBoardFrame } from "@mentor/types";

/**
 * The frame the board hangs in. Pure CSS, three presets — no image asset, so it stays sharp at
 * every size, follows the theme, and the canvas exporter can redraw it as four rectangles instead
 * of slicing a texture.
 *
 * Sizes are in `cqw` so the frame keeps its proportions against the board rather than against the
 * viewport: a thumbnail in the panel card gets a thumbnail-sized frame, not a hairline.
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

const PRESETS: Record<VisionBoardFrame, FramePreset> = {
  wood: {
    border: "2.2cqw",
    mat: "2.6cqw",
    matColor: "#fbfaf8",
    radius: "0.5cqw",
    shadow: "0 1.2cqw 2.6cqw rgba(37, 73, 150, 0.18)",
    // Alternating stops of one hue read as grain at a glance; a photographic wood texture scaled
    // down to a 20px moulding just looks like noise.
    background:
      "linear-gradient(100deg, #c99a5f 0%, #e0b782 18%, #c08a4c 42%, #dcb17c 68%, #b8813f 100%)",
  },
  gallery: {
    border: "0.6cqw",
    mat: "3.4cqw",
    matColor: "#ffffff",
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
}

export function BoardFrame({ frame, children, className, style }: BoardFrameProps) {
  const preset = PRESETS[frame];
  return (
    <div
      className={className}
      style={{
        containerType: "inline-size",
        padding: preset.border,
        borderRadius: preset.radius,
        background: preset.background,
        boxShadow: preset.shadow,
        ...style,
      }}
    >
      <div
        style={{
          padding: preset.mat,
          backgroundColor: preset.matColor,
          borderRadius: `calc(${preset.radius} / 2)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
