import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../../brand";
import { COPY } from "../../copy";
import { Sparkle } from "../../components/Sparkle";
import { slam } from "../../motion";
import { HookPhone } from "../parts/HookPhone";
import { EVENTS } from "../timeline";

const T = COPY.T1!;
const E = EVENTS["01"];

// Night, the phone playing a video at 01:47; "“Son bir video”" slams in, "dedin." stamps.
export function S01() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: "absolute", inset: 0, background: C.t1Night }}>
      <Sparkle x={80} y={230} size={46} color={C.yellow} />
      <Sparkle x={930} y={560} size={34} color="#FFFFFF" />
      <Sparkle x={150} y={610} size={28} color={C.sky} />
      <HookPhone progress={interpolate(frame, [0, 75], [0.62, 0.68])} />
      <div style={{ position: "absolute", left: 60, width: 960, top: 270, textAlign: "center", fontWeight: 1000, color: "#FFFFFF" }}>
        <div style={{ fontSize: 118, lineHeight: 1, letterSpacing: "-0.03em", scale: String(slam(frame, fps, E.hookA!)) }}>{T.hookA}</div>
        <div style={{ fontSize: 170, lineHeight: 1, letterSpacing: "-0.04em", color: C.yellow, scale: String(slam(frame, fps, E.hookB!)) }}>{T.hookB}</div>
      </div>
    </div>
  );
}
