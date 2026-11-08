import type { CSSProperties } from "react";
import { Img, staticFile } from "remotion";
import { ART } from "../art";
import { C } from "../brand";
import { COPY } from "../copy";
import { Frame } from "../components/Frame";
import { Logo } from "../components/Logo";
import { caveat } from "../fonts";
import type { PieceProps } from "../pieces";
import { DOT_PAPER } from "./F2";

const T = COPY.F5!;

// Round stamp: white fill, navy ring, exam name in brand blue. R3 stamps these on the beat.
export function ExamBadge({ exam, size, rotate, style }: { exam: string; size: number; rotate: number; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        boxSizing: "border-box",
        borderRadius: "50%",
        background: "#FFFFFF",
        border: `8px solid ${C.navy}`,
        boxShadow: `0 8px 0 ${C.navy}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `rotate(${rotate}deg)`,
        ...style,
      }}
    >
      <div style={{ position: "absolute", inset: 14, borderRadius: "50%", border: `3px dashed ${C.tint}` }} />
      <span style={{ position: "relative", fontSize: Math.round(size * 0.26), fontWeight: 1000, letterSpacing: "-0.02em", color: C.blue }}>{exam}</span>
    </div>
  );
}

// 3 + 2 stamp layout under the question.
const BADGES: { exam: string; x: number; y: number; rotate: number }[] = [
  { exam: "KPSS", x: 64, y: 372, rotate: -6 },
  { exam: "YKS", x: 324, y: 352, rotate: 4 },
  { exam: "LGS", x: 584, y: 380, rotate: -3 },
  { exam: "ALES", x: 170, y: 622, rotate: 5 },
  { exam: "DGS", x: 430, y: 640, rotate: -5 },
];

export function F5({ safe }: PieceProps) {
  return (
    <Frame format="feed" background={C.cream} color={C.navy} safe={safe} style={DOT_PAPER}>
      <div style={{ position: "absolute", left: 64, right: 40, top: 80, fontWeight: 1000, fontSize: 110, lineHeight: 1.02, letterSpacing: "-0.035em" }}>
        <p style={{ margin: 0, color: C.navy }}>{T.q1}</p>
        <p style={{ margin: 0, color: C.blue }}>{T.q2}</p>
      </div>

      {BADGES.map((b) => (
        <ExamBadge key={b.exam} exam={b.exam} size={220} rotate={b.rotate} style={{ position: "absolute", left: b.x, top: b.y }} />
      ))}

      <Img src={staticFile(ART.host)} alt={T.altPuhu} style={{ position: "absolute", left: 640, top: 560, width: 520, height: 650, objectFit: "contain", transform: "scaleX(-1)" }} />

      <p style={{ position: "absolute", left: 96, top: 910, width: 400, margin: 0, fontFamily: caveat, fontWeight: 700, fontSize: 66, lineHeight: 1, color: C.inkBlue, transform: "rotate(-3deg)" }}>{T.note}</p>

      <div style={{ position: "absolute", left: 64, bottom: 60, display: "flex", alignItems: "baseline", gap: 22 }}>
        <Logo size={60} color="#111111" style={{ lineHeight: 1 }} />
        <span style={{ fontSize: 26, fontWeight: 900, color: C.inkBlue }}>{T.footer}</span>
      </div>
    </Frame>
  );
}
