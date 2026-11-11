import type { CSSProperties } from "react";
import { C } from "../../brand";

// A paper plan card as in the app's "Şehrin üstünde" notes (`.pcs-paper` + `.pcs-tape`).
export function PlanCard({ text, style }: { text: string; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        padding: "30px 40px 26px",
        background: C.paper,
        color: C.navy,
        borderRadius: "10px 10px 18px 18px",
        boxShadow: "0 6px 10px rgba(3, 10, 24, 0.2), 0 40px 60px -24px rgba(3, 10, 24, 0.75)",
        fontSize: 46,
        fontWeight: 1000,
        lineHeight: 1,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <div aria-hidden="true" style={{ position: "absolute", left: "50%", top: -16, width: 150, height: 40, marginLeft: -75, borderRadius: 4, background: "rgba(255, 224, 138, 0.88)", rotate: "-3deg" }} />
      {text}
    </div>
  );
}
