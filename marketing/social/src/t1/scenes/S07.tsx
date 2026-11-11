import { Video } from "@remotion/media";
import { Easing, Freeze, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CLIPS } from "../../art";
import { C } from "../../brand";
import { Sparkle } from "../../components/Sparkle";
import { COPY } from "../../copy";
import { SNAPPY } from "../../motion";
import { NightSky } from "../parts/NightSky";
import { PlanCard } from "../parts/PlanCard";
import { StickerWords } from "../parts/StickerWords";
import { EVENTS, sceneOf } from "../timeline";
import { S06 } from "./S06";

const T = COPY.T1!;
const E = EVENTS["07"];
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Each card pops out of the wand's star where the clip has it on that beat (measured on the loop at 1.5, 2.0 and
// 2.5 s), then settles around Puhu, clear of his head (cards size to their text, 360–465 px wide).
export const CARDS = [
  { text: T.card1!, at: E.card1!, from: { x: 330, y: 640 }, x: 70, y: 590, rot: -9 },
  { text: T.card2!, at: E.card2!, from: { x: 366, y: 534 }, x: 570, y: 1040, rot: 8 },
  { text: T.card3!, at: E.card3!, from: { x: 400, y: 1130 }, x: 110, y: 1150, rot: -4 },
] as const;
const CARD_HALF = { x: 230, y: 55 };

// Transition 3 + "Şehrin üstünde": a gold streak wipes the board away to night; Puhu waves his wand in a soft
// round mask and each beat pops a paper plan card out of the star.
export function S07() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wipe = interpolate(frame, [E.streak!, E.streak! + 10], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const xTop = -400 + wipe * 1880;
  const xBottom = xTop - 400;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {wipe < 1 ? (
        <Freeze frame={sceneOf("06").durationInFrames - 1}>
          <S06 />
        </Freeze>
      ) : null}
      <div style={{ position: "absolute", inset: 0, clipPath: wipe < 1 ? `polygon(0 0, ${xTop}px 0, ${xBottom}px 1920px, 0 1920px)` : undefined }}>
        <NightSky />
        <Video
          name="Sihir döngüsü"
          src={staticFile(CLIPS.t1Magic)}
          muted
          objectFit="cover"
          style={{
            position: "absolute",
            left: 150,
            top: 500,
            width: 780,
            height: 780,
            maskImage: "radial-gradient(circle at 50% 46%, #000 58%, transparent 68%)",
            WebkitMaskImage: "radial-gradient(circle at 50% 46%, #000 58%, transparent 68%)",
          }}
        />
        <StickerWords lines={[T.magic1!, T.magic2!]} top={250} at={[E.words!, E.words! + 6]} size={120} />
        {CARDS.map((c) => {
          if (frame < c.at) return null;
          const p = spring({ frame: frame - c.at, fps, config: SNAPPY });
          const burst = interpolate(frame - c.at, [0, 4, 12], [0, 1, 0], clamp);
          return (
            <div key={c.text}>
              {[-1, 0, 1].map((k) => (
                <Sparkle key={k} x={c.from.x - 30 + k * 60} y={c.from.y - 40 + Math.abs(k) * 30} size={60} color={C.yellow} style={{ scale: String(burst), rotate: `${k * 20}deg` }} />
              ))}
              <PlanCard
                text={c.text}
                style={{
                  left: c.x,
                  top: c.y,
                  zIndex: 2,
                  translate: `${(c.from.x - c.x - CARD_HALF.x) * (1 - p)}px ${(c.from.y - c.y - CARD_HALF.y) * (1 - p)}px`,
                  scale: String(p),
                  rotate: `${c.rot * p}deg`,
                }}
              />
            </div>
          );
        })}
      </div>
      {wipe > 0 && wipe < 1 ? (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: (xTop + xBottom) / 2 - 45,
            top: -240,
            width: 90,
            height: 2400,
            rotate: "11.8deg",
            background: "linear-gradient(90deg, rgba(255, 224, 130, 0), #FFC83D 30%, #FFF6D6 50%, #FFC83D 70%, rgba(255, 224, 130, 0))",
            boxShadow: "0 0 80px 30px rgba(255, 200, 61, 0.55)",
          }}
        />
      ) : null}
    </div>
  );
}
