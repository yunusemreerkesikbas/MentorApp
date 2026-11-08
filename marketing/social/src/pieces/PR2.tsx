import { Loop, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CLIPS } from "../art";
import { C, REEL_CENTRE, REEL_TEXT } from "../brand";
import { COPY, PREMIUM_SALE_OPEN } from "../copy";
import { EndCard } from "../components/EndCard";
import { Frame } from "../components/Frame";
import { PremiumPill, Sticker } from "../components/Premium";
import { Sparkle } from "../components/Sparkle";
import { countAt, pop, shake, slam } from "../motion";
import { PIECES, type PieceProps } from "../pieces";
import { CometTail, FLIGHT_MASK } from "./PF2";

const T = COPY.PR2!;
const VIDEO = PIECES.find((p) => p.id === "PR2")!.video!;

// Beat grid (frames at 30 fps, one beat = 15).
const AT = { head1: 6, head2: 21, fly: 30, chips: [75, 120, 165] } as const;
const CHIPS = [T.chip1, T.chip2, T.chip3];
const TILT = [-3, 3, -2];
const PUHU = { left: 80, top: 620, size: 940 } as const;
// The loop clip is 121 frames at 24 fps, i.e. 151 frames at 30.
const LOOP = 151;
const STARS = [
  { x: 900, y: 300, size: 40, at: 0 },
  { x: 80, y: 640, size: 30, at: 4 },
  { x: 800, y: 600, size: 22, at: 8, gold: true },
  { x: 120, y: 1150, size: 26, at: 10, gold: true },
  { x: 860, y: 1420, size: 34, at: 12 },
];
const headline = { position: "absolute", left: REEL_CENTRE.left, width: REEL_CENTRE.right - REEL_CENTRE.left, margin: 0, textAlign: "center", fontWeight: 1000, fontSize: 124, lineHeight: 0.92, letterSpacing: "-0.04em" } as const;

// PF2 in motion: headline stamps, Puhu flies in from the bottom-left with his comet tail, three
// Premium perks pop one by one, then the end card with the Premium pill instead of ÇOK YAKINDA.
export function PR2({ safe }: PieceProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const off = (1 - pop(frame, fps, AT.fly)) * 1200;
  const chip = countAt(frame, AT.chips);
  return (
    <Frame format="reel" background={C.flight} safe={safe}>
      {STARS.map((s) => (
        <Sparkle
          key={`${s.x}-${s.y}`}
          x={s.x}
          y={s.y}
          size={s.size}
          color={s.gold ? C.gold : "#FFFFFF"}
          style={{ transform: `scale(${pop(frame, fps, s.at) * (1 + 0.18 * Math.sin((frame + s.at * 3) / 5))})` }}
        />
      ))}

      <div style={{ position: "absolute", inset: 0, transform: `translate(${-off}px, ${off}px)` }}>
        <Loop durationInFrames={LOOP}>
          <OffthreadVideo
            src={staticFile(CLIPS.premiumFlight)}
            muted
            style={{ position: "absolute", left: PUHU.left, top: PUHU.top, width: PUHU.size, height: PUHU.size, objectFit: "cover", maskImage: FLIGHT_MASK, WebkitMaskImage: FLIGHT_MASK }}
          />
        </Loop>
        <CometTail {...PUHU} />
      </div>

      <p style={{ ...headline, top: 290, color: "#FFFFFF", transform: `scale(${slam(frame, fps, AT.head1)})` }}>{T.head1}</p>
      <p style={{ ...headline, top: 404, color: C.gold, transform: `scale(${slam(frame, fps, AT.head2)}) rotate(${shake(frame, AT.head2) / 3}deg)` }}>{T.head2}</p>

      {chip > 0 ? (
        <div style={{ position: "absolute", left: REEL_CENTRE.left, width: REEL_CENTRE.right - REEL_CENTRE.left, top: 556, display: "flex", justifyContent: "center" }}>
          <span
            key={chip}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 14,
              background: "#FFFFFF",
              color: C.mask,
              fontSize: 46,
              fontWeight: 1000,
              letterSpacing: "-0.01em",
              padding: "18px 36px 18px 26px",
              borderRadius: 999,
              boxShadow: `0 7px 0 ${C.gold}`,
              transform: `rotate(${TILT[chip - 1]}deg) scale(${pop(frame, fps, AT.chips[chip - 1])})`,
            }}
          >
            <svg aria-hidden="true" viewBox="0 0 100 100" style={{ display: "block", width: 34, height: 34 }}>
              <path d="M50 0 C55 35 65 45 100 50 C65 55 55 65 50 100 C45 65 35 55 0 50 C35 45 45 35 50 0 Z" fill={C.gold} />
            </svg>
            {CHIPS[chip - 1]}
          </span>
        </div>
      ) : null}

      <EndCard
        ground={C.flight}
        ink="#FFFFFF"
        puhu="premiumHero"
        enter={VIDEO.endCardFrom}
        tag={PREMIUM_SALE_OPEN ? <Sticker text={T.trial} shadow={C.gold} /> : <PremiumPill label={T.pill} ring />}
      />
    </Frame>
  );
}
