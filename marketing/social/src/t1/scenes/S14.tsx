import { Easing, Freeze, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { ART, CLIPS } from "../../art";
import { C } from "../../brand";
import { COPY } from "../../copy";
import { ClipScene } from "../parts/ClipScene";
import { Flash } from "../parts/Flash";
import { StickerWords } from "../parts/StickerWords";
import { CARD, TradingCard } from "../parts/TradingCard";
import { CLIP_CUTS, EVENTS, sceneOf } from "../timeline";
import { S13 } from "./S13";

const T = COPY.T1!;
const E = EVENTS["14"];
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// The lit tall window. Small in the night first; the dive grows it to the full-width chest clip, whose top runs
// under an opaque night band that holds the words (the clip's top is plain wall).
const CLIP_TOP = 280;
export const BIG = { left: 0, top: CLIP_TOP, width: 1080, height: 1920 };
const SMALL = { left: 390, top: 900, width: 300, height: 533 };
export const CHEST = { x: 540, y: CLIP_TOP + 0.66 * 1920 }; // the open lid in the clip
export const BAND = 440;
export const CHEST_WORDS = { top: 310, size: 104 };

const STARS = [[8, 12], [22, 30], [37, 8], [63, 18], [81, 9], [92, 27], [14, 52], [88, 48], [55, 36]] as const;
const Stars = ({ band }: { band: boolean }) =>
  STARS.filter(([, y]) => (y * 19.2 < BAND) === band).map(([x, y]) => (
    <div key={`${x}-${y}`} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: 6, height: 6, borderRadius: "50%", background: "#FFFFFF", opacity: 0.6, boxShadow: "0 0 10px rgba(255, 255, 255, 0.7)" }} />
  ));

// Transitions 9 and 10: the messages slide away and night falls; "5 gün masadaydın!"; the camera dives into a lit
// window and the chest clip plays in it; "Sandığın hazır!", a gold flash over the cut, and a card shoots out.
export function S14() {
  const frame = useCurrentFrame();
  const away = interpolate(frame, [E.days!, E.days! + 10], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const dive = interpolate(frame, [E.dive!, E.clip!], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const win = (k: keyof typeof BIG) => interpolate(dive, [0, 1], [SMALL[k], BIG[k]]);
  const daysOut = interpolate(frame, [E.dive!, E.dive! + 8], [1, 0], { ...clamp, easing: Easing.in(Easing.back(2)) });
  const ride = interpolate(frame, [E.dive!, E.clip!], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const shoot = interpolate(frame, [E.card!, sceneOf("14").durationInFrames], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: C.t1Night }}>
      <Stars band={false} />
      {frame < E.clip! ? (
        <div style={{ position: "absolute", left: win("left"), top: win("top"), width: win("width"), height: win("height"), boxSizing: "border-box", border: `${14 * (1 - dive)}px solid #2A1C14`, borderRadius: 18 * (1 - dive), overflow: "hidden", boxShadow: `0 0 90px 24px rgba(255, 190, 90, ${0.45 * (1 - dive)})` }}>
          <Img src={staticFile(ART.t1DeskChestClosed)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ) : (
        <ClipScene name="Sandık" src={CLIPS.t1Chest} cuts={CLIP_CUTS.chest.cuts} scale={1} top={CLIP_TOP} />
      )}
      <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: BAND + 40, background: `linear-gradient(${C.t1Night} ${BAND}px, rgba(13, 14, 37, 0))` }} />
      <Stars band />
      {away < 1 ? (
        <div style={{ position: "absolute", inset: 0, translate: `0 ${-1920 * away}px` }}>
          <Freeze frame={sceneOf("13").durationInFrames - 1}>
            <S13 />
          </Freeze>
        </div>
      ) : null}
      {daysOut > 0 ? (
        <div style={{ position: "absolute", inset: 0, scale: String(daysOut), transformOrigin: "540px 520px" }}>
          <StickerWords lines={[T.days!]} top={470} at={[E.days!]} size={90} />
        </div>
      ) : null}
      <StickerWords lines={[T.devirdin!]} top={interpolate(ride, [0, 1], [590, 250])} at={[E.devirdin!]} size={interpolate(ride, [0, 1], [92, 52])} color={C.yellow} />
      <StickerWords lines={[T.chest!]} top={CHEST_WORDS.top} at={[E.ready!]} size={CHEST_WORDS.size} />
      <Flash at={E.flash!} color="#FFD15C" />
      {frame >= E.card! ? (
        <TradingCard
          art="t1CharStreak"
          name={T.nick1!}
          angle={720 * (1 - shoot)}
          style={{ translate: `${(CHEST.x - 540) * (1 - shoot)}px ${(CHEST.y - (CARD.top + CARD.height / 2)) * (1 - shoot)}px`, scale: String(0.12 + 0.88 * shoot) }}
        />
      ) : null}
    </div>
  );
}
