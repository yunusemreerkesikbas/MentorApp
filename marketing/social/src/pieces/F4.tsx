// F4 "Puhu'yla bir gün", 5-card carousel (direction A).
// Claim check, 2026-11-08:
// - Card 3 nickname: "Gizli Kahraman" is committed (apps/api coaching.json TITLE_FOCUS_TRAVELER_LABEL),
//   so the card uses the spec line with the nickname.
// - Roadmap (sinav-kocluk-roadmap.md): daily plan is Faz 1. The study table ("canlı çalışma odası")
//   and the human koç are listed under Faz 2; the weekly summary is not listed. The app already has
//   all three, so the owner confirms they are live at launch before these cards are posted.
import type { ReactNode } from "react";
import { Img, staticFile } from "remotion";
import { ART } from "../art";
import { C } from "../brand";
import { COPY } from "../copy";
import { Frame } from "../components/Frame";
import { Logo } from "../components/Logo";
import { Phone } from "../components/Phone";
import { Sparkle } from "../components/Sparkle";
import type { PieceProps } from "../pieces";
import { F1Screen, MasaPopOut } from "./F1";

const T = COPY.F4!;

const Island = () => <div aria-hidden="true" style={{ width: 116, height: 32, borderRadius: 999, background: "#0E1B30" }} />;

// Screen shell: island, a big title, then the card's two or three elements.
function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ boxSizing: "border-box", padding: "14px 20px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <Island />
      <p style={{ alignSelf: "flex-start", margin: "12px 0 0 4px", fontSize: 46, fontWeight: 1000, letterSpacing: "-0.02em", color: C.navy }}>{title}</p>
      {children}
    </div>
  );
}

function Check({ done }: { done: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 60 60" style={{ width: 44, height: 44, flexShrink: 0, overflow: "visible" }}>
      <rect x="3" y="3" width="54" height="54" rx="14" fill={done ? C.blue : "none"} stroke={done ? C.blue : C.navy} strokeWidth="5" />
      {done ? <path d="M15 31 L26 42 L46 18" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
    </svg>
  );
}

const card = { alignSelf: "stretch", background: "#FFFFFF", borderRadius: 24, boxShadow: "0 4px 0 rgba(15, 34, 51, 0.08)" } as const;

function TodayScreen() {
  const rows: [string, boolean][] = [
    [T.s1Row1, true],
    [T.s1Row2, false],
    [T.s1Row3, false],
  ];
  return (
    <Shell title={T.s1Title}>
      <span style={{ alignSelf: "flex-start", marginTop: -8, marginLeft: 4, background: C.tint2, color: C.tintInk, fontSize: 19, fontWeight: 1000, padding: "9px 16px", borderRadius: 999 }}>{T.s1Chip}</span>
      {rows.map(([label, done]) => (
        <div key={label} style={{ ...card, height: 108, display: "flex", alignItems: "center", gap: 18, padding: "0 22px", boxSizing: "border-box" }}>
          <Check done={done} />
          <span style={{ fontSize: 30, fontWeight: 1000, color: done ? "#6B7280" : C.navy, textDecoration: done ? "line-through" : undefined, textDecorationThickness: 3 }}>{label}</span>
        </div>
      ))}
    </Shell>
  );
}

const BARS = [0.45, 0.7, 0.35, 0.9, 0.6, 1, 0.75];

function WeekScreen() {
  return (
    <Shell title={T.s3Title}>
      <div style={{ ...card, padding: "22px 22px 20px", boxSizing: "border-box" }}>
        <p style={{ margin: 0, fontSize: 52, fontWeight: 1000, letterSpacing: "-0.03em", lineHeight: 1, color: C.blue, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{T.s3Total}</p>
        <p style={{ margin: "6px 0 18px", fontSize: 19, fontWeight: 900, color: C.grey }}>{T.s3TotalLabel}</p>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 130 }}>
          {BARS.map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h * 100}%`, borderRadius: 8, background: i === 5 ? C.blue : C.tint }} />
          ))}
        </div>
      </div>
      <div style={{ alignSelf: "stretch", background: C.yellow, borderRadius: 24, padding: "18px 22px", boxShadow: `0 6px 0 ${C.navy}`, transform: "rotate(-2deg)" }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: C.navy, opacity: 0.75 }}>{T.s3NickLabel}</p>
        <p style={{ margin: "2px 0 0", fontSize: 38, fontWeight: 1000, letterSpacing: "-0.02em", color: C.navy }}>{T.s3Nick}</p>
      </div>
    </Shell>
  );
}

function KocScreen() {
  return (
    <Shell title={T.s4Title}>
      <div style={{ alignSelf: "stretch", display: "flex", alignItems: "flex-end", gap: 10 }}>
        <div aria-hidden="true" style={{ width: 44, height: 44, borderRadius: "50%", background: C.inkBlue, border: "4px solid #FFFFFF", boxSizing: "border-box", flexShrink: 0 }} />
        <div style={{ ...card, flex: 1, borderRadius: "26px 26px 26px 6px", padding: "16px 16px" }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: C.inkBlue }}>{T.s4From}</p>
          <p style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 1000, lineHeight: 1.12, color: C.navy }}>{T.s4Message}</p>
        </div>
      </div>
      <div style={{ alignSelf: "flex-end", background: C.blue, color: "#FFFFFF", borderRadius: "26px 26px 6px 26px", padding: "18px 24px", fontSize: 30, fontWeight: 1000 }}>{T.s4Reply}</div>
      {/* The koç is typing again: three dots, no words. */}
      <div style={{ ...card, alignSelf: "flex-start", marginLeft: 54, width: 96, height: 52, borderRadius: "26px 26px 26px 6px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {[1, 0.6, 0.35].map((o) => (
          <span key={o} aria-hidden="true" style={{ width: 12, height: 12, borderRadius: "50%", background: C.inkBlue, opacity: o }} />
        ))}
      </div>
    </Shell>
  );
}

type Puhu = { src: string; alt: string; left: number; top: number; width: number; height: number };
type Card = { time: string; line: string; screen: ReactNode; popOut?: ReactNode; rotate: number; puhu?: Puhu };

// Side Puhus use high-res art only (the small mascot PNGs go soft above ~300 px).
const CARDS: Card[] = [
  { time: T.c1Time, line: T.c1Line, screen: <TodayScreen />, rotate: 5, puhu: { src: ART.host, alt: T.c1Alt, left: 20, top: 700, width: 470, height: 588 } },
  { time: T.c2Time, line: T.c2Line, screen: <F1Screen />, popOut: <MasaPopOut />, rotate: 4 },
  { time: T.c3Time, line: T.c3Line, screen: <WeekScreen />, rotate: 6, puhu: { src: ART.mindBlown, alt: T.c3Alt, left: 30, top: 760, width: 470, height: 486 } },
  { time: T.c4Time, line: T.c4Line, screen: <KocScreen />, rotate: 5, puhu: { src: ART.p3, alt: T.c4Alt, left: 0, top: 1010, width: 540, height: 360 } },
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
      <Phone
        width={470}
        screenBg={C.screen}
        style={{ left: 548, top: 500, transform: `rotate(${c.rotate}deg)`, filter: "drop-shadow(0 36px 46px rgba(6, 14, 40, 0.45))" }}
        screen={c.screen}
        popOut={c.popOut}
      />
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
