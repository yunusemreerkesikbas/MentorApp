import type { CSSProperties } from "react";
import {
  VISION_BOARD_CANVAS,
  type VisionBoardImageItem,
  type VisionBoardItem,
  type VisionBoardTextItem,
  type VisionImageFrame,
} from "@mentor/types";
import { boardImageSrc, needsCrossOrigin } from "./board-export-layout";
import { STICKER_ART } from "./board-stickers";

/**
 * One item on the board.
 *
 * Every length is expressed in `cqw` against the stage's container, so the same document renders
 * at any width — full-bleed editor, panel-card thumbnail — with no measurement and no
 * ResizeObserver. `cqw` is a share of the container's WIDTH, and the stage has a fixed aspect
 * ratio, so dividing both axes by the canvas width keeps the composition proportional.
 */

/** px in the 1620-wide design space → a container-relative length. */
export function cq(px: number): string {
  return `${(px / VISION_BOARD_CANVAS.width) * 100}cqw`;
}

export const FONT_STACKS: Record<VisionBoardTextItem["font"], string> = {
  body: "var(--font-body)",
  heading: "var(--font-vision-heading, sans-serif)",
  script: "var(--font-script, cursive)",
  serif: "var(--font-vision-serif, serif)",
  rounded: "var(--font-vision-rounded, sans-serif)",
  condensed: "var(--font-vision-condensed, sans-serif)",
  classic: "var(--font-vision-classic, serif)",
};

/** Chrome around a photo. Each preset must be drawable by the canvas exporter too — keep it simple. */
function frameStyle(frame: VisionImageFrame): CSSProperties {
  switch (frame) {
    case "polaroid":
      // Heavier bottom edge is the whole tell of a Polaroid; equal padding just looks matted.
      return {
        backgroundColor: "#ffffff",
        padding: `${cq(14)} ${cq(14)} ${cq(52)}`,
        boxShadow: `0 ${cq(8)} ${cq(20)} rgba(37, 73, 150, 0.22)`,
      };
    case "white":
      return {
        backgroundColor: "#ffffff",
        padding: cq(12),
        boxShadow: `0 ${cq(6)} ${cq(16)} rgba(37, 73, 150, 0.18)`,
      };
    case "rounded":
      return {
        borderRadius: cq(28),
        overflow: "hidden",
        boxShadow: `0 ${cq(6)} ${cq(16)} rgba(37, 73, 150, 0.18)`,
      };
    case "tape":
      return { boxShadow: `0 ${cq(5)} ${cq(14)} rgba(37, 73, 150, 0.16)` };
    case "none":
    default:
      return {};
  }
}

function ImageItemView({ item }: { item: VisionBoardImageItem }) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", ...frameStyle(item.frame) }}>
      {item.frame === "tape" ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: cq(-16),
            left: "50%",
            width: cq(120),
            height: cq(38),
            transform: "translateX(-50%) rotate(-4deg)",
            // Washi tape: translucent so the photo shows through, which is what sells it as tape
            // rather than a painted rectangle.
            backgroundColor: "rgba(255, 236, 179, 0.72)",
            boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.04)",
          }}
        />
      ) : null}
      {item.url ? (
        /*
         * Plain <img>, not next/image: the canvas exporter needs `crossOrigin="anonymous"` to read
         * these pixels back out, and next/image does not forward that prop. Same call the forum
         * attachment gallery makes.
         */
        // eslint-disable-next-line @next/next/no-img-element -- next/image drops `crossOrigin`
        <img
          src={boardImageSrc(item.url)}
          alt=""
          crossOrigin={needsCrossOrigin(item.url) ? "anonymous" : undefined}
          loading="lazy"
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "var(--color-surface-container)",
          }}
        />
      )}
    </div>
  );
}

function TextItemView({ item }: { item: VisionBoardTextItem }) {
  const background = item.background;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent:
          item.align === "left" ? "flex-start" : item.align === "right" ? "flex-end" : "center",
      }}
    >
      <span
        style={{
          fontFamily: FONT_STACKS[item.font],
          fontSize: cq(item.size),
          fontWeight: item.bold ? 700 : 400,
          fontStyle: item.italic ? "italic" : "normal",
          color: item.color,
          textAlign: item.align,
          lineHeight: item.lineHeight,
          letterSpacing: cq(item.letterSpacing),
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          ...(background
            ? {
                backgroundColor: background.color,
                opacity: undefined,
                padding: `${cq(background.padding * 0.6)} ${cq(background.padding)}`,
                borderRadius: cq(background.radius),
                // Plate transparency is its own control: fading the whole block would fade the
                // words with it, and a washed-out label is not what "soften the plate" means.
                boxShadow: `inset 0 0 0 9999px rgba(255,255,255,${1 - background.opacity})`,
              }
            : null),
        }}
      >
        {item.text}
      </span>
    </div>
  );
}

export function BoardItemView({ item }: { item: VisionBoardItem }) {
  if (item.kind === "image") return <ImageItemView item={item} />;
  if (item.kind === "text") return <TextItemView item={item} />;
  const art = STICKER_ART[item.asset];
  return art.kind === "image" ? (
    // eslint-disable-next-line @next/next/no-img-element -- same-origin mascot PNG the exporter reads
    <img
      src={art.src}
      alt=""
      draggable={false}
      style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
    />
  ) : (
    <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}>
      <path d={art.path} fill={art.fill} />
    </svg>
  );
}
