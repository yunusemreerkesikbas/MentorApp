import { Img, staticFile } from "remotion";
import { ART } from "../art";
import { C } from "../brand";
import { COPY } from "../copy";
import { Frame } from "../components/Frame";
import { LinkGuide } from "../components/LinkGuide";
import { Logo } from "../components/Logo";
import { MasaChip } from "../components/MasaChip";
import { Phone } from "../components/Phone";
import { Sparkle } from "../components/Sparkle";
import type { PieceProps } from "../pieces";

const T = COPY.S1!;

// Parts R1 animates. Every default is the canvas rest position.

export function PovHeadline({ popPov = 1, slamHead = 1, stampDedin = 1 }: { popPov?: number; slamHead?: number; stampDedin?: number }) {
  return (
    <div style={{ position: "absolute", left: 64, right: 64, top: 360, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <span style={{ display: "inline-block", background: C.yellow, color: C.navy, fontSize: 44, fontWeight: 1000, letterSpacing: "0.02em", padding: "10px 30px", borderRadius: 999, transform: `rotate(-4deg) scale(${popPov})`, boxShadow: `0 7px 0 ${C.navy}` }}>
        {T.pov}
      </span>
      <h1 style={{ margin: "34px 0 0", fontWeight: 1000, fontSize: 120, lineHeight: 0.95, letterSpacing: "-0.035em", color: "#FFFFFF", transform: `scale(${slamHead})` }}>{T.head}</h1>
      <p style={{ margin: 0, fontWeight: 1000, fontSize: 160, lineHeight: 0.9, letterSpacing: "-0.04em", color: "#FFFFFF", transform: `scale(${stampDedin})` }}>{T.dedin}</p>
    </div>
  );
}

export function KankaBubble({ scale = 1, rotate = -4 }: { scale?: number; rotate?: number }) {
  return (
    <div style={{ position: "absolute", left: 56, top: 770, width: 480, boxSizing: "border-box", padding: "32px 36px", background: "#FFFFFF", color: C.navy, borderRadius: 44, transform: `rotate(${rotate}deg) scale(${scale})`, boxShadow: `0 12px 0 ${C.navy}` }}>
      <svg aria-hidden="true" viewBox="0 0 60 56" style={{ position: "absolute", right: -48, bottom: 34, width: 60, height: 56, overflow: "visible" }}>
        <path d="M0 0 L60 38 L0 56 Z" fill="#FFFFFF" />
      </svg>
      <p style={{ margin: 0, fontSize: 56, fontWeight: 1000, lineHeight: 1 }}>{T.kanka1}</p>
      <p style={{ margin: "4px 0 0", fontSize: 68, fontWeight: 1000, lineHeight: 1, letterSpacing: "-0.02em", color: C.blue }}>{T.kanka2}</p>
    </div>
  );
}

export function PeekPuhu({ y = 0 }: { y?: number }) {
  return <Img src={staticFile(ART.p2)} alt={T.altPeek} style={{ position: "absolute", left: 360, top: 600 + y, width: 760, height: 760, objectFit: "contain" }} />;
}

function StatusRow({ ink }: { ink: string }) {
  return (
    <div style={{ position: "absolute", left: 30, right: 26, top: 12, height: 30, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 17, fontWeight: 1000, fontVariantNumeric: "tabular-nums", color: ink }}>{T.clock}</span>
      <svg aria-hidden="true" viewBox="0 0 52 16" style={{ width: 52, height: 16 }}>
        <rect x="0" y="10" width="4" height="6" rx="1" fill={ink} />
        <rect x="6" y="7" width="4" height="9" rx="1" fill={ink} />
        <rect x="12" y="4" width="4" height="12" rx="1" fill={ink} />
        <rect x="22" y="2" width="26" height="13" rx="3.5" fill="none" stroke={ink} strokeWidth="2" />
        <rect x="25" y="5" width="18" height="7" rx="1.5" fill={ink} />
        <rect x="49.5" y="6" width="2.5" height="5" rx="1" fill={ink} />
      </svg>
    </div>
  );
}

const Island = () => <div aria-hidden="true" style={{ position: "absolute", left: 137, top: 11, width: 104, height: 30, borderRadius: 999, background: "#0E1B30" }} />;

// The "son bir video" the viewer is stuck on (R1 only).
function VideoScreen({ progress }: { progress: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "#111827" }}>
      <StatusRow ink="#FFFFFF" />
      <Island />
      <div style={{ position: "absolute", left: 129, top: 64, width: 120, height: 120, borderRadius: "50%", background: "rgba(255, 255, 255, 0.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg aria-hidden="true" viewBox="0 0 40 46" style={{ width: 40, height: 46, marginLeft: 8 }}>
          <path d="M0 0 L40 23 L0 46 Z" fill="#FFFFFF" />
        </svg>
      </div>
      <div style={{ position: "absolute", left: 20, right: 20, top: 222, height: 6, borderRadius: 3, background: "rgba(255, 255, 255, 0.3)" }}>
        <div style={{ width: `${progress * 100}%`, height: "100%", borderRadius: 3, background: "#FFFFFF" }} />
      </div>
    </div>
  );
}

function PuhuScreen({ wipe, guides }: { wipe: number; guides: boolean }) {
  return (
    <>
      <StatusRow ink={C.navy} />
      <Island />
      <div style={{ position: "absolute", left: 0, right: 0, top: 40, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 21, fontWeight: 1000, lineHeight: 1.1, color: C.navy }}>{T.line1}</p>
        <p
          style={{
            display: "inline-block",
            margin: 0,
            padding: "0 10px",
            fontSize: 44,
            fontWeight: 1000,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: C.blue,
            backgroundImage: `linear-gradient(transparent 58%, ${C.yellow} 58% 86%, transparent 86%)`,
            backgroundSize: `${wipe * 100}% 100%`,
            backgroundRepeat: "no-repeat",
          }}
        >
          {T.cta}
        </p>
      </div>
      <LinkGuide
        show={guides}
        style={{ position: "absolute", left: 44, top: 120, width: 290, height: 38, border: "2px dashed rgba(15, 34, 51, 0.55)", borderRadius: 12, fontSize: 13, color: C.navy }}
      />
      <div style={{ position: "absolute", left: 14, right: 14, top: 166, height: 260, borderRadius: 28, background: C.tint, overflow: "hidden" }}>
        <MasaChip count={4} fontSize={14} background="#FFFFFF" style={{ position: "absolute", left: 12, top: 10, zIndex: 1, padding: "6px 12px" }} />
        <Img src={staticFile(ART.masa)} alt={T.altMasa} style={{ position: "absolute", left: -6, top: 14, width: 362, height: 203 }} />
      </div>
    </>
  );
}

export function StoryPhone({
  y = 0,
  screen = "puhu",
  wipe = 1,
  guides,
  progress = 0,
}: {
  y?: number;
  screen?: "video" | "puhu";
  wipe?: number;
  guides: boolean;
  progress?: number;
}) {
  return (
    <Phone
      width={1000}
      screenBg={C.screen}
      style={{ left: 100, top: 1204 + y, filter: "drop-shadow(0 -10px 40px rgba(6, 14, 40, 0.35))" }}
      screen={screen === "video" ? <VideoScreen progress={progress} /> : <PuhuScreen wipe={wipe} guides={guides} />}
    />
  );
}

export function StoryBackdrop() {
  return (
    <>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "repeating-conic-gradient(from 0deg at 66% 56%, rgba(255, 255, 255, 0.09) 0deg 11deg, rgba(255, 255, 255, 0) 11deg 30deg)" }} />
      <Sparkle x={40} y={676} size={80} color={C.yellow} />
      <Sparkle x={96} y={1110} size={54} color="#FFFFFF" />
      <Sparkle x={250} y={1200} size={70} color={C.sky} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 262, display: "flex", justifyContent: "center" }}>
        <Logo size={52} color="#FFFFFF" />
      </div>
    </>
  );
}

export function S1({ guides, safe }: PieceProps) {
  return (
    <Frame format="story" background={C.blue} safe={safe}>
      <StoryBackdrop />
      <PovHeadline />
      <PeekPuhu />
      <KankaBubble />
      <StoryPhone guides={guides} />
    </Frame>
  );
}
