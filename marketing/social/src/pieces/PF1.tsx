import type { CSSProperties } from "react";
import { Img, staticFile } from "remotion";
import { ART } from "../art";
import { C } from "../brand";
import { COPY, PREMIUM_SALE_OPEN } from "../copy";
import { Frame } from "../components/Frame";
import { PremiumTopBar, Sticker } from "../components/Premium";
import { Sparkle } from "../components/Sparkle";
import type { PieceProps } from "../pieces";

const T = COPY.PF1!;

// Flat light falling from the gold O onto Puhu; points are frame px.
export function Beam({ points }: { points: [number, number][] }) {
  const polygon = points.map(([x, y]) => `${x}px ${y}px`).join(", ");
  return <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: C.beam, clipPath: `polygon(${polygon})` }} />;
}

// KAHRAMAN over a giant MODU with a gold O; `top` is KAHRAMAN's top, the O's foot sits at top + 372.
export function HeroType({ top, head1, head2 }: { top: number; head1: string; head2: string }) {
  return (
    <>
      <p style={{ position: "absolute", left: 44, top, margin: 0, fontWeight: 1000, fontSize: 172, lineHeight: 0.86, letterSpacing: "-0.045em", whiteSpace: "nowrap" }}>{head1}</p>
      <p style={{ position: "absolute", left: 34, top: top + 124, margin: 0, fontWeight: 1000, fontSize: 326, lineHeight: 0.86, letterSpacing: "-0.05em", whiteSpace: "nowrap" }}>
        {head2.slice(0, 1)}
        <span style={{ color: C.gold }}>{head2.slice(1, 2)}</span>
        {head2.slice(2)}
      </p>
      <Sparkle x={228} y={top + 162} size={46} color={C.gold} />
      <Sparkle x={520} y={top + 130} size={30} color={C.gold} />
    </>
  );
}

// The "AÇIK" switch, knob on the right.
export function HeroToggle({ label, top, style }: { label: string; top: number; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        right: 50,
        top,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "14px 16px 14px 34px",
        background: C.gold,
        borderRadius: 999,
        boxShadow: `0 8px 0 ${C.mask}`,
        transform: "rotate(-5deg)",
        ...style,
      }}
    >
      <span style={{ fontSize: 44, fontWeight: 1000, letterSpacing: "0.04em", color: C.mask }}>{label}</span>
      <span aria-hidden="true" style={{ display: "block", width: 72, height: 72, borderRadius: 999, background: "#FFFFFF", boxShadow: "inset 0 -5px 0 #E9DCC0" }} />
    </div>
  );
}

// Navy floor the hero stands on, with the two copy lines on the left.
export function HeroFloor({ top, textTop, line1, line2, sizes }: { top: number; textTop: number; line1: string; line2: string; sizes: [number, number] }) {
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top, bottom: 0, background: C.mask }} />
      <div style={{ position: "absolute", left: 56, top: textTop, width: 680, color: "#FFFFFF" }}>
        <p style={{ margin: 0, fontSize: sizes[0], fontWeight: 1000, lineHeight: 1.1, letterSpacing: "-0.01em" }}>{line1}</p>
        <p style={{ margin: "6px 0 0", fontSize: sizes[1], fontWeight: 700, lineHeight: 1.25, color: C.mutedOnNight }}>{line2}</p>
      </div>
    </>
  );
}

// Premium direction 1 · Kahraman modu (canvas P-Isik). No date on it: puhukoc.com sits in the corner.
export function PF1({ safe }: PieceProps) {
  return (
    <Frame format="feed" background={C.cream} color={C.mask} safe={safe}>
      <Beam points={[[366, 510], [540, 510], [960, 1230], [150, 1230]]} />
      <PremiumTopBar top={56} ink={C.mask} label={T.pill} />
      <HeroType top={138} head1={T.head1} head2={T.head2} />
      <HeroToggle label={T.toggle} top={560} />
      <Img src={staticFile(ART.premiumHero)} alt={T.altPuhu} style={{ position: "absolute", left: 40, top: 594, width: 900, height: 643, objectFit: "contain" }} />
      <HeroFloor top={1228} textTop={1256} line1={T.line1} line2={T.line2} sizes={[34, 26]} />
      <div style={{ position: "absolute", right: 50, top: 1250 }}>
        {PREMIUM_SALE_OPEN ? (
          <Sticker text={T.trial} shadow={C.night} style={{ fontSize: 26, letterSpacing: "0.06em", padding: "16px 26px" }} />
        ) : (
          <span style={{ display: "block", marginTop: 18, fontSize: 34, fontWeight: 1000, letterSpacing: "-0.01em", color: "#FFFFFF" }}>{T.site}</span>
        )}
      </div>
    </Frame>
  );
}
