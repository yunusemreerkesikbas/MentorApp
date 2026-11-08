import type { CSSProperties } from "react";
import { WORDMARK, WORDMARK_ALIGN, WORDMARK_VIEWBOX, WORDMARK_WIDTH } from "../wordmark";

// The lowercase puhukoc wordmark (DESIGN.md §8.7): `size` px tall, one ink colour.
export function Logo({ size, color, style }: { size: number; color: string; style?: CSSProperties }) {
  return (
    <span role="img" aria-label="puhukoc" style={{ display: "inline-block", fontSize: size, lineHeight: 1, color, ...style }}>
      <svg viewBox={WORDMARK_VIEWBOX} aria-hidden="true" style={{ display: "inline-block", height: "1em", width: WORDMARK_WIDTH, verticalAlign: WORDMARK_ALIGN }}>
        <path d={WORDMARK} fill="currentColor" />
      </svg>
    </span>
  );
}
