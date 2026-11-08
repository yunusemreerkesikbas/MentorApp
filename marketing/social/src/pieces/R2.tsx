import { Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ART, type ArtKey } from "../art";
import { C, REEL_TEXT } from "../brand";
import { COPY } from "../copy";
import { EndCard } from "../components/EndCard";
import { Frame } from "../components/Frame";
import { MasaChip } from "../components/MasaChip";
import { Sparkle } from "../components/Sparkle";
import { countAt, pop, shake, slam } from "../motion";
import { PIECES, type PieceProps } from "../pieces";

const T = COPY.R2!;
const VIDEO = PIECES.find((p) => p.id === "R2")!.video!;
const AT = { masa: 150, stamp: 180 } as const;
// ponytail: high-res poses instead of the 240–320 px happy/proud/encouraging/night, which blur at this size.
const SEATS: { art: ArtKey; at: number; col: number; row: number }[] = [
  { art: "wave", at: 30, col: 0, row: 0 },
  { art: "host", at: 60, col: 1, row: 0 },
  { art: "cryingLaughing", at: 90, col: 0, row: 1 },
  { art: "p1", at: 120, col: 1, row: 1 },
];
const BEATS = SEATS.map((s) => s.at);
const CX = (REEL_TEXT.left + REEL_TEXT.right) / 2;
const CELL = 400;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// The table fills seat by seat, the room slams in, then the rule gets stamped.
export function R2({ safe }: PieceProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const last = BEATS.filter((b) => frame >= b).at(-1);
  const bump = last !== undefined && frame - last < 8 ? 0.14 * (1 - (frame - last) / 8) : 0;
  const out = interpolate(frame, [AT.masa, AT.masa + 12], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const jolt = shake(frame, AT.stamp) * 1.6;
  return (
    <Frame format="reel" background={C.blue} safe={safe}>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "repeating-conic-gradient(from 0deg at 44% 42%, rgba(255, 255, 255, 0.08) 0deg 11deg, rgba(255, 255, 255, 0) 11deg 30deg)" }} />
      <div style={{ position: "absolute", inset: 0, transform: `translate(${jolt}px, ${-jolt / 2}px)` }}>
        <Sparkle x={70} y={330} size={64} color={C.yellow} />
        <Sparkle x={840} y={940} size={56} color="#FFFFFF" />
        <Sparkle x={110} y={1330} size={44} color={C.sky} />

        <div style={{ position: "absolute", left: CX, top: 280, transform: `translateX(-50%) scale(${pop(frame, fps, 0) * (1 + bump)})` }}>
          <MasaChip count={countAt(frame, BEATS)} fontSize={50} background="#FFFFFF" style={{ boxShadow: `0 8px 0 ${C.navy}`, whiteSpace: "nowrap" }} />
        </div>

        {out < 1
          ? SEATS.map((s) => (
              <Img
                key={s.art}
                src={staticFile(ART[s.art])}
                alt={T.altSeat}
                style={{
                  position: "absolute",
                  left: CX - CELL + s.col * CELL,
                  top: 410 + s.row * CELL,
                  width: CELL,
                  height: CELL,
                  objectFit: "contain",
                  transformOrigin: "50% 90%",
                  transform: `translate(${(s.col ? 1 : -1) * 900 * out}px, ${(s.row ? 1 : -1) * 700 * out}px) rotate(${(s.col ? 1 : -1) * 40 * out}deg) scale(${pop(frame, fps, s.at)})`,
                }}
              />
            ))
          : null}

        <Img
          src={staticFile(ART.masa)}
          alt={T.altMasa}
          style={{
            position: "absolute",
            left: REEL_TEXT.left,
            top: 430,
            width: REEL_TEXT.right - REEL_TEXT.left,
            height: 472,
            objectFit: "cover",
            borderRadius: 40,
            border: "10px solid #FFFFFF",
            boxShadow: `0 14px 0 ${C.navy}`,
            transform: `rotate(-2deg) scale(${slam(frame, fps, AT.masa)})`,
          }}
        />

        <div
          style={{
            position: "absolute",
            left: REEL_TEXT.left,
            width: REEL_TEXT.right - REEL_TEXT.left,
            top: 990,
            textAlign: "center",
            transform: `rotate(${-3 + shake(frame, AT.stamp)}deg) scale(${slam(frame, fps, AT.stamp)})`,
          }}
        >
          <p style={{ margin: 0, fontWeight: 1000, fontSize: 124, lineHeight: 0.9, letterSpacing: "-0.035em", color: "#FFFFFF" }}>
            {T.head1}
            <br />
            {T.head2}
          </p>
          <p style={{ margin: "14px 0 0", fontWeight: 1000, fontSize: 184, lineHeight: 0.9, letterSpacing: "-0.04em", color: C.yellow }}>{T.punch}</p>
        </div>
      </div>
      <EndCard ground={C.blue} ink="#FFFFFF" puhu="p1" enter={VIDEO.endCardFrom} />
    </Frame>
  );
}
