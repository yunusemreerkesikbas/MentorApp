import { Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { ART, CLIPS } from "../../art";
import { COPY } from "../../copy";
import { ClipScene } from "../parts/ClipScene";
import { Flash } from "../parts/Flash";
import { NightSky } from "../parts/NightSky";
import { StickerWords } from "../parts/StickerWords";
import { CLIP_CUTS, EVENTS } from "../timeline";

const T = COPY.T1!;
const E = EVENTS["16"];
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// The lit apartment (city-facade, 1024×1536) full width at night. Its one dark window, top middle, measured on
// the art at x 400–620, y 410–600.
const K = 1080 / 1024;
const FACADE_TOP = 300;
const WIN = { left: 400 * K, top: FACADE_TOP + 410 * K, width: 220 * K, height: 190 * K };
const WIN_C = { x: WIN.left + WIN.width / 2, y: WIN.top + WIN.height / 2 };

// Transition 12: the facade at night; the card's gold light floats up into the dark window, it lights up with a
// pulse, then the camera dives in onto K5.
export function S16() {
  const frame = useCurrentFrame();
  const fly = interpolate(frame, [E.light!, E.lit!], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const lit = interpolate(frame, [E.lit!, E.lit! + 3], [0, 1], clamp);
  const glow = lit * interpolate(frame, [E.lit!, E.lit! + 5, E.lit! + 15], [1, 1.6, 1], clamp);
  const dive = interpolate(frame, [E.dive!, E.clip!], [1, 9], { ...clamp, easing: Easing.in(Easing.cubic) });
  const orb = (lag: number) => {
    const t = Math.max(0, fly - lag);
    return { x: 540 + (WIN_C.x - 540) * t, y: 1750 + (WIN_C.y - 1750) * t };
  };
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {frame < E.clip! ? (
        <div style={{ position: "absolute", inset: 0, scale: String(dive), transformOrigin: `${WIN_C.x}px ${WIN_C.y}px` }}>
          <NightSky />
          <Img src={staticFile(ART.t1Facade)} alt="" style={{ position: "absolute", left: 0, top: FACADE_TOP, width: 1080, height: 1536 * K }} />
          <div style={{ position: "absolute", ...WIN, background: "linear-gradient(180deg, #FFE7A8, #FFC15C)", opacity: lit, boxShadow: `0 0 ${80 * glow}px ${30 * glow}px rgba(255, 196, 92, 0.6)` }} />
          {frame >= E.light! && fly < 1
            ? [0.18, 0.09, 0].map((lag, i) => {
                const p = orb(lag);
                const r = [26, 36, 48][i]!;
                return <div key={lag} style={{ position: "absolute", left: p.x - r, top: p.y - r, width: r * 2, height: r * 2, borderRadius: "50%", background: "radial-gradient(circle, #FFF7DA 0%, #FFD15C 45%, rgba(255, 209, 92, 0) 72%)", opacity: [0.35, 0.6, 1][i] }} />;
              })
            : null}
        </div>
      ) : null}
      <ClipScene name="K5" src={CLIPS.t1K5} cuts={CLIP_CUTS.K5.cuts} />
      <StickerWords lines={[T.light1!, T.light2!]} top={260} at={[E.clip!, E.clip! + 15]} size={92} />
      <Flash at={-4} color="#FFD15C" />
    </div>
  );
}
