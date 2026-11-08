import { Img, staticFile } from "remotion";
import { ART } from "../art";
import { C } from "../brand";
import { COPY } from "../copy";
import { Frame } from "../components/Frame";
import { Logo } from "../components/Logo";
import { Phone } from "../components/Phone";
import { Sparkle } from "../components/Sparkle";
import type { PieceProps } from "../pieces";
import { F1Screen, MasaPopOut } from "./F1";

const T = COPY.X1!;

// F1 in landscape for X: headline left, phone + P1 right.
export function X1({ safe }: PieceProps) {
  return (
    <Frame format="landscape" background={C.blue} safe={safe}>
      <div aria-hidden="true" style={{ position: "absolute", left: 380, top: 300, width: 620, height: 620, borderRadius: "50%", background: "#FFFFFF", opacity: 0.08 }} />
      <Sparkle x={640} y={70} size={56} color={C.yellow} />
      <Sparkle x={1110} y={500} size={34} color={C.sky} />

      <Logo size={40} color="#FFFFFF" style={{ position: "absolute", left: 48, top: 48 }} />
      <span style={{ position: "absolute", right: 48, top: 48, background: C.yellow, color: C.navy, fontSize: 20, fontWeight: 900, letterSpacing: "0.08em", padding: "10px 20px", borderRadius: 999, transform: "rotate(-4deg)", boxShadow: `0 5px 0 ${C.navy}` }}>
        {T.badge}
      </span>

      <div style={{ position: "absolute", left: 48, top: 112 }}>
        <h1 style={{ margin: 0, fontWeight: 1000, fontSize: 96, lineHeight: 0.9, letterSpacing: "-0.035em", color: "#FFFFFF" }}>
          {T.head1}
          <br />
          {T.head2}
        </h1>
        <p style={{ margin: "8px 0 0 -3px", fontWeight: 1000, fontSize: 130, lineHeight: 0.9, letterSpacing: "-0.04em", color: C.yellow, transform: "rotate(-3deg)", transformOrigin: "left center" }}>{T.punch}</p>
        <svg aria-hidden="true" viewBox="0 0 640 40" style={{ display: "block", width: 430, height: 27, marginTop: 4 }}>
          <path d="M6 28 C160 8 340 6 634 18" stroke={C.yellow} strokeWidth="9" strokeLinecap="round" fill="none" />
        </svg>
      </div>

      <p style={{ position: "absolute", left: 48, top: 500, margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: "0.06em", color: C.tint }}>{T.exams}</p>
      <div style={{ position: "absolute", left: 48, bottom: 48, display: "flex", alignItems: "baseline", gap: 14 }}>
        <span style={{ fontSize: 34, fontWeight: 1000, color: "#FFFFFF" }}>{T.site}</span>
        <span style={{ fontSize: 22, fontWeight: 800, color: C.tint }}>{T.handle}</span>
      </div>

      <Phone
        width={300}
        screenBg={C.screen}
        style={{ left: 820, top: 150, transform: "rotate(4deg)", filter: "drop-shadow(0 24px 30px rgba(6, 14, 40, 0.45))" }}
        screen={<F1Screen />}
        popOut={<MasaPopOut />}
      />
      <Img src={staticFile(ART.p1)} alt={T.altPuhu} style={{ position: "absolute", left: 560, top: 330, width: 330, height: 331, objectFit: "contain", transform: "scaleX(-1)" }} />
    </Frame>
  );
}
