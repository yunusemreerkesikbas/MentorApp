import type { CSSProperties, ReactNode } from "react";
import { C } from "../brand";

export type Tape = { left: number; top: number; width: number; height: number; rotate: number };

// Paper card with a strip of yellow tape. Padding, size, rotation and shadow come from `style`.
export function TapedNote({ style, tape, children }: { style?: CSSProperties; tape: Tape; children: ReactNode }) {
  return (
    <div style={{ position: "absolute", boxSizing: "border-box", backgroundColor: C.paper, color: C.navy, ...style }}>
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: tape.left, top: tape.top, width: tape.width, height: tape.height, background: C.yellow, opacity: 0.85, transform: `rotate(${tape.rotate}deg)` }}
      />
      {children}
    </div>
  );
}
