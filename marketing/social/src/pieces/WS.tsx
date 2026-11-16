// Waitlist series "Yerini kap": three stories, one per kit direction (B gece, A mavi, C krem).
// Text and the sticker guides stay between y 250 and y 1670 (Instagram covers the rest).
import { Img, staticFile } from "remotion";
import { ART } from "../art";
import { C } from "../brand";
import { COPY } from "../copy";
import { Frame } from "../components/Frame";
import { LinkGuide } from "../components/LinkGuide";
import { Logo } from "../components/Logo";
import { Sparkle } from "../components/Sparkle";
import { caveat } from "../fonts";
import type { PieceProps } from "../pieces";
import { DOT_PAPER } from "./F2";

const HEAD = { margin: 0, fontWeight: 1000, lineHeight: 0.98, letterSpacing: "-0.035em" } as const;
const guide = { width: 620, height: 100, borderRadius: 24, fontSize: 28 } as const;

// B · gece: the lantern window on top, the line in the night panel under it (F3's layout, story height).
export function WS1({ guides, safe }: PieceProps) {
  const T = COPY.WS1!;
  return (
    <Frame format="story" background={C.night} safe={safe}>
      <Img src={staticFile(ART.w2)} alt={T.altPuhu} style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1180, objectFit: "cover", objectPosition: "50% 42%" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 262, display: "flex", justifyContent: "center" }}>
        <Logo size={52} color="#FFFFFF" />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1120, bottom: 0, background: C.night, borderRadius: "44px 44px 0 0" }} />
      <div style={{ position: "absolute", left: 64, right: 64, top: 1180 }}>
        <h1 style={{ ...HEAD, fontSize: 124, color: "#FFFFFF" }}>{T.head}</h1>
        <p style={{ ...HEAD, fontSize: 150, color: C.yellow }}>{T.punch}</p>
      </div>
      {guides ? (
        <div style={{ position: "absolute", left: 64, top: 1500 }}>
          <LinkGuide show style={{ ...guide, border: "4px dashed rgba(255, 255, 255, 0.8)", color: "#FFFFFF" }} />
        </div>
      ) : null}
    </Frame>
  );
}

// A · mavi: the question on top, the host Puhu waiting on the left, room for the native poll on the right.
export function WS2({ guides, safe }: PieceProps) {
  const T = COPY.WS2!;
  return (
    <Frame format="story" background={C.blue} safe={safe}>
      <div aria-hidden="true" style={{ position: "absolute", left: -260, top: 900, width: 1100, height: 1100, borderRadius: 999, background: "rgba(255, 255, 255, 0.07)" }} />
      <div style={{ position: "absolute", left: 64, top: 262 }}>
        <Logo size={52} color="#FFFFFF" />
      </div>
      <div style={{ position: "absolute", left: 64, right: 64, top: 350 }}>
        <h1 style={{ ...HEAD, fontSize: 170, color: "#FFFFFF" }}>{T.head}</h1>
        <p style={{ ...HEAD, fontSize: 170, color: C.yellow }}>{T.punch}</p>
      </div>
      <Sparkle x={900} y={420} size={70} color={C.yellow} />
      <Img src={staticFile(ART.host)} alt={T.altPuhu} style={{ position: "absolute", left: -70, top: 830, width: 660, height: 825, objectFit: "contain" }} />
      <p style={{ position: "absolute", left: 560, top: 1010, width: 460, margin: 0, fontFamily: caveat, fontWeight: 700, fontSize: 66, lineHeight: 1, color: "#FFFFFF", transform: "rotate(-3deg)" }}>{T.hint}</p>
      {guides ? (
        <div style={{ position: "absolute", left: 560, top: 1180 }}>
          <LinkGuide show label={T.pollGuide} style={{ ...guide, width: 460, height: 300, border: "4px dashed rgba(255, 255, 255, 0.8)", color: "#FFFFFF", textAlign: "center", padding: 24 }} />
        </div>
      ) : null}
    </Frame>
  );
}

// C · krem: the line on dotted paper, the full table under it. No card, no chip: the table is the picture.
export function WS3({ guides, safe }: PieceProps) {
  const T = COPY.WS3!;
  return (
    <Frame format="story" background={C.cream} color={C.navy} safe={safe} style={DOT_PAPER}>
      <div style={{ position: "absolute", left: 64, top: 262 }}>
        <Logo size={52} color="#111111" />
      </div>
      <p style={{ position: "absolute", left: 64, top: 356, margin: 0, fontSize: 30, fontWeight: 900, letterSpacing: "0.08em", color: C.inkBlue }}>{T.exams}</p>
      <div style={{ position: "absolute", left: 64, right: 64, top: 420 }}>
        <h1 style={{ ...HEAD, fontSize: 132, color: C.navy }}>{T.head}</h1>
        <p style={{ ...HEAD, marginTop: 14, fontSize: 132, color: C.blue }}>{T.punch}</p>
      </div>
      <Img src={staticFile(ART.masa)} alt={T.altMasa} style={{ position: "absolute", left: 30, top: 1090, width: 1020, height: 573, objectFit: "contain" }} />
      {guides ? (
        <div style={{ position: "absolute", left: 64, top: 960 }}>
          <LinkGuide show style={{ ...guide, border: "4px dashed rgba(15, 34, 51, 0.55)", color: C.navy }} />
        </div>
      ) : null}
    </Frame>
  );
}
