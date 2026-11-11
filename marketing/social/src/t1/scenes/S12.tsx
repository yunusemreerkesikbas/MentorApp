import { Easing, interpolate, useCurrentFrame } from "remotion";
import { CLIPS } from "../../art";
import { C } from "../../brand";
import { COPY } from "../../copy";
import { ClipScene } from "../parts/ClipScene";
import { PAGE } from "../parts/Notebook";
import { RING } from "../parts/Ring";
import { StickerWords } from "../parts/StickerWords";
import { CLIP_CUTS, EVENTS } from "../timeline";
import { LastPage } from "./S11";
import { Room } from "./S09";

const T = COPY.T1!;
const E = EVENTS["12"];
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ON_TABLE = { scale: 0.34, rot: 8 };

// Transition 8: the notebook slides onto the top-down study table, then cuts to the masa (K4) on the same table.
export function S12() {
  const frame = useCurrentFrame();
  const slide = interpolate(frame, [E.slide!, E.slide! + 12], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const dx = (RING.cx - PAGE.left - PAGE.width / 2) * slide;
  const dy = (RING.cy - PAGE.top - PAGE.height / 2) * slide;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: C.paper }}>
      {frame < E.cut! ? (
        <>
          <Room bg="t1RoomHomeBg" table="t1RoomHomeTable" />
          <div style={{ position: "absolute", left: PAGE.left, top: PAGE.top, width: PAGE.width, height: PAGE.height, translate: `${dx}px ${dy}px`, scale: String(1 - (1 - ON_TABLE.scale) * slide), rotate: `${ON_TABLE.rot * slide}deg`, filter: "drop-shadow(0 20px 24px rgba(30, 16, 4, 0.45))" }}>
            <LastPage review={1} stamp={1} />
          </div>
        </>
      ) : null}
      <ClipScene name="K4" src={CLIPS.t1K4} cuts={CLIP_CUTS.K4.cuts} />
      <StickerWords lines={[T.birlikte!]} top={250} at={[E.birlikte!]} size={170} />
      <StickerWords lines={[T.masa1!, T.masa2!]} top={455} at={[E.words!, E.words! + 4]} size={64} color={C.yellow} />
    </div>
  );
}
