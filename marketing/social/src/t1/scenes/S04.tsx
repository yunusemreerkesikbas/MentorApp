import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ART } from "../../art";
import { C } from "../../brand";
import { COPY } from "../../copy";
import { Sparkle } from "../../components/Sparkle";
import { pop, slam } from "../../motion";
import { Sunburst } from "../parts/Sunburst";
import { EVENTS } from "../timeline";

const T = COPY.T1!;
const E = EVENTS["04"];
const PILL_GAP = 8; // frames between the five exam pills
const LANDED = 8;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Inside: the blue sunburst world. The host Puhu lands with a squash, opens his wings and sways; the exams pop.
export function S04() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fall = spring({ frame: frame - E.land!, fps, config: { damping: 14, stiffness: 300, mass: 0.6 }, from: -1500, to: 0 });
  const squash = interpolate(frame, [LANDED - 2, LANDED + 2, LANDED + 9], [0, 1, 0], clamp);
  const sway = frame > LANDED + 9 ? 5 * Math.sin((frame - LANDED - 9) / 4.5) : 0;
  const exams = T.exams!.split(" · ");
  return (
    <div style={{ position: "absolute", inset: 0, background: C.blue }}>
      <Sunburst cx={50} cy={62} />
      <Sparkle x={70} y={820} size={60} color={C.yellow} />
      <Sparkle x={930} y={980} size={48} color="#FFFFFF" />
      <Sparkle x={120} y={1380} size={40} color={C.sky} />
      <div style={{ position: "absolute", left: 60, width: 960, top: 270, textAlign: "center", fontWeight: 1000 }}>
        <div style={{ fontSize: 60, lineHeight: 1.1, color: "#FFFFFF", scale: String(slam(frame, fps, E.line1!)) }}>{T.exams1}</div>
        <div style={{ fontSize: 128, lineHeight: 1, letterSpacing: "-0.03em", color: C.yellow, textShadow: `0 10px 0 ${C.t1Ink}`, scale: String(slam(frame, fps, E.line2!)) }}>
          {T.exams2}
        </div>
      </div>
      <div style={{ position: "absolute", left: 170, width: 740, top: 540, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 22 }}>
        {exams.map((x, i) => (
          <span
            key={x}
            style={{ padding: "14px 34px", borderRadius: 999, background: "#FFFFFF", color: C.blue, fontSize: 52, fontWeight: 1000, boxShadow: `0 8px 0 ${C.t1Ink}`, scale: String(pop(frame, fps, E.pills! + i * PILL_GAP)) }}
          >
            {x}
          </span>
        ))}
      </div>
      <Img
        src={staticFile(ART.host)}
        alt=""
        style={{
          position: "absolute",
          left: 150,
          top: 820,
          width: 780,
          height: 975,
          objectFit: "contain",
          transformOrigin: "50% 100%",
          translate: `0 ${fall}px`,
          scale: `${1 + 0.12 * squash} ${1 - 0.16 * squash}`,
          rotate: `${sway}deg`,
        }}
      />
    </div>
  );
}
