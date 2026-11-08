import { Img, staticFile } from "remotion";
import { ART } from "../art";
import { C } from "../brand";
import { COPY, PREMIUM_SALE_OPEN } from "../copy";
import { Frame } from "../components/Frame";
import { PremiumTopBar, Sticker } from "../components/Premium";
import { Sparkle } from "../components/Sparkle";
import type { PieceProps } from "../pieces";

const T = COPY.PF2!;

// The flight art sits on its own ground (#020B26); this feathers the square away.
export const FLIGHT_MASK = "radial-gradient(closest-side, #000 74%, transparent 100%)";

export type Star = { x: number; y: number; size: number; gold?: boolean };

export function Sky({ stars }: { stars: Star[] }) {
  return (
    <>
      {stars.map((s) => (
        <Sparkle key={`${s.x}-${s.y}`} x={s.x} y={s.y} size={s.size} color={s.gold ? C.gold : "#FFFFFF"} />
      ))}
    </>
  );
}

export function FlightPuhu({ left, top, size, alt }: { left: number; top: number; size: number; alt: string }) {
  return (
    <Img
      src={staticFile(ART.premiumFlight)}
      alt={alt}
      style={{ position: "absolute", left, top, width: size, height: size, objectFit: "cover", maskImage: FLIGHT_MASK, WebkitMaskImage: FLIGHT_MASK }}
    />
  );
}

// Cape-blue comet tail with a gold rim, drawn for a 900 px flight box at (190, 420) and moved with
// the box, so its tip always meets the end of Puhu's own sparkle trail.
export function CometTail({ left, top, size }: { left: number; top: number; size: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 1080 1920" style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, overflow: "visible" }}>
      <g transform={`translate(${left} ${top}) scale(${size / 900}) translate(-190 -420)`}>
        <path d="M -150 1360 C 40 1255, 190 1195, 340 1162 C 225 1240, 125 1330, 50 1500 Z" fill={C.blue} stroke={C.gold} strokeWidth={10} strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function PelerinHead({ top, head1, head2, body }: { top: number; head1: string; head2: string; body: string }) {
  const big = { margin: 0, fontWeight: 1000, fontSize: 124, lineHeight: 0.92, letterSpacing: "-0.04em" } as const;
  return (
    <div style={{ position: "absolute", left: 60, top, width: 900 }}>
      <p style={big}>{head1}</p>
      <p style={{ ...big, color: C.gold }}>{head2}</p>
      <p style={{ margin: "26px 0 0", width: 560, fontSize: 32, fontWeight: 700, lineHeight: 1.3, color: C.mutedOnNight }}>{body}</p>
    </div>
  );
}

const STARS: Star[] = [
  { x: 930, y: 210, size: 40 },
  { x: 860, y: 380, size: 22, gold: true },
  { x: 96, y: 560, size: 30 },
  { x: 980, y: 1010, size: 34 },
  { x: 640, y: 1200, size: 20, gold: true },
];

// Premium direction 2 · Gece uçuşu (canvas P-Gece). No date on it: puhukoc.com sits in the corner.
export function PF2({ safe }: PieceProps) {
  return (
    <Frame format="feed" background={C.flight} safe={safe}>
      <Sky stars={STARS} />
      <FlightPuhu left={190} top={420} size={900} alt={T.altPuhu} />
      <CometTail left={190} top={420} size={900} />
      <PremiumTopBar top={56} ink="#FFFFFF" label={T.pill} ring />
      <PelerinHead top={160} head1={T.head1} head2={T.head2} body={T.body} />
      <div style={{ position: "absolute", right: 56, bottom: 70 }}>
        {PREMIUM_SALE_OPEN ? (
          <Sticker text={T.trial} shadow={C.gold} style={{ letterSpacing: "0.06em", padding: "18px 30px" }} />
        ) : (
          <span style={{ display: "block", fontSize: 36, fontWeight: 1000, letterSpacing: "-0.01em", color: "#FFFFFF" }}>{T.site}</span>
        )}
      </div>
    </Frame>
  );
}
