import type { ReactNode } from "react";
import { Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ART, END_CARD_SHIFT, type END_CARD_PUHU } from "../art";
import { C, SITE, SOON } from "../brand";
import { SIZES } from "../pieces";
import { pop } from "../motion";
import { Logo } from "./Logo";

// Shared reel ending, centred on the frame. Its widest part (Puhu, 660 px) spans x 210–870, so it still
// stays inside the reel text box (x 60–900) and clear of the right rail. The ground opens as a circle, then each part pops in on its own beat.
// `tag` replaces the ÇOK YAKINDA pill (Premium reels stay on the profile, so they carry no date).
export function EndCard({ ground, ink, puhu, enter, tag }: { ground: string; ink: string; puhu?: (typeof END_CARD_PUHU)[number]; enter: number; tag?: ReactNode }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < enter) return null;
  const cx = SIZES.reel.width / 2;
  const radius = pop(frame, fps, enter) * 1500;
  const s = (delay: number) => `scale(${pop(frame, fps, enter + delay)})`;
  return (
    <div style={{ position: "absolute", inset: 0, background: ground, clipPath: `circle(${radius}px at ${cx}px 900px)` }}>
      {puhu ? (
        <Img src={staticFile(ART[puhu])} alt="" style={{ position: "absolute", left: cx - 330 + (END_CARD_SHIFT[puhu] ?? 0), top: 270, width: 660, height: 660, objectFit: "contain", transform: s(3) }} />
      ) : null}
      <div style={{ position: "absolute", left: 0, right: 0, top: 960, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, color: ink }}>
        <div style={{ transform: s(6) }}>
          <Logo size={128} color={ink} />
        </div>
        {/* No @handle line: the wordmark already reads "puhukoc" and the platform shows the account. */}
        <span style={{ fontSize: 56, fontWeight: 1000, letterSpacing: "-0.02em", opacity: 0.9, transform: s(9) }}>{SITE}</span>
        {tag !== undefined ? (
          <span style={{ marginTop: 22, display: "inline-block", transform: s(15) }}>{tag}</span>
        ) : (
          <span
            style={{
              marginTop: 22,
              background: C.yellow,
              color: C.navy,
              fontSize: 34,
              fontWeight: 900,
              letterSpacing: "0.08em",
              padding: "16px 34px",
              borderRadius: 999,
              boxShadow: `0 7px 0 ${C.navy}`,
              transform: `rotate(-4deg) ${s(15)}`,
            }}
          >
            {SOON}
          </span>
        )}
      </div>
    </div>
  );
}
