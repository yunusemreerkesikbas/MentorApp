import type { CSSProperties } from "react";
import { Img, staticFile } from "remotion";
import { ART, type ArtKey } from "../../art";
import { C } from "../../brand";
import { COPY } from "../../copy";

const T = COPY.T1!;

// The weekly nickname as a trading card: gold border, the character art on top, a navy band with the label,
// the nickname and (once it stops) its message. The back is navy with the glasses mark.
export const CARD = { left: 230, top: 470, width: 620, height: 900 } as const;
const GOLD = "linear-gradient(145deg, #FFE9A3 0%, #E8B23A 38%, #FFF1BE 55%, #C98F1E 100%)";
const face: CSSProperties = { position: "absolute", inset: 0, boxSizing: "border-box", padding: 18, borderRadius: 34, background: GOLD, backfaceVisibility: "hidden", boxShadow: `0 16px 0 ${C.t1Ink}` };

export function TradingCard({ art, name, msg, msgScale = 1, angle = 0, style }: { art: ArtKey; name: string; msg?: string; msgScale?: number; angle?: number; style?: CSSProperties }) {
  return (
    <div style={{ position: "absolute", ...CARD, transformStyle: "preserve-3d", transform: `perspective(2400px) rotateY(${angle}deg)`, ...style }}>
      <div style={face}>
        <div style={{ position: "relative", height: "100%", borderRadius: 20, overflow: "hidden", background: C.t1Night }}>
          <Img src={staticFile(ART[art])} alt="" style={{ display: "block", width: "100%", height: 520, objectFit: "cover", objectPosition: "50% 40%" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: 500, padding: "26px 30px 0", background: C.t1Ink, textAlign: "center", color: "#FFFFFF" }}>
            <div style={{ fontSize: 26, fontWeight: 1000, letterSpacing: "0.14em", color: C.yellow }}>{T.nickLabel}</div>
            <div style={{ fontSize: 66, fontWeight: 1000, lineHeight: 1.05, marginTop: 10 }}>{name}</div>
            {msg ? <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.2, marginTop: 14, opacity: 0.92, scale: String(msgScale) }}>{msg}</div> : null}
          </div>
        </div>
      </div>
      <div style={{ ...face, transform: "rotateY(180deg)" }}>
        <div style={{ height: "100%", borderRadius: 20, background: `radial-gradient(circle at 50% 45%, #2D3C7A, ${C.t1Ink} 70%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg aria-hidden="true" viewBox="0 0 200 90" style={{ width: 320 }}>
            <circle cx="52" cy="45" r="34" fill="none" stroke={C.yellow} strokeWidth={12} />
            <circle cx="148" cy="45" r="34" fill="none" stroke={C.yellow} strokeWidth={12} />
            <path d="M86 40 Q100 30 114 40" fill="none" stroke={C.yellow} strokeWidth={10} strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
