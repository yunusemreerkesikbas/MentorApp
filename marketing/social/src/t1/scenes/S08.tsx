import { Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ART } from "../../art";
import { C } from "../../brand";
import { Phone } from "../../components/Phone";
import { COPY } from "../../copy";
import { caveat } from "../../fonts";
import { countAt, pop, SNAPPY } from "../../motion";
import { PlanCard } from "../parts/PlanCard";
import { Ring, RING } from "../parts/Ring";
import { StickerWords } from "../parts/StickerWords";
import { Sunburst } from "../parts/Sunburst";
import { EVENTS } from "../timeline";
import { CARDS } from "./S07";

const T = COPY.T1!;
const E = EVENTS["08"];
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Positions in the 378×822 screen box, measured on the captures (×3 px).
const BOXES = [441, 534, 615]; // checkbox tops, left 55, 24 px square
const TICKS = [E.tick1!, E.tick2!, E.tick3!];
const BAR = { left: 37, top: 289, width: 288, height: 7.5 };
const SCREEN_IN = { x: 540, y: 1100 }; // where the cards dive into the phone

function Tick({ top, scale }: { top: number; scale: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" style={{ position: "absolute", left: 55, top, width: 24, height: 24, scale: String(scale) }}>
      <rect x="0" y="0" width="24" height="24" rx="6" fill={C.blue} />
      <path d="M6 12.5 L10.5 17 L18 8" fill="none" stroke="#FFFFFF" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// The plan screen: the real capture, coded ticks one per beat, the counter and bar following them.
function PlanScreen() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const done = countAt(frame, TICKS);
  const fill = spring({ frame: frame - (TICKS[done - 1] ?? 0), fps, config: SNAPPY, from: Math.max(0, done - 1) / 3, to: done / 3 });
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 378, height: 822 }}>
      <Img src={staticFile(ART.t1ScreenPlan)} alt="" style={{ position: "absolute", inset: 0, width: 378, height: 822 }} />
      <div style={{ position: "absolute", left: 35, top: 262, width: 120, height: 22, background: "#FFFFFF", fontSize: 15.5, fontWeight: 500, lineHeight: "22px", color: "#1C1F26" }}>{`${done} / 3 tamamlandı`}</div>
      <div style={{ position: "absolute", left: 290, top: 262, width: 37, height: 22, background: "#FFFFFF", fontSize: 15.5, fontWeight: 500, lineHeight: "22px", textAlign: "right", color: "#666666" }}>{`%${Math.round((done / 3) * 100)}`}</div>
      <div style={{ position: "absolute", ...BAR, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(1, fill) * 100}%`, height: "100%", borderRadius: 4, background: C.blue }} />
      </div>
      {BOXES.map((top, i) => (frame >= TICKS[i]! ? <Tick key={top} top={top} scale={pop(frame, fps, TICKS[i]!)} /> : null))}
    </div>
  );
}

// Transitions 4 and 5: the plan cards dive into the phone; ticks land, the screen slides to the deneme result,
// the next-topic chip pops, and an empty circle grows into the session ring.
export function S08() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slide = interpolate(frame, [E.slide!, E.slide! + 10], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const flash = interpolate(frame, [10, 13, 22], [0, 0.85, 0], clamp);
  const grow = interpolate(frame, [E.circle!, E.circle! + 15], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  return (
    <div style={{ position: "absolute", inset: 0, background: C.blue }}>
      <Sunburst cx={50} cy={58} />
      <Phone
        width={700}
        screenBg="#F5F7FB"
        style={{ left: 190, top: 470, filter: "drop-shadow(0 30px 40px rgba(14, 22, 60, 0.45))" }}
        screen={
          <>
            <div style={{ position: "absolute", inset: 0, translate: `${-378 * slide}px 0` }}>
              <PlanScreen />
              <Img src={staticFile(ART.t1ScreenDeneme)} alt="" style={{ position: "absolute", left: 378, top: 0, width: 378, height: 822 }} />
            </div>
            <div style={{ position: "absolute", inset: 0, background: "#FFFFFF", opacity: flash }} />
          </>
        }
      />
      {CARDS.map((c, i) => {
        const p = interpolate(frame, [i * 2, i * 2 + 12], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
        return p < 1 ? (
          <PlanCard
            key={c.text}
            text={c.text}
            style={{ left: c.x, top: c.y, zIndex: 2, translate: `${(SCREEN_IN.x - c.x - 230) * p}px ${(SCREEN_IN.y - c.y - 55) * p}px`, scale: String(1 - 0.85 * p), rotate: `${c.rot * (1 - p)}deg` }}
          />
        ) : null;
      })}
      {frame >= E.spell! ? (
        <div
          style={{
            position: "absolute",
            left: 620,
            top: 500,
            width: 360,
            boxSizing: "border-box",
            padding: "26px 24px 22px",
            background: C.paper,
            boxShadow: `0 10px 0 ${C.t1Ink}`,
            fontFamily: caveat,
            fontWeight: 700,
            fontSize: 58,
            lineHeight: 1,
            textAlign: "center",
            color: C.t1Ink,
            rotate: "6deg",
            scale: String(pop(frame, fps, E.spell!)),
          }}
        >
          <div aria-hidden="true" style={{ position: "absolute", left: 105, top: -16, width: 150, height: 38, background: C.yellow, opacity: 0.85, rotate: "-4deg" }} />
          {T.spell}
        </div>
      ) : null}
      <StickerWords lines={[T.screens1!, T.screens2!]} top={250} at={[E.slide!, E.next!]} size={76} />
      {frame >= E.next! ? (
        <div
          style={{
            position: "absolute",
            left: 250,
            top: 1390,
            padding: "18px 34px",
            borderRadius: 999,
            background: C.yellow,
            color: C.t1Ink,
            fontSize: 52,
            fontWeight: 1000,
            lineHeight: 1,
            whiteSpace: "nowrap",
            boxShadow: `0 8px 0 ${C.t1Ink}`,
            rotate: "-3deg",
            scale: String(pop(frame, fps, E.next!)),
          }}
        >
          {T.next}
        </div>
      ) : null}
      {grow > 0 ? <Ring r={RING.r * grow} cy={interpolate(grow, [0, 1], [SCREEN_IN.y, RING.cy])} stroke={RING.stroke * Math.max(grow, 0.3)} /> : null}
    </div>
  );
}
