import type { CSSProperties, ReactNode } from "react";
import { Img, staticFile } from "remotion";
import { ART, type ArtKey } from "../art";
import { C } from "../brand";
import { Frame } from "./Frame";
import { Logo } from "./Logo";
import { Sparkle } from "./Sparkle";

// Feature ads ("Puhu iş başında"): what every feed post in the series shares. Canvas board F-Koruma-Post.

export type Placed = { art: ArtKey; alt: string; left: number; top: number; width: number; height: number };

export function Puhu({ art, alt, left, top, width, height, style }: Placed & { style?: CSSProperties }) {
  return <Img src={staticFile(ART[art])} alt={alt} style={{ position: "absolute", left, top, width, height, objectFit: "contain", ...style }} />;
}

// Generic notification glyphs: never a platform's own mark.
const GLYPH = {
  chat: "M4 5h16v11H9l-5 4z",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  play: "M8 5l11 7-11 7z",
  bell: "M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4",
} as const;
const BADGE_RED = "#E11D48";

// A white app-icon tile with a red count badge. The badge keeps one size; the tile scales.
export function NotifChip({ x, y, size, rotate, glyph, badge, style }: { x: number; y: number; size: number; rotate: number; glyph: keyof typeof GLYPH; badge: string; style?: CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", left: x, top: y, width: size, height: size, borderRadius: Math.round(size * 0.288), background: "#FFFFFF", boxShadow: `0 8px 0 ${C.navy}`, transform: `rotate(${rotate}deg)`, display: "flex", alignItems: "center", justifyContent: "center", ...style }}
    >
      <svg viewBox="0 0 24 24" style={{ width: "56%", height: "56%" }}>
        <path d={GLYPH[glyph]} fill="none" stroke={glyph === "heart" ? BADGE_RED : C.blue} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{ position: "absolute", right: -16, top: -16, minWidth: 52, height: 52, boxSizing: "border-box", padding: "0 12px", borderRadius: 999, background: BADGE_RED, border: `4px solid ${C.navy}`, color: "#FFFFFF", fontSize: 28, fontWeight: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {badge}
      </span>
    </div>
  );
}

// The focus-session timer as a white pill: ring, time, label.
export function TimerPill({ time, label, style }: { time: string; label: string; style?: CSSProperties }) {
  return (
    <div style={{ position: "absolute", display: "flex", alignItems: "center", gap: 18, background: "#FFFFFF", color: C.navy, padding: "14px 30px 14px 16px", borderRadius: 999, boxShadow: `0 8px 0 ${C.navy}`, ...style }}>
      <svg aria-hidden="true" viewBox="0 0 64 64" style={{ width: 68, height: 68 }}>
        <circle cx="32" cy="32" r="25" fill="none" stroke={C.tint2} strokeWidth="9" />
        <circle cx="32" cy="32" r="25" fill="none" stroke={C.blue} strokeWidth="9" strokeLinecap="round" strokeDasharray="157" strokeDashoffset="38" transform="rotate(-90 32 32)" />
      </svg>
      <div>
        <p style={{ margin: 0, fontSize: 46, fontWeight: 1000, lineHeight: 1, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{time}</p>
        <p style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 900, lineHeight: 1.1, color: C.grey }}>{label}</p>
      </div>
    </div>
  );
}

export const PILL: CSSProperties = { display: "inline-block", background: C.yellow, color: C.navy, fontSize: 26, fontWeight: 900, letterSpacing: "0.08em", padding: "14px 28px", borderRadius: 999, transform: "rotate(-4deg)", boxShadow: `0 6px 0 ${C.navy}` };

// Logo and series pill, a two-line headline, a three-line body, Puhu in costume, the footer.
// `children` are the piece's own feature element and props, drawn above Puhu.
export function SeriesFeed({
  copy: T,
  puhu,
  size1 = 124,
  size2 = 150,
  bodySize = 42,
  safe,
  children,
}: {
  copy: Record<string, string>;
  puhu?: Placed;
  size1?: number;
  size2?: number;
  bodySize?: number;
  safe: boolean;
  children?: ReactNode;
}) {
  return (
    <Frame format="feed" background={C.blue} safe={safe}>
      <div aria-hidden="true" style={{ position: "absolute", left: 350, top: 560, width: 820, height: 820, borderRadius: "50%", background: "#FFFFFF", opacity: 0.08 }} />
      <Sparkle x={940} y={470} size={70} color={C.yellow} />
      <Sparkle x={560} y={500} size={40} color={C.sky} />

      <div style={{ position: "absolute", left: 64, right: 64, top: 56, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Logo size={52} color="#FFFFFF" />
        <span style={PILL}>{T.pill}</span>
      </div>

      <div style={{ position: "absolute", left: 64, top: 172 }}>
        <h1 style={{ margin: 0, fontWeight: 1000, fontSize: size1, lineHeight: 0.9, letterSpacing: "-0.035em", color: "#FFFFFF", whiteSpace: "nowrap" }}>{T.head1}</h1>
        <p style={{ margin: "22px 0 0 -4px", fontWeight: 1000, fontSize: size2, lineHeight: 0.9, letterSpacing: "-0.04em", color: C.yellow, transform: "rotate(-3deg)", transformOrigin: "left center", whiteSpace: "nowrap" }}>{T.head2}</p>
        <svg aria-hidden="true" viewBox="0 0 640 40" style={{ display: "block", width: 640, height: 40, marginTop: 4 }}>
          <path d="M6 28 C160 8 340 6 634 18" stroke={C.yellow} strokeWidth="9" strokeLinecap="round" fill="none" />
          <path d="M70 36 C230 24 390 22 540 30" stroke={C.yellow} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.7" />
        </svg>
      </div>

      <p style={{ position: "absolute", left: 64, top: 524, width: 440, margin: 0, fontSize: bodySize, fontWeight: 900, lineHeight: 1.18, color: C.tint }}>
        <span style={{ color: "#FFFFFF" }}>{T.body1}</span>
        <br />
        {T.body2}
        <br />
        {T.body3}
      </p>

      {puhu ? <Puhu {...puhu} /> : null}
      {children}

      <div style={{ position: "absolute", left: 64, bottom: 48, display: "flex", alignItems: "baseline", gap: 16 }}>
        <span style={{ fontSize: 42, fontWeight: 1000, color: "#FFFFFF" }}>{T.site}</span>
        <span style={{ fontSize: 26, fontWeight: 800, color: C.tint }}>{T.handle}</span>
      </div>
    </Frame>
  );
}
