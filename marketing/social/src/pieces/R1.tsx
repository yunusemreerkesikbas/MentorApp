import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../brand";
import { EndCard } from "../components/EndCard";
import { Frame } from "../components/Frame";
import { pop, shake, slam, slideUp } from "../motion";
import { PIECES, type PieceProps } from "../pieces";
import { KankaBubble, PeekPuhu, PovHeadline, StoryBackdrop, StoryPhone } from "./S1";

const VIDEO = PIECES.find((p) => p.id === "R1")!.video!;

// Beat grid (frames at 30 fps, one beat = 15).
const AT = { pov: 0, head: 15, dedin: 30, phone: 45, puhu: 60, bubble: 90, flip: 135, wipe: 150 } as const;
// R1 lifts the phone 150 px so "Yerini kap!" stays above the reel caption area (y ≤ 1500).
const PHONE_LIFT = -150;
const FLIP = 6;

// Squash the phone flat and back while the screen swaps.
function squash(frame: number): number {
  const t = frame - AT.flip;
  if (t < 0 || t > FLIP) return 1;
  return Math.max(0.04, Math.abs(1 - (2 * t) / FLIP));
}

// S1 in motion: POV headline, the phone shoots up, Puhu peeks, bubble shakes, screen flips, end card.
export function R1({ safe }: PieceProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const screen = frame < AT.flip + FLIP / 2 ? "video" : "puhu";
  return (
    <Frame format="reel" background={C.blue} safe={safe}>
      <StoryBackdrop />
      {/* Centred on the reel text box (x 60–900) instead of the frame. */}
      <div style={{ position: "absolute", inset: 0, transform: "translateX(-60px) scale(0.9)", transformOrigin: "540px 360px" }}>
        <PovHeadline popPov={pop(frame, fps, AT.pov)} slamHead={slam(frame, fps, AT.head)} stampDedin={slam(frame, fps, AT.dedin)} />
      </div>
      {frame >= AT.puhu ? <PeekPuhu y={slideUp(frame, fps, AT.puhu, 520)} /> : null}
      <KankaBubble scale={pop(frame, fps, AT.bubble)} rotate={-4 + shake(frame, AT.bubble)} />
      <div style={{ position: "absolute", inset: 0, transform: `scaleX(${squash(frame)})`, transformOrigin: "600px 1500px" }}>
        <StoryPhone
          y={PHONE_LIFT + slideUp(frame, fps, AT.phone, 900)}
          screen={screen}
          guides={false}
          progress={interpolate(frame, [AT.phone, AT.flip], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
          wipe={interpolate(frame, [AT.wipe, AT.wipe + 9], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        />
      </div>
      <EndCard ground={C.blue} ink="#FFFFFF" puhu="wave" enter={VIDEO.endCardFrom} />
    </Frame>
  );
}
