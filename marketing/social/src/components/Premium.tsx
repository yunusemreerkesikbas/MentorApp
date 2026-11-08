import type { CSSProperties } from "react";
import { C } from "../brand";
import { Logo } from "./Logo";

// Puhu's hero mask, the app's Premium mark (apps/web/public/visuals/premium-glasses.svg).
const MASK =
  "M3 3C5 2 9 4 11 7C13 5 16 4 19 4C25 4 30 8 31 13C31.7 12.7 32.3 12.7 33 13C34 8 39 4 45 4C48 4 51 5 53 7C55 4 59 2 61 3C63 5 60 8 57 10C59 9 61 9 61 11C61 13 59 14 57 14V17C57 24 52 29 45 29C38 29 33 24 33 18C32.3 17.4 31.7 17.4 31 18C31 24 26 29 19 29C12 29 7 24 7 17V14C5 14 3 13 3 11C3 9 5 9 7 10C4 8 1 5 3 3ZM27 17A8 8 0 1 0 11 17A8 8 0 1 0 27 17ZM53 17A8 8 0 1 0 37 17A8 8 0 1 0 53 17Z";

// Night-blue pill with the gold mask and the label. `ring` adds a gold outline for night grounds.
export function PremiumPill({ label, ring = false }: { label: string; ring?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        background: C.mask,
        color: C.gold,
        fontSize: 26,
        fontWeight: 900,
        letterSpacing: "0.1em",
        padding: "12px 26px 12px 18px",
        borderRadius: 999,
        boxShadow: ring ? `0 0 0 3px ${C.gold}` : undefined,
      }}
    >
      <svg viewBox="0 0 64 32" aria-hidden="true" style={{ display: "block", width: 56, height: 28 }}>
        <path fill={C.blue} stroke={C.gold} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" fillRule="evenodd" d={MASK} />
      </svg>
      {label}
    </span>
  );
}

// Logo left, Premium pill right.
export function PremiumTopBar({ top, ink, label, ring, logoSize = 44 }: { top: number; ink: string; label: string; ring?: boolean; logoSize?: number }) {
  return (
    <div style={{ position: "absolute", left: 56, right: 56, top, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Logo size={logoSize} color={ink} />
      <PremiumPill label={label} ring={ring} />
    </div>
  );
}

// Butter-yellow sticker with a hard drop shadow (ÇOK YAKINDA, or the trial line once buying opens).
export function Sticker({ text, shadow, style }: { text: string; shadow: string; style?: CSSProperties }) {
  return (
    <span
      style={{
        display: "inline-block",
        background: C.yellow,
        color: C.navy,
        fontSize: 28,
        fontWeight: 900,
        letterSpacing: "0.08em",
        padding: "16px 30px",
        borderRadius: 999,
        transform: "rotate(-4deg)",
        boxShadow: `0 7px 0 ${shadow}`,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {text}
    </span>
  );
}
