import { Img, staticFile } from "remotion";
import { ART } from "../art";
import { C } from "../brand";
import { COPY } from "../copy";
import { Frame } from "../components/Frame";
import { Logo } from "../components/Logo";
import { TapedNote } from "../components/TapedNote";
import { caveat } from "../fonts";
import type { PieceProps } from "../pieces";

const T = COPY.F3!;

export function F3({ safe }: PieceProps) {
  return (
    <Frame format="feed" background={C.night} safe={safe}>
      <Img src={staticFile(ART.w2)} alt={T.altPuhu} style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 830, objectFit: "cover", objectPosition: "50% 42%" }} />

      <div style={{ position: "absolute", left: 56, right: 56, top: 56, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ display: "inline-block", background: C.yellow, color: C.navy, fontSize: 26, fontWeight: 900, letterSpacing: "0.08em", padding: "14px 28px", borderRadius: 999, transform: "rotate(-3deg)", boxShadow: `0 6px 0 ${C.navy}` }}>
          {T.badge}
        </span>
        <Logo size={48} color="#FFFFFF" />
      </div>

      <TapedNote
        tape={{ left: 95, top: -16, width: 120, height: 34, rotate: -6 }}
        style={{ right: 65, top: 467, width: 343, height: 249, padding: "34px 28px 26px", borderRadius: 6, transform: "rotate(4deg)", boxShadow: "0 18px 30px rgba(4, 10, 30, 0.35)" }}
      >
        <p style={{ margin: 0, fontFamily: caveat, fontWeight: 700, fontSize: 56, lineHeight: 0.95, width: 270, height: 114, textAlign: "center" }}>{T.note}</p>
        <p style={{ margin: "14px 0 0", fontSize: 17, fontWeight: 900, letterSpacing: "0.04em", color: C.grey }}>{T.exams}</p>
      </TapedNote>

      <div style={{ position: "absolute", left: 0, right: 0, top: 790, bottom: 0, background: C.night, borderRadius: "44px 44px 0 0" }} />

      <div style={{ position: "absolute", left: 64, right: 64, top: 850 }}>
        <h1 style={{ margin: 0, fontWeight: 1000, fontSize: 100, lineHeight: 0.95, letterSpacing: "-0.035em", color: "#FFFFFF" }}>{T.head}</h1>
        <p style={{ margin: "4px 0 0", fontWeight: 1000, fontSize: 124, lineHeight: 0.95, letterSpacing: "-0.035em", color: C.yellow }}>{T.punch}</p>
        <p style={{ margin: "26px 0 0", maxWidth: 900, fontSize: 32, fontWeight: 700, lineHeight: 1.3, color: C.mutedOnNight }}>{T.body}</p>
      </div>

      <div style={{ position: "absolute", left: 64, right: 64, bottom: 56, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: C.mutedOnNight, paddingBottom: 6 }}>{T.handle}</span>
      </div>
    </Frame>
  );
}
