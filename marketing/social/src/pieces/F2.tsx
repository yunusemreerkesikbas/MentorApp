import { Img, staticFile } from "remotion";
import { ART, type ArtKey } from "../art";
import { C } from "../brand";
import { COPY } from "../copy";
import { Frame } from "../components/Frame";
import { Logo } from "../components/Logo";
import { caveat } from "../fonts";
import type { PieceProps } from "../pieces";

const T = COPY.F2!;

// Krem defter: dotted cream paper.
export const DOT_PAPER = {
  backgroundColor: C.cream,
  backgroundImage: `radial-gradient(${C.dot} 2.5px, rgba(230, 222, 200, 0) 2.5px)`,
  backgroundSize: "36px 36px",
} as const;

const STICKERS: [ArtKey, number][] = [
  ["mindBlown", -8],
  ["nightShift", 6],
  ["facepalm", -4],
];

export function F2({ safe }: PieceProps) {
  return (
    <Frame format="feed" background={C.cream} color={C.navy} safe={safe} style={DOT_PAPER}>
      <div style={{ position: "absolute", left: 64, right: 40, top: 84, fontWeight: 1000, fontSize: 126, lineHeight: 1.02, letterSpacing: "-0.03em" }}>
        <p style={{ margin: 0, color: C.navy }}>{T.line1}</p>
        <p style={{ margin: 0, color: C.navy, display: "flex", alignItems: "center", gap: 4 }}>
          {STICKERS.map(([key, rotate]) => (
            <Img key={key} src={staticFile(ART[key])} alt="" style={{ width: 118, height: 118, objectFit: "contain", transform: `rotate(${rotate}deg)` }} />
          ))}
          <span style={{ marginLeft: 18 }}>{T.line2}</span>
        </p>
        <p style={{ margin: 0, color: C.blue }}>{T.line3}</p>
        <p style={{ margin: 0, color: C.blue }}>{T.line4}</p>
        <p style={{ margin: 0, color: C.blue, position: "relative" }}>
          {T.line5}
          <svg aria-hidden="true" viewBox="0 0 140 120" style={{ position: "absolute", left: 675, top: 17, width: 140, height: 120 }}>
            <path d="M120 108 C 96 70 70 46 22 30" stroke={C.inkBlue} strokeWidth="6" strokeLinecap="round" fill="none" />
            <path d="M40 14 L20 30 L44 44" stroke={C.inkBlue} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </p>
      </div>

      <p style={{ position: "absolute", left: 638, top: 738, width: 420, margin: 0, fontFamily: caveat, fontWeight: 700, fontSize: 62, lineHeight: 1, color: C.inkBlue, transform: "rotate(-3deg)" }}>
        {T.note1}
        <br />
        {T.note2}
      </p>

      <Img src={staticFile(ART.p3)} alt={T.altPuhu} style={{ position: "absolute", left: 45, top: 1099, width: 320, height: 297, objectFit: "contain" }} />

      <div style={{ position: "absolute", left: 370, right: 40, bottom: 31, height: 114, display: "flex", flexDirection: "column", gap: 8 }}>
        <Logo size={64} color="#111111" style={{ lineHeight: 1 }} />
        <span style={{ fontSize: 24, fontWeight: 900, color: C.inkBlue }}>{T.footer}</span>
      </div>
    </Frame>
  );
}
