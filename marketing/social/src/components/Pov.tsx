import type { ReactNode } from "react";
import { C } from "../brand";
import { Frame } from "./Frame";
import { LinkGuide } from "./LinkGuide";
import { Logo } from "./Logo";
import { Puhu, type Placed } from "./Series";
import { Sparkle } from "./Sparkle";

// Feature ads, POV stories: the student's line, Puhu's dry reply, the feature as the answer.
// Canvas board F-POV-Story. The card runs off the right edge so a cropped peek (p2) hides behind it.

export function CardRow({ tag, text, meta }: { tag: string; text: string; meta?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, height: 78, padding: "0 24px", background: "#FFFFFF", borderRadius: 22 }}>
      <span style={{ flex: "none", boxSizing: "border-box", minWidth: 92, textAlign: "center", background: C.tint2, color: C.tintInk, fontSize: 28, fontWeight: 1000, padding: "6px 14px", borderRadius: 999, fontVariantNumeric: "tabular-nums" }}>{tag}</span>
      <span style={{ flex: 1, fontSize: 36, fontWeight: 900 }}>{text}</span>
      {meta ? <span style={{ fontSize: 30, fontWeight: 900, color: C.grey, fontVariantNumeric: "tabular-nums" }}>{meta}</span> : null}
    </div>
  );
}

export function PovStory({
  copy: T,
  puhu,
  quoteSize = 96,
  bubbleSize = 50,
  bare = false,
  guide,
  guides,
  safe,
  children,
}: {
  copy: Record<string, string>;
  puhu: Placed;
  quoteSize?: number;
  bubbleSize?: number;
  // No white card: the piece places its own feature element (IS6's trading card).
  bare?: boolean;
  // Where the link sticker goes when the default spot (left, under the bubble) is taken.
  guide?: { left: number; top: number };
  guides: boolean;
  safe: boolean;
  children: ReactNode;
}) {
  return (
    <Frame format="story" background={C.blue} safe={safe}>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "repeating-conic-gradient(from 0deg at 66% 56%, rgba(255, 255, 255, 0.09) 0deg 11deg, rgba(255, 255, 255, 0) 11deg 30deg)" }} />
      <Sparkle x={40} y={690} size={80} color={C.yellow} />
      <Sparkle x={962} y={500} size={58} color={C.sky} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 262, display: "flex", justifyContent: "center" }}>
        <Logo size={52} color="#FFFFFF" />
      </div>

      <div style={{ position: "absolute", left: 64, right: 64, top: 350, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <span style={{ display: "inline-block", background: C.yellow, color: C.navy, fontSize: 44, fontWeight: 1000, letterSpacing: "0.02em", padding: "10px 30px", borderRadius: 999, transform: "rotate(-4deg)", boxShadow: `0 7px 0 ${C.navy}` }}>{T.pov}</span>
        <h1 style={{ margin: "30px 0 0", fontWeight: 1000, fontSize: quoteSize, lineHeight: 0.95, letterSpacing: "-0.035em", color: "#FFFFFF" }}>
          {T.quote1}
          <br />
          {T.quote2}
        </h1>
        <p style={{ margin: 0, fontWeight: 1000, fontSize: 132, lineHeight: 0.9, letterSpacing: "-0.04em", color: "#FFFFFF" }}>{T.dedin}</p>
      </div>

      <Puhu {...puhu} />

      <div style={{ position: "absolute", left: 56, top: 812, width: 500, boxSizing: "border-box", padding: "30px 34px", background: "#FFFFFF", color: C.navy, borderRadius: 44, transform: "rotate(-4deg)", boxShadow: `0 12px 0 ${C.navy}` }}>
        <svg aria-hidden="true" viewBox="0 0 60 56" style={{ position: "absolute", right: -48, bottom: 34, width: 60, height: 56, overflow: "visible" }}>
          <path d="M0 0 L60 38 L0 56 Z" fill="#FFFFFF" />
        </svg>
        <p style={{ margin: 0, fontSize: 56, fontWeight: 1000, lineHeight: 1 }}>{T.kanka1}</p>
        <p style={{ margin: "6px 0 0", fontSize: bubbleSize, fontWeight: 1000, lineHeight: 1, letterSpacing: "-0.02em", color: C.blue, whiteSpace: "nowrap" }}>{T.kanka2}</p>
      </div>

      <LinkGuide
        show={guides}
        style={{ position: "absolute", left: guide?.left ?? 64, top: guide?.top ?? 1070, width: 360, height: 92, border: "4px dashed rgba(255, 255, 255, 0.8)", borderRadius: 22, textAlign: "center", fontSize: 25, letterSpacing: "0.02em", lineHeight: 1.15, color: "#FFFFFF" }}
      />

      {bare ? (
        children
      ) : (
        <div style={{ position: "absolute", left: 64, top: 1244, width: 1100, boxSizing: "border-box", padding: "32px 120px 32px 36px", background: C.screen, color: C.navy, borderRadius: 48, transform: "rotate(-1.5deg)", boxShadow: `0 14px 0 ${C.navy}`, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ margin: 0, fontSize: 54, fontWeight: 1000, lineHeight: 1.1, letterSpacing: "-0.02em" }}>{T.cardTitle}</p>
            {T.cardChip ? <span style={{ display: "inline-block", background: C.blue, color: "#FFFFFF", fontSize: 28, fontWeight: 1000, padding: "10px 24px", borderRadius: 999 }}>{T.cardChip}</span> : null}
          </div>
          {children}
        </div>
      )}
    </Frame>
  );
}
