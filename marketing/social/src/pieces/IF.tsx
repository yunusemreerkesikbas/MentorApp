import { C } from "../brand";
import { COPY } from "../copy";
import { NotifChip, Puhu, SeriesFeed, TimerPill } from "../components/Series";
import { Sparkle } from "../components/Sparkle";
import { TapedNote } from "../components/TapedNote";
import type { PieceProps } from "../pieces";
import { TradingCard } from "../t1/parts/TradingCard";
import { F1Art } from "./F1";

// Feature ads, "Puhu iş başında" feed posts. Each is SeriesFeed + one Puhu + one feature element.

// 1 · Odak seansı: the bodyguard. Notifications bounce off his palm.
export function IF1({ safe }: PieceProps) {
  const T = COPY.IF1!;
  return (
    <SeriesFeed copy={T} safe={safe} puhu={{ art: "koruma", alt: T.altPuhu, left: 330, top: 548, width: 770, height: 787 }}>
      <TimerPill time={T.timer} label={T.timerLabel} style={{ left: 64, top: 700 }} />
      <svg aria-hidden="true" viewBox="0 0 140 200" style={{ position: "absolute", left: 262, top: 906, width: 98, height: 140 }}>
        {["M118 20 L62 44", "M104 100 L26 100", "M118 180 L62 156"].map((d) => (
          <path key={d} d={d} stroke={C.yellow} strokeWidth="12" strokeLinecap="round" fill="none" />
        ))}
      </svg>
      <NotifChip x={136} y={830} size={118} rotate={-12} glyph="chat" badge={T.chip1} />
      <NotifChip x={34} y={964} size={136} rotate={9} glyph="heart" badge={T.chip2} />
      <NotifChip x={166} y={1106} size={106} rotate={-8} glyph="play" badge={T.chip3} />
    </SeriesFeed>
  );
}

// 2 · Haftalık plan: the navigator. The week is a route with three stops.
export function IF2({ safe }: PieceProps) {
  const T = COPY.IF2!;
  const stops = [1, 2, 3].map((i) => ({ day: T[`row${i}Tag`], text: T[`row${i}`], time: T[`row${i}Meta`] }));
  return (
    <SeriesFeed copy={T} safe={safe} bodySize={40} puhu={{ art: "navigasyon", alt: T.altPuhu, left: 396, top: 540, width: 694, height: 800 }}>
      <div style={{ position: "absolute", left: 64, top: 712, width: 304, boxSizing: "border-box", padding: "22px 22px 14px", background: "#FFFFFF", color: C.navy, borderRadius: 32, boxShadow: `0 8px 0 ${C.navy}`, transform: "rotate(-3deg)" }}>
        <p style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 1000 }}>{T.cardTitle}</p>
        {stops.map((s, i) => (
          <div key={s.day} style={{ position: "relative", display: "flex", alignItems: "center", gap: 14, height: 80 }}>
            {i < stops.length - 1 ? <div aria-hidden="true" style={{ position: "absolute", left: 19, top: 62, height: 36, borderLeft: `5px dotted ${C.sky}` }} /> : null}
            <span style={{ flex: "none", width: 44, height: 44, borderRadius: "50%", background: i === 0 ? C.blue : C.tint2, color: i === 0 ? "#FFFFFF" : C.tintInk, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 1000 }}>{i + 1}</span>
            <div>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 1000, lineHeight: 1.1 }}>{s.text}</p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: C.grey }}>
                {s.day} · {s.time}
              </p>
            </div>
          </div>
        ))}
      </div>
    </SeriesFeed>
  );
}

