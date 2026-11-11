import { Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ART, type ArtKey } from "../../art";
import { C } from "../../brand";
import { COPY } from "../../copy";
import { countAt, pop, shake } from "../../motion";
import { Ring, RING } from "../parts/Ring";
import { StickerWords } from "../parts/StickerWords";
import { Sunburst } from "../parts/Sunburst";
import { EVENTS } from "../timeline";

const T = COPY.T1!;
const E = EVENTS["09"];
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const ROOMS: { name: string; bg: ArtKey; table: ArtKey }[] = [
  { name: T.roomEv!, bg: "t1RoomHomeBg", table: "t1RoomHomeTable" },
  { name: T.roomKafe!, bg: "t1RoomCafeBg", table: "t1RoomCafeTable" },
  { name: T.roomKutuphane!, bg: "t1RoomLibraryBg", table: "t1RoomLibraryTable" },
];
const STEPS = [E.ev!, E.kafe!, E.kutuphane!];
// The dial clicks up in five-minute steps, one every two frames, and stops on 25:00.
const DIAL = ["05:00", "10:00", "15:00", "20:00", T.dial!];

// The seans rooms are top-down floors drawn landscape; turned a quarter they fill the frame with every corner
// (sofa, café counter, shelves) still in view. The table sits where the ring is.
export function Room({ bg, table }: { bg: ArtKey; table: ArtKey }) {
  return (
    <div style={{ position: "absolute", width: 1080, height: 1920, overflow: "hidden" }}>
      <Img src={staticFile(ART[bg])} alt="" style={{ position: "absolute", left: -420, top: 420, width: 1920, height: 1080, rotate: "90deg" }} />
      <Img src={staticFile(ART[table])} alt="" style={{ position: "absolute", left: RING.cx - 290, top: RING.cy - 290, width: 580, height: 580, filter: "drop-shadow(0 24px 24px rgba(30, 16, 4, 0.45))" }} />
    </div>
  );
}

// ODAKLAN: the rooms slide past one per beat while the session ring stays put; the chips follow, the dial clicks to 25:00.
export function S09() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = countAt(frame, STEPS);
  const from = at === 0 ? 0 : at - 1;
  const move = at === 0 ? 0 : interpolate(frame, [STEPS[at - 1]!, STEPS[at - 1]! + 8], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const x = -1080 * (from + move);
  const dialStep = Math.min(DIAL.length - 1, Math.floor((frame - E.dial!) / 2));
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: C.blue }}>
      <div style={{ position: "absolute", left: 0, top: 0, translate: `${x}px 0` }}>
        <div style={{ position: "absolute", width: 1080, height: 1920, background: C.blue }}>
          <Sunburst cx={50} cy={58} />
        </div>
        {ROOMS.map((r, i) => (
          <div key={r.bg} style={{ position: "absolute", left: 1080 * (i + 1) }}>
            <Room bg={r.bg} table={r.table} />
          </div>
        ))}
      </div>
      <Ring />
      {frame >= E.dial! ? (
        <div style={{ position: "absolute", left: 0, width: 1080, top: RING.cy - 85, rotate: `${shake(frame, E.dial! + 2 * dialStep) * 0.5}deg` }}>
          <StickerWords lines={[DIAL[dialStep]!]} top={0} at={[E.dial!]} size={150} />
        </div>
      ) : null}
      <StickerWords lines={[T.odaklan!]} top={250} at={[E.odaklan!]} size={170} />
      <StickerWords lines={[T.rooms!]} top={445} at={[E.words!]} size={52} color={C.yellow} />
      <div style={{ position: "absolute", left: 60, width: 960, top: 1385, display: "flex", justifyContent: "center", gap: 20 }}>
        {ROOMS.map((r, i) => (
          <div
            key={r.name}
            style={{
              padding: "14px 30px",
              borderRadius: 999,
              background: at === i + 1 ? C.yellow : "#FFFFFF",
              color: C.t1Ink,
              fontSize: 48,
              fontWeight: 1000,
              lineHeight: 1,
              boxShadow: `0 6px 0 ${C.t1Ink}`,
              scale: String(pop(frame, fps, E.ev! + i * 2) * (at === i + 1 ? 1.08 : 1)),
            }}
          >
            {r.name}
          </div>
        ))}
      </div>
    </div>
  );
}
