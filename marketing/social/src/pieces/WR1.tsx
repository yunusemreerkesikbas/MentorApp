import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ART } from "../art";
import { C } from "../brand";
import { COPY } from "../copy";
import { EndCard } from "../components/EndCard";
import { Frame } from "../components/Frame";
import { pop, shake, slam } from "../motion";
import { PIECES, type PieceProps } from "../pieces";

const T = COPY.WR1!;
const VIDEO = PIECES.find((p) => p.id === "WR1")!.video!;
// Beat grid (30 fps, one beat = 15): hook over the dark window, the light snaps on, the line stamps, end card at 180.
const AT = { light: 45, head: 60, punch: 75 } as const;
const DARK = 0.86;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const LINE = { margin: 0, textAlign: "center", fontWeight: 1000, lineHeight: 0.95, letterSpacing: "-0.035em", whiteSpace: "nowrap" } as const;

// One window is still dark: yours. The light snaps on, Puhu is already there with the lantern.
export function WR1({ safe }: PieceProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dark = interpolate(frame, [AT.light, AT.light + 6], [DARK, 0], clamp);
  const jolt = shake(frame, AT.light) * 1.6;
  return (
    <Frame format="reel" background={C.night} safe={safe}>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${jolt}px, ${-jolt / 2}px)` }}>
        <Img src={staticFile(ART.w2)} alt={T.altPuhu} style={{ position: "absolute", left: 0, top: 560, width: 1080, height: 1000, objectFit: "cover", objectPosition: "50% 42%" }} />
        <div aria-hidden="true" style={{ position: "absolute", left: 0, top: 560, width: 1080, height: 1000, background: C.night, opacity: dark }} />
        <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 560, height: 160, background: `linear-gradient(180deg, ${C.night}, rgba(11, 22, 54, 0))` }} />
        <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 1400, height: 160, background: `linear-gradient(0deg, ${C.night}, rgba(11, 22, 54, 0))` }} />

        <div style={{ position: "absolute", left: 60, right: 60, top: 290 }}>
          {frame < AT.light ? (
            <p style={{ ...LINE, fontSize: 124, color: "#FFFFFF", transform: `scale(${pop(frame, fps, 0)})` }}>
              {T.hook1}
              <br />
              {T.hook2}
            </p>
          ) : (
            <>
              <p style={{ ...LINE, fontSize: 124, color: "#FFFFFF", transform: `scale(${slam(frame, fps, AT.head)})` }}>{T.head}</p>
              <p style={{ ...LINE, marginTop: 6, fontSize: 150, color: C.yellow, transform: `scale(${pop(frame, fps, AT.punch)})` }}>{T.punch}</p>
            </>
          )}
        </div>
      </div>
      <EndCard ground={C.blue} ink="#FFFFFF" puhu="wave" enter={VIDEO.endCardFrom} tag={null} />
    </Frame>
  );
}
