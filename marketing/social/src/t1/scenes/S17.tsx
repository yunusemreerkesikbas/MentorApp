import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ART } from "../../art";
import { C } from "../../brand";
import { EndCard } from "../../components/EndCard";
import { COPY } from "../../copy";
import { StickerWords } from "../parts/StickerWords";
import { Sunburst } from "../parts/Sunburst";
import { EVENTS } from "../timeline";

const T = COPY.T1!;
const E = EVENTS["17"];
const LANDED = 9; // frames after `hop` until he touches down
// The spec's end card: logo, puhukoc.com and the five exams, in the slot the ÇOK YAKINDA pill uses elsewhere.
export const EXAMS_SIZE = 38; // 40 ran past the 900 px safe width
const EXAMS = <span style={{ fontSize: EXAMS_SIZE, fontWeight: 900, letterSpacing: "0.02em", opacity: 0.92 }}>{T.exams}</span>;

// PLANLA. ODAKLAN. PUHU İLE. stamp on the music's three hits; the host Puhu hops in under them on the last; the end card opens.
export function S17() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hop = spring({ frame: frame - E.hop!, fps, config: { damping: 11, stiffness: 300, mass: 0.6 }, from: 900, to: 0 });
  const arc = frame >= E.hop! ? -120 * Math.sin(Math.min(1, (frame - E.hop!) / LANDED) * Math.PI) : 0;
  const squash = interpolate(frame - E.hop!, [LANDED - 2, LANDED + 1, LANDED + 7], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: C.blue }}>
      <Sunburst cx={50} cy={55} />
      <StickerWords lines={[T.end1!, T.end2!, T.end3!]} top={300} at={[E.end1!, E.end2!, E.end3!]} size={140} />
      {frame >= E.hop! ? (
        <Img
          src={staticFile(ART.host)}
          alt=""
          style={{ position: "absolute", left: 290, top: 1000, width: 500, height: 500, objectFit: "contain", translate: `0 ${hop + arc}px`, scale: `${1 + 0.14 * squash} ${1 - 0.16 * squash}`, transformOrigin: "50% 100%" }}
        />
      ) : null}
      <EndCard ground={C.blue} ink="#FFFFFF" puhu="host" enter={E.endCard!} tag={EXAMS} />
    </div>
  );
}
