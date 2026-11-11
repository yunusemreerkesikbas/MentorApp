import type { CSSProperties } from "react";
import { C } from "../../brand";

// The question slip that shoots out of Puhu's book (scene 10) and lands in the notebook (scene 11): a torn paper
// strip with a big question mark and three ruled lines. No words, so it reads at any size.
export const SLIP = { width: 460, height: 190 } as const;

export function QuestionSlip({ style }: { style?: CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        width: SLIP.width,
        height: SLIP.height,
        boxSizing: "border-box",
        background: C.paper,
        borderRadius: 10,
        boxShadow: `0 10px 0 ${C.t1Ink}`,
        ...style,
      }}
    >
      <div style={{ position: "absolute", left: 26, top: 24, width: 120, height: 142, borderRadius: 18, background: C.blue, color: "#FFFFFF", fontSize: 120, fontWeight: 1000, lineHeight: "142px", textAlign: "center" }}>?</div>
      {[48, 92, 136].map((y, i) => (
        <div key={y} style={{ position: "absolute", left: 172, top: y, width: i === 2 ? 170 : 250, height: 14, borderRadius: 7, background: C.dot }} />
      ))}
    </div>
  );
}
