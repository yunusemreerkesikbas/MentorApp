import { Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ART, type ArtKey } from "../../art";
import { Sparkle } from "../../components/Sparkle";
import { COPY } from "../../copy";
import { pop } from "../../motion";
import { StickerWords } from "../parts/StickerWords";
import { Sunburst } from "../parts/Sunburst";
import { TradingCard } from "../parts/TradingCard";
import { EVENTS } from "../timeline";

const T = COPY.T1!;
const E = EVENTS["15"];
const FLIP = 15; // one turn, a beat long
// Seri Canavarı → Korkusuz Denemeci → Odak Makinesi: each holds front-on, then one quick turn to the next; the
// card snaps on the last.
const FACES: { art: ArtKey; name: string }[] = [
  { art: "t1CharStreak", name: T.nick1! },
  { art: "t1CharBrave", name: T.nick2! },
  { art: "t1CharFocus", name: T.nick3! },
];

// The card's face and turn at a frame; it swaps face halfway through a turn, while its back is showing.
export function cardAt(frame: number) {
  let angle = 0;
  let i = 0;
  [E.flip2!, E.flip3!].forEach((at, k) => {
    const t = interpolate(frame, [at, at + FLIP], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
    angle += 360 * t;
    if (t >= 0.5) i = k + 1;
  });
  return { face: FACES[i]!.art, name: FACES[i]!.name, angle };
}

export function S15() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stopped = frame >= E.stop!;
  const card = cardAt(frame);
  const snap = stopped ? spring({ frame: frame - E.stop!, fps, config: { damping: 9, stiffness: 320, mass: 0.5 }, from: 1.18, to: 1 }) : 1;
  const burst = interpolate(frame - E.stop!, [0, 4, 14], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "radial-gradient(circle at 50% 48%, #FFE38A 0%, #F5B731 62%, #E39A1C 100%)" }}>
      <Sunburst cx={50} cy={48} color="rgba(255, 255, 255, 0.22)" />
      <Img src={staticFile(ART.t1ChestOpen)} alt="" style={{ position: "absolute", left: 320, top: 1230, width: 440, height: 440, filter: "drop-shadow(0 20px 20px rgba(80, 40, 0, 0.35))" }} />
      {[[150, 560], [880, 620], [170, 1180], [860, 1250]].map(([x, y], i) => (
        <Sparkle key={i} x={x! - 50} y={y! - 50} size={100} color="#FFFFFF" style={{ scale: String(burst * (i % 2 ? 0.8 : 1.1)) }} />
      ))}
      <TradingCard art={card.face} name={card.name} msg={stopped ? T.nickMsg : undefined} msgScale={pop(frame, fps, E.stop! + 4)} angle={card.angle} style={{ scale: String(snap) }} />
      <StickerWords lines={[T.story1!, T.story2!]} top={250} at={[E.words!, E.words! + 6]} size={88} />
    </div>
  );
}
