import { Freeze, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CLIPS } from "../art";
import { C, REEL_CENTRE, REEL_TEXT } from "../brand";
import { COPY, PREMIUM_SALE_OPEN } from "../copy";
import { EndCard } from "../components/EndCard";
import { Frame } from "../components/Frame";
import { PremiumPill, Sticker } from "../components/Premium";
import { pop, shake, slam, slideUp } from "../motion";
import { PIECES, type PieceProps } from "../pieces";
import { HeroToggle } from "./PF1";

const T = COPY.PR1!;
const VIDEO = PIECES.find((p) => p.id === "PR1")!.video!;

// Beat grid (frames at 30 fps). Puhu leaves the top at ~37 and lands at ~66 (clip time 2.2 s).
const AT = { head1: 38, head2: 50, land: 66, toggle: 76, line1: 96, line2: 108 } as const;
// The clip is 5.04 s: hold its last frame (the hero pose) until the end card.
const LAST = 150;
// Clip scaled to 1080x1920 (Puhu's feet at y 1825) and lifted so they meet the floor. The floor is plain
// ground under the caption area; it also hides the KlingAI mark (~30 px below the feet). Text stays above 1500.
const FLOOR = 1600;
const LIFT = 1825 - FLOOR;
const type = { position: "absolute", left: REEL_CENTRE.left, width: REEL_CENTRE.right - REEL_CENTRE.left, margin: 0, textAlign: "center", fontWeight: 1000, lineHeight: 0.86, whiteSpace: "nowrap" } as const;

// PF1 in motion: Puhu crouches in the beam, jumps out the top while KAHRAMAN MODU stamps in, lands like a
// hero (the frame bumps), the AÇIK switch pops, the two lines slide up under the headline, then the end card with the Premium pill.
export function PR1({ safe }: PieceProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bump = shake(frame, AT.land) * 3;
  const line = (at: number) => ({ opacity: Math.min(1, pop(frame, fps, at)), transform: `translateY(${slideUp(frame, fps, at, 40)}px)` });
  return (
    <Frame format="reel" background={C.cream} color={C.mask} safe={safe}>
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${bump}px)` }}>
        <Freeze frame={LAST} active={frame >= LAST}>
          <OffthreadVideo muted src={staticFile(CLIPS.premiumLanding)} style={{ position: "absolute", left: 0, top: -LIFT, width: 1080, height: 1920 }} />
        </Freeze>

        <p style={{ ...type, top: 250, fontSize: 140, letterSpacing: "-0.045em", transform: `scale(${slam(frame, fps, AT.head1)})` }}>{T.head1}</p>
        <p style={{ ...type, top: 351, fontSize: 250, letterSpacing: "-0.05em", transform: `scale(${slam(frame, fps, AT.head2)}) rotate(${shake(frame, AT.head2) / 3}deg)` }}>
          {T.head2.slice(0, 1)}
          <span style={{ color: C.gold }}>{T.head2.slice(1, 2)}</span>
          {T.head2.slice(2)}
        </p>

        <HeroToggle
          label={T.toggle}
          top={770}
          style={{ left: REEL_TEXT.left, right: "auto", transformOrigin: "left center", transform: `rotate(${-5 + shake(frame, AT.toggle)}deg) scale(${1.25 * pop(frame, fps, AT.toggle)})` }}
        />

        <div style={{ position: "absolute", left: 0, right: 0, top: FLOOR, bottom: -80, background: C.mask }} />
        <div style={{ position: "absolute", left: REEL_CENTRE.left, width: REEL_CENTRE.right - REEL_CENTRE.left, top: 596, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 46, fontWeight: 1000, lineHeight: 1.1, letterSpacing: "-0.01em", ...line(AT.line1) }}>{T.line1}</p>
          <p style={{ margin: "6px 0 0", fontSize: 30, fontWeight: 800, lineHeight: 1.25, color: "rgba(30, 42, 90, 0.75)", ...line(AT.line2) }}>{T.line2}</p>
        </div>
      </div>

      <EndCard
        ground={C.cream}
        ink={C.mask}
        puhu="premiumHero"
        enter={VIDEO.endCardFrom}
        tag={PREMIUM_SALE_OPEN ? <Sticker text={T.trial} shadow={C.mask} /> : <PremiumPill label={T.pill} />}
      />
    </Frame>
  );
}
