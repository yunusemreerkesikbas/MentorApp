import { Img, staticFile } from "remotion";
import { ART } from "../art";
import { C } from "../brand";
import { COPY } from "../copy";
import { Frame } from "../components/Frame";
import { Logo } from "../components/Logo";
import type { PieceProps } from "../pieces";

const T = COPY.L1!;

// LinkedIn card, Companion register: calm, no sparkles or stamps.
export function L1({ safe }: PieceProps) {
  return (
    <Frame format="landscape" background={C.night} safe={safe}>
      <Img src={staticFile(ART.w2)} alt={T.altArt} style={{ position: "absolute", left: 600, top: 0, width: 600, height: 675, objectFit: "cover", objectPosition: "50% 40%" }} />
      <div aria-hidden="true" style={{ position: "absolute", left: 600, top: 0, width: 140, height: 675, background: `linear-gradient(90deg, ${C.night}, rgba(11, 22, 54, 0))` }} />

      <Logo size={36} color="#FFFFFF" style={{ position: "absolute", left: 48, top: 48 }} />

      <div style={{ position: "absolute", left: 48, top: 120, width: 520 }}>
        <h1 style={{ margin: 0, fontWeight: 1000, fontSize: 64, lineHeight: 1.02, letterSpacing: "-0.03em", color: "#FFFFFF" }}>{T.title}</h1>
        <p style={{ margin: "24px 0 0", fontSize: 26, fontWeight: 700, lineHeight: 1.45, color: C.mutedOnNight }}>{T.body}</p>
      </div>

      <p style={{ position: "absolute", left: 48, bottom: 48, margin: 0, fontSize: 30, fontWeight: 900, color: "#FFFFFF" }}>{T.site}</p>
    </Frame>
  );
}
