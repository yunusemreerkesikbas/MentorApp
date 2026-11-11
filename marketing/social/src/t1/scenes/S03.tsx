import { Easing, interpolate, useCurrentFrame } from "remotion";
import { CLIPS } from "../../art";
import { COPY } from "../../copy";
import { ClipScene } from "../parts/ClipScene";
import { SpeedLines } from "../parts/SpeedLines";
import { StickerWords } from "../parts/StickerWords";
import { CLIP_CUTS, EVENTS } from "../timeline";

const T = COPY.T1!;
const E = EVENTS["03"];
const WORDS_OUT = 48; // gone before he dives (clip ~2,1 s)
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// K1: the host Puhu climbs out of the screen, beckons, dives back in; the camera follows him in.
export function S03() {
  const frame = useCurrentFrame();
  const push = interpolate(frame, [E.flash!, E.flash! + 15], [1, 1.9], { ...clamp, easing: Easing.in(Easing.cubic) });
  const out = interpolate(frame, [WORDS_OUT, WORDS_OUT + 6], [1, 0], { ...clamp, easing: Easing.in(Easing.back(2)) });
  return (
    <div style={{ position: "absolute", inset: 0, background: "#06061F" }}>
      <div style={{ position: "absolute", inset: 0, scale: String(push), transformOrigin: "540px 1500px" }}>
        <ClipScene name="K1" src={CLIPS.t1K1} cuts={CLIP_CUTS.K1.cuts} />
      </div>
      {out > 0 ? (
        <div style={{ position: "absolute", inset: 0, scale: String(out), transformOrigin: "540px 1360px" }}>
          <StickerWords lines={[T.come1!, T.come2!]} top={1240} at={[E.come!, E.come! + 6]} size={92} />
        </div>
      ) : null}
      <SpeedLines at={E.flash!} frames={15} cx={50} cy={78} />
    </div>
  );
}
