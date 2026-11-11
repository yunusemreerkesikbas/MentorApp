import { C } from "../../brand";

// The session timer ring: scene 08's empty circle grows into it, scene 09 keeps it fixed, scene 10 grows it past
// the edges. Yellow stroke with a navy outline on both edges.
export const RING = { cx: 540, cy: 1000, r: 330, stroke: 30 } as const;

export function Ring({ r = RING.r, cy = RING.cy, stroke = RING.stroke }: { r?: number; cy?: number; stroke?: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: RING.cx - r,
        top: cy - r,
        width: r * 2,
        height: r * 2,
        boxSizing: "border-box",
        borderRadius: "50%",
        border: `${stroke}px solid ${C.yellow}`,
        boxShadow: `0 0 0 6px ${C.t1Ink}, inset 0 0 0 6px ${C.t1Ink}`,
      }}
    />
  );
}
