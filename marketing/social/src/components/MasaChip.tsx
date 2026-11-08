import type { CSSProperties } from "react";
import { C } from "../brand";

// "Masada N kişi" pill with a green live dot; spacing scales with the font size.
export function MasaChip({
  count,
  fontSize,
  background = C.tint2,
  style,
}: {
  count: number;
  fontSize: number;
  background?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: Math.round(fontSize * 0.4),
        background,
        color: C.tintInk,
        fontSize,
        fontWeight: 1000,
        padding: `${fontSize / 2}px ${fontSize * 0.9}px`,
        borderRadius: 999,
        ...style,
      }}
    >
      <span aria-hidden="true" style={{ width: Math.round(fontSize * 0.55), height: Math.round(fontSize * 0.55), borderRadius: "50%", background: "#22C55E" }} />
      Masada {count} kişi
    </span>
  );
}
