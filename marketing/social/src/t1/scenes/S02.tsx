import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ART } from "../../art";
import { C } from "../../brand";
import { COPY } from "../../copy";
import { shake, slideUp } from "../../motion";
import { HookPhone } from "../parts/HookPhone";
import { EVENTS } from "../timeline";

const T = COPY.T1!;
const E = EVENTS["02"];

// A Puhu notification drops onto the phone with a ping, the phone shakes, P2 peeks over his glasses.
export function S02() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: "absolute", inset: 0, background: C.t1Night }}>
      <HookPhone progress={interpolate(frame, [0, 30], [0.68, 0.7])} rotate={shake(frame, E.shake!) * 0.6} />
      <div
        style={{
          position: "absolute",
          left: 70,
          width: 940,
          top: 600,
          boxSizing: "border-box",
          padding: "30px 36px",
          display: "flex",
          alignItems: "center",
          gap: 28,
          background: "#FFFFFF",
          borderRadius: 44,
          boxShadow: `0 12px 0 ${C.t1Ink}`,
          translate: `0 ${slideUp(frame, fps, E.notif!, -520)}px`,
          rotate: `${-2 + shake(frame, E.notif! + 3) * 0.5}deg`,
        }}
      >
        <div style={{ width: 132, height: 132, flex: "none", borderRadius: "50%", overflow: "hidden", background: C.tint }}>
          <Img src={staticFile(ART.p2)} alt="" style={{ width: 200, height: 200, marginLeft: -34, marginTop: -12, objectFit: "contain" }} />
        </div>
        <div style={{ fontWeight: 1000, color: C.t1Ink }}>
          <div style={{ fontSize: 44, color: C.blue }}>{T.notifName}</div>
          <div style={{ fontSize: 66, lineHeight: 1.05, letterSpacing: "-0.02em" }}>{T.notif}</div>
        </div>
      </div>
      <Img
        src={staticFile(ART.p2)}
        alt=""
        style={{ position: "absolute", left: -120, top: 1120, width: 760, height: 760, objectFit: "contain", rotate: "18deg", translate: `${slideUp(frame, fps, E.peek!, -620)}px 0` }}
      />
    </div>
  );
}
