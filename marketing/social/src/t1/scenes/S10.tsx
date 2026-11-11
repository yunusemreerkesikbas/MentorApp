import type { ReactNode } from "react";
import { Easing, Freeze, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { CLIPS } from "../../art";
import { C } from "../../brand";
import { COPY } from "../../copy";
import { pop, slam } from "../../motion";
import { ClipScene } from "../parts/ClipScene";
import { QuestionSlip, SLIP } from "../parts/QuestionSlip";
import { Ring, RING } from "../parts/Ring";
import { StickerWords } from "../parts/StickerWords";
import { CLIP_CUTS, EVENTS, sceneOf } from "../timeline";
import { S09 } from "./S09";

const T = COPY.T1!;
const E = EVENTS["10"];
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const OPEN = 12; // frames for the ring to grow past the corners
const TIMER_Y = 520;
// The slip pops out of the closed book and settles over Puhu's chest, below his face; scene 11 picks it up there.
export const SLIP_END = { x: 600, y: 1450, scale: 0.8, rot: -6 } as const;

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// Opaque sticker chips for the rewards, each with a small drawn icon.
function Chip({ icon, text, left, top, rot, at }: { icon: ReactNode; text: string; left: number; top: number; rot: number; at: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  return (
    <div style={{ position: "absolute", left, top, display: "flex", alignItems: "center", gap: 14, padding: "14px 30px 14px 20px", borderRadius: 999, background: "#FFFFFF", color: C.t1Ink, fontSize: 50, fontWeight: 1000, lineHeight: 1, whiteSpace: "nowrap", boxShadow: `0 8px 0 ${C.t1Ink}`, rotate: `${rot}deg`, scale: String(pop(frame, fps, at)) }}>
      <svg aria-hidden="true" viewBox="0 0 40 40" style={{ width: 52, height: 52 }}>{icon}</svg>
      {text}
    </div>
  );
}
const BOLT = <path d="M23 2 L7 23 H18 L15 38 L33 15 H22 Z" fill={C.yellow} stroke={C.t1Ink} strokeWidth={3} strokeLinejoin="round" />;
const FLAME = <path d="M20 2 C22 10 32 14 32 25 C32 33 26 38 20 38 C13 38 8 33 8 26 C8 19 13 16 14 10 C17 14 18 17 18 20 C21 15 21 8 20 2 Z" fill="#FF8A3D" stroke={C.t1Ink} strokeWidth={3} strokeLinejoin="round" />;
const CUP = (
  <>
    <path d="M6 14 H28 V26 C28 32 24 36 17 36 C10 36 6 32 6 26 Z" fill={C.paper} stroke={C.t1Ink} strokeWidth={3} strokeLinejoin="round" />
    <path d="M28 17 H31 C35 17 35 25 31 25 H28" fill="none" stroke={C.t1Ink} strokeWidth={3} />
    <path d="M13 4 C11 7 15 8 13 11 M20 4 C18 7 22 8 20 11" fill="none" stroke={C.t1Ink} strokeWidth={2.5} strokeLinecap="round" />
  </>
);

// Transition 6 + K3: the ring grows past the edges onto Puhu's room; the timer races to 00:00 while he studies,
// the rewards pop as he slams the book and cheers, and a question slip shoots out of the book.
export function S10() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const open = interpolate(frame, [E.ring!, E.ring! + OPEN], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const r = RING.r + open * 1000;
  const race = interpolate(frame, [E.finish!, E.timer!], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const timerY = interpolate(frame, [0, OPEN], [RING.cy - 85, TIMER_Y], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const done = frame >= E.timer!;
  const fly = interpolate(frame, [E.slip!, sceneOf("10").durationInFrames], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {open < 1 ? (
        <Freeze frame={sceneOf("09").durationInFrames - 1}>
          <S09 />
        </Freeze>
      ) : null}
      <div style={{ position: "absolute", inset: 0, clipPath: open < 1 ? `circle(${r - RING.stroke / 2}px at ${RING.cx}px ${RING.cy}px)` : undefined }}>
        <ClipScene name="K3" src={CLIPS.t1K3} cuts={CLIP_CUTS.K3.cuts} />
      </div>
      {open < 1 ? <Ring r={r} stroke={RING.stroke * (1 + open)} /> : null}
      <StickerWords lines={[T.finish1!, T.finish2!]} top={250} at={[E.finish!, E.finish! + 6]} size={100} />
      <div style={{ position: "absolute", left: 0, width: 1080, top: timerY, scale: String(done ? slam(frame, fps, E.timer!) : 1) }}>
        <StickerWords lines={[done ? T.timerEnd! : fmt(1500 * (1 - race))]} top={0} at={[-30]} size={done ? 130 : interpolate(frame, [0, OPEN], [150, 110], clamp)} color={done ? C.yellow : "#FFFFFF"} />
      </div>
      <Chip icon={BOLT} text={T.xp!} left={70} top={680} rot={-6} at={E.xp!} />
      <Chip icon={FLAME} text={T.streak!} left={580} top={680} rot={5} at={E.streak!} />
      <Chip icon={CUP} text={T.mola!} left={70} top={1300} rot={-3} at={E.mola! + 4} />
      {frame >= E.slip! ? (
        <QuestionSlip
          style={{
            left: interpolate(fly, [0, 1], [540, SLIP_END.x]) - SLIP.width / 2,
            top: interpolate(fly, [0, 1], [1540, SLIP_END.y]) - SLIP.height / 2,
            scale: String(interpolate(fly, [0, 1], [0.2, SLIP_END.scale])),
            rotate: `${interpolate(fly, [0, 1], [30, SLIP_END.rot])}deg`,
            zIndex: 3,
          }}
        />
      ) : null}
    </div>
  );
}
