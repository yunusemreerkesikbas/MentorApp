import { Img, staticFile } from "remotion";
import { ART } from "../art";
import { C } from "../brand";
import { COPY } from "../copy";
import { Frame } from "../components/Frame";
import { Logo } from "../components/Logo";
import { MasaChip } from "../components/MasaChip";
import { Phone } from "../components/Phone";
import { Sparkle } from "../components/Sparkle";
import type { PieceProps } from "../pieces";

const T = COPY.F1!;

// The focus ring on the phone: 70% of the circle in brand blue.
function FocusRing() {
  return (
    <div style={{ position: "relative", width: 262, height: 262 }}>
      <svg aria-hidden="true" viewBox="0 0 262 262" style={{ position: "absolute", inset: 0, width: 262, height: 262 }}>
        <circle cx="131" cy="131" r="114" fill="#FFFFFF" stroke={C.tint2} strokeWidth="20" />
        <circle
          cx="131"
          cy="131"
          r="114"
          fill="none"
          stroke={C.blue}
          strokeWidth="20"
          strokeLinecap="round"
          strokeDasharray="716.3"
          strokeDashoffset="215"
          transform="rotate(-90 131 131)"
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 78, fontWeight: 1000, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", color: C.navy }}>{T.timer}</span>
        <span style={{ fontSize: 19, fontWeight: 900, color: C.grey }}>{T.timerLabel}</span>
      </div>
    </div>
  );
}

export function F1Screen() {
  return (
    <div style={{ position: "relative", boxSizing: "border-box", padding: "14px 20px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div style={{ width: 116, height: 32, borderRadius: 999, background: "#0E1B30" }} />
      <div style={{ alignSelf: "stretch", marginTop: 28, height: 210, borderRadius: 28, background: C.tint }} />
      <MasaChip count={4} fontSize={20} />
      <FocusRing />
    </div>
  );
}

// The masa scene bursting out of the top of the phone screen.
export function MasaPopOut() {
  return (
    <Img
      src={staticFile(ART.masa)}
      alt={T.altMasa}
      style={{ position: "absolute", left: 7, top: 60, width: 359, height: 219, filter: "drop-shadow(0 10px 10px rgba(6, 14, 40, 0.35))" }}
    />
  );
}

export function F1({ safe }: PieceProps) {
  return <F1Art badge={T.badge} safe={safe} />;
}

// The artboard with any pill text: IF5 reuses it with the feature-ad series pill.
export function F1Art({ badge, safe }: { badge: string; safe: boolean }) {
  return (
    <Frame format="feed" background={C.blue} safe={safe}>
      <div aria-hidden="true" style={{ position: "absolute", left: -220, top: 620, width: 820, height: 820, borderRadius: "50%", background: "#FFFFFF", opacity: 0.08 }} />

      <Sparkle x={870} y={300} size={84} color={C.yellow} />
      <Sparkle x={975} y={430} size={46} color={C.sky} />
      <Sparkle x={500} y={720} size={40} color="#FFFFFF" />

      {/* Whistle burst lines */}
      <svg aria-hidden="true" viewBox="0 0 120 120" style={{ position: "absolute", left: 640, top: 140, width: 120, height: 120 }}>
        {["M20 70 L52 26", "M48 88 L96 60", "M60 108 L108 104"].map((d) => (
          <path key={d} d={d} stroke={C.yellow} strokeWidth="12" strokeLinecap="round" fill="none" />
        ))}
      </svg>

      <div style={{ position: "absolute", left: 64, right: 64, top: 56, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Logo size={52} color="#FFFFFF" />
        <span style={{ display: "inline-block", background: C.yellow, color: C.navy, fontSize: 26, fontWeight: 900, letterSpacing: "0.08em", padding: "14px 28px", borderRadius: 999, transform: "rotate(-4deg)", boxShadow: `0 6px 0 ${C.navy}` }}>
          {badge}
        </span>
      </div>

      <div style={{ position: "absolute", left: 64, top: 172 }}>
        <h1 style={{ margin: 0, fontWeight: 1000, fontSize: 140, lineHeight: 0.9, letterSpacing: "-0.035em", color: "#FFFFFF" }}>
          {T.head1}
          <br />
          {T.head2}
        </h1>
        <p style={{ margin: "10px 0 0 -4px", fontWeight: 1000, fontSize: 196, lineHeight: 0.9, letterSpacing: "-0.04em", color: C.yellow, transform: "rotate(-3deg)", transformOrigin: "left center" }}>
          {T.punch}
        </p>
        <svg aria-hidden="true" viewBox="0 0 640 40" style={{ display: "block", width: 640, height: 40, marginTop: 4 }}>
          <path d="M6 28 C160 8 340 6 634 18" stroke={C.yellow} strokeWidth="9" strokeLinecap="round" fill="none" />
          <path d="M70 36 C230 24 390 22 540 30" stroke={C.yellow} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.7" />
        </svg>
      </div>

      <p style={{ position: "absolute", left: 64, top: 672, margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: "0.06em", color: C.tint }}>{T.exams}</p>

      <Phone
        width={470}
        screenBg={C.screen}
        style={{ left: 580, top: 636, transform: "rotate(4deg)", filter: "drop-shadow(0 36px 46px rgba(6, 14, 40, 0.45))" }}
        screen={<F1Screen />}
        popOut={<MasaPopOut />}
      />

      <Img
        src={staticFile(ART.p1)}
        alt={T.altPuhu}
        style={{ position: "absolute", left: -10, top: 712, width: 520, height: 522, objectFit: "contain", transform: "scaleX(-1)" }}
      />

      <div style={{ position: "absolute", left: 64, bottom: 52, display: "flex", alignItems: "baseline", gap: 18 }}>
        <span style={{ fontSize: 46, fontWeight: 1000, color: "#FFFFFF" }}>{T.site}</span>
        <span style={{ fontSize: 28, fontWeight: 800, color: C.tint }}>{T.handle}</span>
      </div>
    </Frame>
  );
}
