import { Img, staticFile } from "remotion";
import { ART } from "../art";
import { C } from "../brand";
import { COPY } from "../copy";
import { Frame } from "../components/Frame";
import { LinkGuide } from "../components/LinkGuide";
import { Logo } from "../components/Logo";
import { Sparkle } from "../components/Sparkle";
import type { PieceProps } from "../pieces";

const T = COPY.S4!;

// The split runs from (0, 1250) up to (1080, 650): night above, day below.
const SPLIT = { x0: 0, y0: 1250, x1: 1080, y1: 650 };
const LEN = Math.hypot(SPLIT.x1 - SPLIT.x0, SPLIT.y1 - SPLIT.y0);
const ANGLE = (Math.atan2(SPLIT.y1 - SPLIT.y0, SPLIT.x1 - SPLIT.x0) * 180) / Math.PI;

const label = { position: "absolute", fontSize: 52, fontWeight: 1000, padding: "12px 30px", borderRadius: 999, boxShadow: `0 7px 0 ${C.navy}` } as const;

export function S4({ guides, safe }: PieceProps) {
  return (
    <Frame format="story" background={C.blue} safe={safe}>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: C.night, clipPath: `polygon(0 0, 1080px 0, 1080px ${SPLIT.y1}px, 0 ${SPLIT.y0}px)` }} />
      <div aria-hidden="true" style={{ position: "absolute", left: SPLIT.x0, top: SPLIT.y0 - 6, width: LEN, height: 12, background: C.yellow, transformOrigin: "0 50%", transform: `rotate(${ANGLE}deg)` }} />

      <Sparkle x={70} y={590} size={40} color="#FFFFFF" />
      <Sparkle x={480} y={660} size={30} color={C.sky} />
      <Sparkle x={560} y={1250} size={60} color={C.yellow} />
      <Sparkle x={970} y={1290} size={40} color="#FFFFFF" />

      <div style={{ position: "absolute", left: 0, right: 0, top: 262, display: "flex", justifyContent: "center" }}>
        <Logo size={52} color="#FFFFFF" />
      </div>
      <div style={{ position: "absolute", left: 40, right: 40, top: 340, textAlign: "center", fontWeight: 1000, fontSize: 110, lineHeight: 0.95, letterSpacing: "-0.04em", color: "#FFFFFF" }}>
        <p style={{ margin: 0 }}>{T.q1}</p>
        <p style={{ margin: 0 }}>{T.q2}</p>
      </div>

      <Img src={staticFile(ART.nightShift)} alt={T.altNight} style={{ position: "absolute", left: 70, top: 580, width: 360, height: 388, objectFit: "contain", transform: "rotate(-5deg)" }} />
      <span style={{ ...label, left: 100, top: 950, background: "#FFFFFF", color: C.night, transform: "rotate(-4deg)" }}>{T.night}</span>

      <Img src={staticFile(ART.mindBlown)} alt={T.altDay} style={{ position: "absolute", left: 630, top: 830, width: 370, height: 383, objectFit: "contain", transform: "rotate(5deg)" }} />
      <span style={{ ...label, left: 700, top: 1210, background: C.yellow, color: C.navy, transform: "rotate(4deg)" }}>{T.day}</span>

      {guides ? (
        <LinkGuide
          show
          label={T.pollGuide}
          style={{ position: "absolute", left: 230, top: 1380, width: 620, height: 220, border: "4px dashed rgba(255, 255, 255, 0.8)", borderRadius: 28, background: "rgba(15, 34, 51, 0.25)", fontSize: 28, color: "#FFFFFF" }}
        />
      ) : null}
    </Frame>
  );
}
