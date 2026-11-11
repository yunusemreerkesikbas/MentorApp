import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { ArtKey } from "../../art";
import { C } from "../../brand";
import { COPY } from "../../copy";
import { slam, shake } from "../../motion";
import { CareerSticker } from "../parts/CareerSticker";
import { Sunburst } from "../parts/Sunburst";
import { EVENTS } from "../timeline";

const T = COPY.T1!;
const E = EVENTS["05"];
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// The ten career groups of the app, in album order. Kodcu (4th) is the one that peels off.
const STICKERS: { art: ArtKey; name: string }[] = [
  { art: "t1CareerSaglik", name: T.stSaglik! },
  { art: "t1CareerMuhendislik", name: T.stMuhendislik! },
  { art: "t1CareerHukuk", name: T.stHukuk! },
  { art: "t1CareerYazilim", name: T.stYazilim! },
  { art: "t1CareerEgitim", name: T.stEgitim! },
  { art: "t1CareerIsletme", name: T.stIsletme! },
  { art: "t1CareerSosyal", name: T.stSosyal! },
  { art: "t1CareerSanat", name: T.stSanat! },
  { art: "t1CareerFen", name: T.stFen! },
  { art: "t1CareerMimarlik", name: T.stMimarlik! },
];
export const KODCU = 3;

// Slots in a 3-2-3-2 brick on the page.
const W = 210;
const GAP = 26;
const ROWS = [3, 2, 3, 2];
const ROW_TOP = [505, 745, 985, 1225];
const SLOTS = ROWS.flatMap((n, r) => Array.from({ length: n }, (_, i) => ({ x: 540 - (n * W + (n - 1) * GAP) / 2 + i * (W + GAP), y: ROW_TOP[r]! })));
const TILT = [-5, 4, -3, 6, -4, 3, -6, 5, -2, 4];
const PAIRS = [E.pair1!, E.pair2!, E.pair3!, E.pair4!, E.pair5!];
const landAt = (i: number) => PAIRS[Math.floor(i / 2)]! + (i % 2) * 4;

// The drop: an empty album page slams onto the sunburst; the career Puhus slap on two per beat.
export function S05() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const peel = interpolate(frame, [E.peel!, E.peel! + 15], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  return (
    <div style={{ position: "absolute", inset: 0, background: C.blue }}>
      <Sunburst cx={50} cy={55} />
      <div style={{ position: "absolute", left: 60, width: 960, top: 250, textAlign: "center", fontWeight: 1000 }}>
        <div style={{ fontSize: 64, lineHeight: 1.05, color: "#FFFFFF", scale: String(slam(frame, fps, E.q1!)) }}>{T.albumQ1}</div>
        <div style={{ fontSize: 96, lineHeight: 1.05, color: C.yellow, textShadow: `0 10px 0 ${C.t1Ink}`, scale: String(slam(frame, fps, E.q2!)), rotate: `${shake(frame, E.q2!)}deg` }}>
          {T.albumQ2}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 478,
          width: 860,
          height: 1012,
          borderRadius: 36,
          background: C.paper,
          boxShadow: `0 14px 0 ${C.t1Ink}`,
          scale: String(slam(frame, fps, E.page!)),
          rotate: "-1.5deg",
        }}
      />
      {SLOTS.map((s, i) => (
        <div key={i} style={{ position: "absolute", left: s.x, top: s.y, width: W, height: 228, borderRadius: 22, border: `4px dashed ${C.dot}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", color: C.dot, fontSize: 64, fontWeight: 1000, scale: String(slam(frame, fps, E.page!)) }}>
          {i + 1}
        </div>
      ))}
      {STICKERS.map((st, i) => {
        const at = landAt(i);
        if (frame < at) return null;
        const s = SLOTS[i]!;
        const lifted = i === KODCU ? peel : 0;
        return (
          <CareerSticker
            key={st.art}
            art={st.art}
            name={st.name}
            width={W}
            style={{
              left: s.x,
              top: s.y,
              zIndex: i === KODCU ? 2 : 1,
              scale: String(slam(frame, fps, at) * (1 + 0.25 * lifted)),
              rotate: `${TILT[i]! - 40 * lifted}deg`,
              translate: `${700 * lifted}px ${-900 * lifted}px`,
              transformOrigin: "0% 100%",
            }}
          />
        );
      })}
    </div>
  );
}
