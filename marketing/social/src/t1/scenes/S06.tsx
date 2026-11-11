import type { CSSProperties } from "react";
import { Img, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ART, type ArtKey } from "../../art";
import { C } from "../../brand";
import { COPY } from "../../copy";
import { caveat } from "../../fonts";
import { pop, shake, slam } from "../../motion";
import { CareerSticker } from "../parts/CareerSticker";
import { Sunburst } from "../parts/Sunburst";
import { EVENTS } from "../timeline";

const T = COPY.T1!;
const E = EVENTS["06"];

const BOARD = { left: 110, top: 590, width: 860, height: 900 } as const;
const POLAROIDS: { art: ArtKey; caption: string; at: number; x: number; y: number; tilt: number }[] = [
  { art: "t1Board1", caption: T.pol1!, at: E.pol1!, x: 150, y: 630, tilt: -6 },
  { art: "t1Board2", caption: T.pol2!, at: E.pol2!, x: 630, y: 620, tilt: 5 },
  { art: "t1Board3", caption: T.pol3!, at: E.pol3!, x: 145, y: 1130, tilt: 4 },
  { art: "t1Board4", caption: T.pol4!, at: E.pol4!, x: 625, y: 1120, tilt: -5 },
];

const Pin = ({ x, y }: { x: number; y: number }) => (
  <div style={{ position: "absolute", left: x - 14, top: y - 14, width: 28, height: 28, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #FF8A8A, #D93F4C 60%)", boxShadow: "0 4px 4px rgba(0, 0, 0, 0.3)", zIndex: 3 }} />
);

function Polaroid({ art, caption, style }: { art: ArtKey; caption: string; style: CSSProperties }) {
  return (
    <div style={{ position: "absolute", width: 300, boxSizing: "border-box", padding: "16px 16px 0", background: "#FFFFFF", boxShadow: "0 10px 18px rgba(40, 24, 8, 0.35)", ...style }}>
      <Img src={staticFile(ART[art])} alt="" style={{ display: "block", width: 268, height: 250, objectFit: "cover" }} />
      <div style={{ fontFamily: caveat, fontWeight: 700, fontSize: 46, lineHeight: "64px", textAlign: "center", color: C.t1Ink }}>{caption}</div>
    </div>
  );
}

// PLANLA: a vision board drops on a string and nail and fills one beat at a time; the Kodcu sticker lands on the goal.
export function S06() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drop = spring({ frame: frame - E.board!, fps, config: { damping: 12, stiffness: 220, mass: 0.7 }, from: -1500, to: 0 });
  const swing = frame > 8 ? 2.2 * Math.exp(-(frame - 8) / 14) * Math.sin((frame - 8) / 3) : 0;
  const kodcuFly = spring({ frame: frame - E.kodcu!, fps, config: { damping: 13, stiffness: 320, mass: 0.6 }, from: 1, to: 0 });
  return (
    <div style={{ position: "absolute", inset: 0, background: C.blue }}>
      <Sunburst cx={50} cy={60} />
      <div style={{ position: "absolute", left: 60, width: 960, top: 230, textAlign: "center", fontWeight: 1000, color: "#FFFFFF" }}>
        <div style={{ fontSize: 176, lineHeight: 1, letterSpacing: "-0.04em", textShadow: `0 12px 0 ${C.t1Ink}`, scale: String(slam(frame, fps, E.planla!)), rotate: `${shake(frame, E.planla!)}deg` }}>
          {T.planla}
        </div>
        <div style={{ fontSize: 64, lineHeight: 1.15, marginTop: 6, scale: String(pop(frame, fps, E.board! + 8)) }}>
          {T.board1} <span style={{ color: C.yellow }}>{T.board2}</span>
        </div>
      </div>
      <div style={{ position: "absolute", inset: 0, translate: `0 ${drop}px`, rotate: `${swing}deg`, transformOrigin: "540px 520px" }}>
        <svg aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920 }}>
          <path d={`M540 520 L${BOARD.left + 120} ${BOARD.top + 6} M540 520 L${BOARD.left + BOARD.width - 120} ${BOARD.top + 6}`} stroke="#5B3A1E" strokeWidth={5} fill="none" />
          <circle cx={540} cy={520} r={13} fill="#C9CED8" stroke="#6B7280" strokeWidth={3} />
        </svg>
        <div
          style={{
            position: "absolute",
            ...BOARD,
            boxSizing: "border-box",
            border: "22px solid #9A6B3F",
            borderRadius: 18,
            backgroundColor: "#D8B68A",
            backgroundImage: "radial-gradient(rgba(90, 58, 28, 0.18) 2.5px, transparent 3px)",
            backgroundSize: "26px 26px",
            boxShadow: `inset 0 0 0 4px #7A5230, 0 16px 0 ${C.t1Ink}`,
          }}
        />
        {POLAROIDS.map((p) =>
          frame >= p.at ? (
            <div key={p.art}>
              <Polaroid art={p.art} caption={p.caption} style={{ left: p.x, top: p.y, rotate: `${p.tilt}deg`, scale: String(slam(frame, fps, p.at)) }} />
              {frame >= p.at + 3 ? <Pin x={p.x + 150} y={p.y + 8} /> : null}
            </div>
          ) : null,
        )}
        {frame >= E.goal! ? (
          <div
            style={{
              position: "absolute",
              left: 320,
              top: 930,
              width: 440,
              boxSizing: "border-box",
              padding: "22px 26px",
              background: "#FFFFFF",
              borderRadius: 22,
              textAlign: "center",
              boxShadow: `0 8px 0 ${C.t1Ink}`,
              zIndex: 2,
              rotate: "-2deg",
              scale: String(slam(frame, fps, E.goal!)),
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 1000, letterSpacing: "0.12em", color: C.blue }}>{T.goalLabel}</div>
            <div style={{ fontSize: 50, fontWeight: 1000, lineHeight: 1.05, color: C.t1Ink, marginTop: 6 }}>{T.goal}</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: C.grey, marginTop: 6 }}>{T.city}</div>
          </div>
        ) : null}
        {frame >= E.note! ? (
          <div
            style={{
              position: "absolute",
              left: 410,
              top: 1220,
              width: 250,
              height: 210,
              boxSizing: "border-box",
              padding: "34px 18px",
              background: C.yellow,
              boxShadow: "0 10px 14px rgba(40, 24, 8, 0.3)",
              fontFamily: caveat,
              fontWeight: 700,
              fontSize: 50,
              lineHeight: 1,
              textAlign: "center",
              color: C.t1Ink,
              zIndex: 2,
              rotate: "4deg",
              scale: String(slam(frame, fps, E.note!)),
            }}
          >
            {T.note}
          </div>
        ) : null}
        <svg aria-hidden="true" viewBox="0 0 100 90" style={{ position: "absolute", left: 380, top: 620, width: 110, zIndex: 3, scale: String(pop(frame, fps, E.heart!)), rotate: "-12deg" }}>
          <path d="M50 88 C10 60 0 38 12 18 C24 0 46 6 50 24 C54 6 76 0 88 18 C100 38 90 60 50 88 Z" fill="#F0607A" stroke={C.t1Ink} strokeWidth={5} />
        </svg>
        <svg aria-hidden="true" viewBox="0 0 100 100" style={{ position: "absolute", left: 690, top: 1010, width: 96, zIndex: 3, scale: String(pop(frame, fps, E.heart! + 4)), rotate: "10deg" }}>
          <path d="M50 4 L62 36 L96 38 L69 59 L79 93 L50 73 L21 93 L31 59 L4 38 L38 36 Z" fill={C.yellow} stroke={C.t1Ink} strokeWidth={5} strokeLinejoin="round" />
        </svg>
        {frame >= E.kodcu! ? (
          <CareerSticker
            art="t1CareerYazilim"
            name={T.stYazilim!}
            width={170}
            style={{ left: 455, top: 735, zIndex: 4, translate: `${400 * kodcuFly}px ${-700 * kodcuFly}px`, rotate: `${8 + 40 * kodcuFly}deg`, scale: String(1 + 0.6 * kodcuFly) }}
          />
        ) : null}
      </div>
    </div>
  );
}