// 3 · Yanlış Defterim: the detective. A wrong answer is a wanted suspect.
export function IF3({ safe }: PieceProps) {
  const T = COPY.IF3!;
  return (
    <SeriesFeed copy={T} safe={safe} puhu={{ art: "dedektif", alt: T.altPuhu, left: 392, top: 488, width: 700, height: 770 }}>
      <TapedNote tape={{ left: 96, top: -18, width: 120, height: 36, rotate: -3 }} style={{ left: 64, top: 716, width: 310, padding: "30px 24px 26px", borderRadius: 10, transform: "rotate(-4deg)", boxShadow: `0 8px 0 ${C.navy}`, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 38, fontWeight: 1000, lineHeight: 1, letterSpacing: "0.12em" }}>{T.wanted}</p>
        <div aria-hidden="true" style={{ height: 5, background: C.navy, margin: "12px 0 14px" }} />
        <p style={{ margin: 0, fontSize: 40, fontWeight: 1000, lineHeight: 1, color: C.blue }}>{T.suspect}</p>
        <p style={{ margin: "16px 0 2px", fontSize: 20, fontWeight: 900, color: C.grey }}>{T.seenLabel}</p>
        <p style={{ margin: 0, fontSize: 30, fontWeight: 1000 }}>{T.seen}</p>
      </TapedNote>
      <span style={{ position: "absolute", left: 96, top: 1052, border: `6px solid ${C.yellow}`, borderRadius: 14, padding: "4px 20px", color: C.yellow, fontSize: 42, fontWeight: 1000, letterSpacing: "0.04em", transform: "rotate(7deg)" }}>{T.solved}</span>
    </SeriesFeed>
  );
}

// 4 · Deneme analizi: the weather presenter. The forecast is which topic comes next.
const WEATHER = [
  "M5 12h14M13 6l6 6-6 6",
  "M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 8.5 4.75 4.75 0 0 0 7 18z",
  "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
];

export function IF4({ safe }: PieceProps) {
  const T = COPY.IF4!;
  return (
    <SeriesFeed copy={T} safe={safe} size2={140} puhu={{ art: "hava", alt: T.altPuhu, left: 384, top: 604, width: 716, height: 701 }}>
      <div style={{ position: "absolute", left: 64, top: 712, width: 312, boxSizing: "border-box", padding: "20px 16px 16px", background: "#FFFFFF", color: C.navy, borderRadius: 30, boxShadow: `0 8px 0 ${C.navy}`, transform: "rotate(-3deg)", display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ margin: "0 0 2px 6px", fontSize: 26, fontWeight: 1000 }}>{T.cardTitle}</p>
        {WEATHER.map((d, i) => (
          <div key={d} style={{ display: "flex", alignItems: "center", gap: 12, height: 72, padding: "0 14px", borderRadius: 18, background: i === 0 ? C.yellow : C.screen }}>
            <svg aria-hidden="true" viewBox="0 0 24 24" style={{ flex: "none", width: 38, height: 38 }}>
              <path d={d} fill="none" stroke={i === 0 ? C.navy : C.blue} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <p style={{ margin: 0, fontSize: 26, fontWeight: 1000, lineHeight: 1.1 }}>{T[`row${i + 1}`]}</p>
              <p style={{ margin: 0, fontSize: 19, fontWeight: 900, color: i === 0 ? C.navy : C.grey }}>{T[`row${i + 1}Meta`]}</p>
            </div>
          </div>
        ))}
      </div>
    </SeriesFeed>
  );
}

// 5 · Masa: the referee. F1 as it is, with the series pill.
export function IF5({ safe }: PieceProps) {
  return <F1Art badge={COPY.IF5!.pill} safe={safe} />;
}

// 6 · Haftalık lakap: the host presents this week's nickname, drawn as the app's own trading card.
export function IF6({ safe }: PieceProps) {
  const T = COPY.IF6!;
  return (
    <SeriesFeed copy={T} safe={safe} size1={112} bodySize={38}>
      <Sparkle x={1000} y={640} size={54} color="#FFFFFF" />
      <Sparkle x={500} y={1150} size={46} color={C.yellow} />
      <TradingCard art="t1CharBrave" name={T.nick} msg={T.nickMsg} style={{ left: 556, top: 540, transformOrigin: "0 0", transform: "rotate(5deg) scale(0.78)" }} />
      <Puhu art="host" alt={T.altPuhu} left={36} top={690} width={436} height={545} />
    </SeriesFeed>
  );
}
