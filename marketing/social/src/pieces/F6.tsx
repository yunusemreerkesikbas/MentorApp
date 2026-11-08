import { Img, staticFile } from "remotion";
import { ART, type ArtKey } from "../art";
import { C } from "../brand";
import { COPY } from "../copy";
import { Frame } from "../components/Frame";
import { Logo } from "../components/Logo";
import { Sparkle } from "../components/Sparkle";
import { TapedNote } from "../components/TapedNote";
import type { PieceProps } from "../pieces";
import { DOT_PAPER } from "./F2";

const T = COPY.F6!;

const PANELS: { left: number; rotate: number; text: string; sticker: ArtKey; alt: string; tapeRotate: number }[] = [
  { left: 44, rotate: -2, text: T.left, sticker: "nightShift", alt: T.altLeft, tapeRotate: -5 },
  { left: 560, rotate: 2, text: T.right, sticker: "cryingLaughing", alt: T.altRight, tapeRotate: 4 },
];

export function F6({ safe }: PieceProps) {
  return (
    <Frame format="feed" background={C.cream} color={C.navy} safe={safe} style={DOT_PAPER}>
      {PANELS.map((p) => (
        <TapedNote
          key={p.sticker}
          tape={{ left: 168, top: -20, width: 140, height: 40, rotate: p.tapeRotate }}
          style={{ left: p.left, top: 120, width: 476, height: 800, padding: "44px 30px 0", borderRadius: 10, border: `1px solid ${C.dot}`, transform: `rotate(${p.rotate}deg)`, boxShadow: "0 18px 36px rgba(15, 34, 51, 0.12)" }}
        >
          <p style={{ margin: 0, fontSize: 56, fontWeight: 1000, lineHeight: 1.05, letterSpacing: "-0.03em" }}>{p.text}</p>
          <Img src={staticFile(ART[p.sticker])} alt={p.alt} style={{ position: "absolute", left: -42, bottom: -60, width: 560, height: 580, objectFit: "contain" }} />
        </TapedNote>
      ))}

      <Sparkle x={500} y={1040} size={56} color={C.yellow} />
      <Sparkle x={980} y={1060} size={40} color={C.blue} />

      <div style={{ position: "absolute", left: 0, right: 0, bottom: 64, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <Logo size={56} color="#111111" style={{ lineHeight: 1 }} />
        <span style={{ fontSize: 24, fontWeight: 900, color: C.inkBlue }}>{T.footer}</span>
      </div>
    </Frame>
  );
}
