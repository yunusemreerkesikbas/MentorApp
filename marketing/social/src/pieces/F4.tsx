// F4 "Puhu'yla bir gün", 5-card carousel (direction A).
// Claim check, 2026-11-08:
// - Card 3 nickname: "Gizli Kahraman" is committed (apps/api coaching.json TITLE_FOCUS_TRAVELER_LABEL),
//   so the card uses the spec line with the nickname.
// - Roadmap (sinav-kocluk-roadmap.md): daily plan is Faz 1. The study table ("canlı çalışma odası")
//   and the human koç are listed under Faz 2; the weekly summary is not listed. The app already has
//   all three, so the owner confirms they are live at launch before these cards are posted.
import type { ReactNode } from "react";
import { Img, staticFile } from "remotion";
import { ART, SCREENS } from "../art";
import { C } from "../brand";
import { COPY } from "../copy";
import { Frame } from "../components/Frame";
import { Logo } from "../components/Logo";
import { Phone } from "../components/Phone";
import { TradingCard } from "../t1/parts/TradingCard";
import { Sparkle } from "../components/Sparkle";
import type { PieceProps } from "../pieces";
import { F1Screen, MasaPopOut } from "./F1";

const T = COPY.F4!;

// A real app screen fills the phone, top-aligned so the status bar stays.
const Screen = ({ src }: { src: string }) => (
  <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
);

// Card 3 has no phone: the app's weekly nickname card (gold trading card) stands in its place, as in IF6.
const NickCard = () => (
  <TradingCard art="t1CharHidden" name={T.s3Nick} msg={T.s3NickMsg} style={{ left: 556, top: 520, transformOrigin: "0 0", transform: "rotate(5deg) scale(0.78)" }} />
);

type Puhu = { src: string; alt: string; left: number; top: number; width: number; height: number };
type Card = { time: string; line: string; screen?: ReactNode; side?: ReactNode; popOut?: ReactNode; rotate: number; puhu?: Puhu };

// Side Puhus use high-res art only (the small mascot PNGs go soft above ~300 px).
const CARDS: Card[] = [
  { time: T.c1Time, line: T.c1Line, screen: <Screen src={SCREENS.today} />, rotate: 5, puhu: { src: ART.host, alt: T.c1Alt, left: 20, top: 700, width: 470, height: 588 } },
  { time: T.c2Time, line: T.c2Line, screen: <Screen src={SCREENS.masa} />, rotate: 4 },
  { time: T.c3Time, line: T.c3Line, side: <NickCard />, rotate: 6, puhu: { src: ART.mindBlown, alt: T.c3Alt, left: 30, top: 760, width: 470, height: 486 } },
  { time: T.c4Time, line: T.c4Line, screen: <Screen src={SCREENS.koc} />, rotate: 5, puhu: { src: ART.p3, alt: T.c4Alt, left: 0, top: 1010, width: 540, height: 360 } },
];

const pill = {
  display: "inline-block",
  background: C.yellow,
  color: C.navy,
  fontSize: 30,
  fontWeight: 1000,
  padding: "14px 28px",
  borderRadius: 999,
  transform: "rotate(-4deg)",
  boxShadow: `0 6px 0 ${C.navy}`,
} as const;

function Backdrop({ low = true }: { low?: boolean }) {
  return (
    <>
      <div aria-hidden="true" style={{ position: "absolute", left: -220, top: 760, width: 820, height: 820, borderRadius: "50%", background: "#FFFFFF", opacity: 0.08 }} />
      <Sparkle x={930} y={330} size={70} color={C.yellow} />
      <Sparkle x={470} y={440} size={40} color="#FFFFFF" />
      {low ? <Sparkle x={150} y={1230} size={50} color={C.sky} /> : null}
    </>
  );
}

function DayCard({ c, n }: { c: Card; n: number }) {
  return (
    <>
      <Backdrop />
      <div style={{ position: "absolute", left: 64, right: 64, top: 56, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Logo size={52} color="#FFFFFF" />
        {n === 1 ? <span style={pill}>{T.title}</span> : null}
      </div>
      <p style={{ position: "absolute", left: 60, top: 150, margin: 0, fontSize: 150, fontWeight: 1000, lineHeight: 0.95, letterSpacing: "-0.04em", color: C.yellow }}>{c.time}</p>
      <p style={{ position: "absolute", left: 64, top: 330, width: 450, margin: 0, fontSize: 56, fontWeight: 1000, lineHeight: 1.08, letterSpacing: "-0.02em", color: "#FFFFFF" }}>{c.line}</p>
      {c.puhu ? (
        <Img src={staticFile(c.puhu.src)} alt={c.puhu.alt} style={{ position: "absolute", left: c.puhu.left, top: c.puhu.top, width: c.puhu.width, height: c.puhu.height, objectFit: "contain" }} />
      ) : null}
      {c.side ?? (
        <Phone
          width={470}
          screenBg={C.screen}
          style={{ left: 548, top: 500, transform: `rotate(${c.rotate}deg)`, filter: "drop-shadow(0 36px 46px rgba(6, 14, 40, 0.45))" }}
          screen={c.screen}
          popOut={c.popOut}
        />
      )}
    </>
  );
}

function ClosingCard() {
  return (
    <>
      <Backdrop low={false} />
      <div style={{ position: "absolute", left: 64, right: 64, top: 56, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Logo size={52} color="#FFFFFF" />
        <span style={{ ...pill, fontSize: 26, fontWeight: 900, letterSpacing: "0.08em" }}>{T.c5Badge}</span>
      </div>
      <p style={{ position: "absolute", left: 60, top: 190, width: 760, margin: 0, fontSize: 196, fontWeight: 1000, lineHeight: 0.9, letterSpacing: "-0.04em", color: C.yellow }}>{T.c5Head}</p>
      <svg aria-hidden="true" viewBox="0 0 640 40" style={{ position: "absolute", left: 64, top: 560, width: 640, height: 40 }}>
        <path d="M6 28 C160 8 340 6 634 18" stroke={C.yellow} strokeWidth="9" strokeLinecap="round" fill="none" />
        <path d="M70 36 C230 24 390 22 540 30" stroke={C.yellow} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.7" />
      </svg>
      <Img src={staticFile(ART.p1)} alt={T.c5Alt} style={{ position: "absolute", left: 500, top: 590, width: 740, height: 742, objectFit: "contain" }} />
      <div style={{ position: "absolute", left: 64, top: 700 }}>
        <p style={{ margin: 0, fontSize: 62, fontWeight: 1000, letterSpacing: "-0.02em", color: "#FFFFFF" }}>{T.c5Site}</p>
        <p style={{ margin: "6px 0 0", fontSize: 32, fontWeight: 800, color: C.tint }}>{T.c5Handle}</p>
      </div>
      <p style={{ position: "absolute", left: 64, bottom: 60, margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: "0.06em", color: C.tint }}>{T.c5Exams}</p>
    </>
  );
}

export function F4({ safe, card = 1 }: PieceProps) {
  return (
    <Frame format="feed" background={C.blue} safe={safe}>
      {card <= 4 ? <DayCard c={CARDS[card - 1]} n={card} /> : <ClosingCard />}
    </Frame>
  );
}
