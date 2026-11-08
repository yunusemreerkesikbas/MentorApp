import type { CSSProperties } from "react";

export function Sparkle({ x, y, size, color, style }: { x: number; y: number; size: number; color: string; style?: CSSProperties }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" style={{ position: "absolute", left: x, top: y, width: size, height: size, ...style }}>
      <path d="M50 0 C55 35 65 45 100 50 C65 55 55 65 50 100 C45 65 35 55 0 50 C35 45 45 35 50 0 Z" fill={color} />
    </svg>
  );
}
