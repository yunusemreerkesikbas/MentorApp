import { Img, staticFile } from "remotion";
import { ART, type ArtKey } from "../art";
import { C } from "../brand";
import { caveat } from "../fonts";
import { DOT_PAPER } from "../pieces/F2";
import { Frame } from "./Frame";
import { Logo } from "./Logo";

// Longest headline and body a card holds without a third headline line or a crowded body (test/tip.test.ts).
export const TIP_LIMITS = { head: 30, body: 80 } as const;

const TOTAL = 5;
// One sticker per step card, so no card is type alone.
const STICKERS: Partial<Record<number, [ArtKey, number]>> = { 2: ["facepalm", 6], 3: ["mindBlown", -7], 4: ["nightShift", 5] };

const note = { margin: 0, fontFamily: caveat, fontWeight: 700, lineHeight: 1, color: C.inkBlue, transform: "rotate(-3deg)" } as const;

// One card of an "İşe yarar" carousel (direction C, krem defter). Card 1 is the cover, cards 2–5 are steps 1–4.
export function TipCard({ copy, card, safe }: { copy: Record<string, string>; card: number; safe: boolean }) {
  const head = copy[`c${card}Head`];
  const body = copy[`c${card}Body`];
  const cardNote = copy[`c${card}Note`];
  const sticker = STICKERS[card];
  const cover = card === 1;
  const last = card === TOTAL;
  return (
    <Frame format="feed" background={C.cream} color={C.navy} safe={safe} style={DOT_PAPER}>
      <div style={{ position: "absolute", left: 64, right: 64, top: 64, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ display: "inline-block", background: C.yellow, color: C.navy, fontSize: 26, fontWeight: 900, letterSpacing: "0.08em", padding: "14px 28px", borderRadius: 999, transform: "rotate(-3deg)", boxShadow: `0 6px 0 ${C.navy}` }}>
          {copy.tag}
        </span>
        <span style={{ fontSize: 28, fontWeight: 900, color: C.inkBlue }}>
          {card}/{TOTAL}
        </span>
      </div>

      {cover ? (
        <div style={{ position: "absolute", left: 64, right: 64, top: 200 }}>
          <p style={{ margin: 0, fontSize: 126, fontWeight: 1000, lineHeight: 1.02, letterSpacing: "-0.03em" }}>{head}</p>
          <p style={{ margin: "30px 0 0", fontSize: 64, fontWeight: 1000, lineHeight: 1.1, letterSpacing: "-0.02em", color: C.blue }}>{body}</p>
        </div>
      ) : (
        <div style={{ position: "absolute", left: 64, right: 64, top: 190 }}>
          <div style={{ width: 132, height: 132, borderRadius: 999, background: C.blue, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 84, fontWeight: 1000 }}>{card - 1}</div>
          <p style={{ margin: "44px 0 0", fontSize: 104, fontWeight: 1000, lineHeight: 1.04, letterSpacing: "-0.03em", textWrap: "balance" }}>{head}</p>
          <p style={{ margin: "40px 0 0", maxWidth: 940, fontSize: 58, fontWeight: 800, lineHeight: 1.25, textWrap: "balance" }}>{body}</p>
        </div>
      )}

      {cover ? <p style={{ ...note, position: "absolute", left: 560, top: 900, width: 460, fontSize: 62 }}>{cardNote}</p> : null}
      {cover ? <Img src={staticFile(ART.p3)} alt="" style={{ position: "absolute", left: 45, top: 1099, width: 320, height: 297, objectFit: "contain" }} /> : null}

      {sticker ? <Img src={staticFile(ART[sticker[0]])} alt="" style={{ position: "absolute", right: 50, bottom: 120, width: 430, height: 430, objectFit: "contain", transform: `rotate(${sticker[1]}deg)` }} /> : null}

      {last ? <p style={{ ...note, position: "absolute", left: 64, top: 890, width: 560, fontSize: 58 }}>{cardNote}</p> : null}
      {last ? <Img src={staticFile(ART.wave)} alt="" style={{ position: "absolute", left: 610, top: 850, width: 440, height: 440, objectFit: "contain" }} /> : null}

      <div style={{ position: "absolute", left: cover ? 370 : 64, right: 40, bottom: 31, height: 114, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 8 }}>
        <Logo size={cover || last ? 64 : 44} color="#111111" style={{ lineHeight: 1 }} />
        {cover || last ? <span style={{ fontSize: 24, fontWeight: 900, color: C.inkBlue }}>{copy.footer}</span> : null}
      </div>
    </Frame>
  );
}
