import { Img, staticFile } from "remotion";
import { ART } from "../art";
import { C } from "../brand";
import { COPY } from "../copy";
import { Frame } from "../components/Frame";
import { LinkGuide } from "../components/LinkGuide";
import { Logo } from "../components/Logo";
import { TapedNote } from "../components/TapedNote";
import { caveat } from "../fonts";
import type { PieceProps } from "../pieces";

const T = COPY.S2!;

export function S2({ guides, safe }: PieceProps) {
  return (
    <Frame format="story" background={C.nightDeep} safe={safe}>
      <Img src={staticFile(ART.nightCity)} alt={T.altCity} style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, objectFit: "cover", objectPosition: "50% 50%" }} />
      <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 900, background: `linear-gradient(180deg, ${C.nightDeep} 0%, rgba(7, 18, 42, 0.86) 48%, rgba(7, 18, 42, 0) 100%)` }} />

      <div style={{ position: "absolute", left: 0, right: 0, top: 262, display: "flex", justifyContent: "center" }}>
        <Logo size={52} color="#FFFFFF" />
      </div>

      <div style={{ position: "absolute", left: 64, right: 64, top: 344, textAlign: "center" }}>
        <h1 style={{ margin: 0, fontWeight: 1000, fontSize: 120, lineHeight: 0.95, letterSpacing: "-0.035em", color: "#FFFFFF" }}>
          {T.head1}
          <br />
          {T.head2}
        </h1>
        <p style={{ margin: 0, fontWeight: 1000, fontSize: 120, lineHeight: 0.95, letterSpacing: "-0.035em", color: C.yellow }}>{T.punch}</p>
      </div>

      <TapedNote
        tape={{ left: 310, top: -18, width: 140, height: 38, rotate: 4 }}
        style={{ left: 160, top: 1330, width: 760, padding: "44px 40px 36px", borderRadius: 6, transform: "rotate(-3deg)", boxShadow: "0 22px 40px rgba(4, 10, 30, 0.45)", textAlign: "center" }}
      >
        <p style={{ margin: 0, fontFamily: caveat, fontWeight: 700, fontSize: 70, lineHeight: 1 }}>{T.note}</p>
      </TapedNote>

      {guides ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 1560, display: "flex", justifyContent: "center" }}>
          <LinkGuide
            show
            style={{ width: 620, height: 100, border: "4px dashed rgba(255, 255, 255, 0.8)", borderRadius: 24, background: "rgba(7, 18, 42, 0.35)", fontSize: 28, color: "#FFFFFF" }}
          />
        </div>
      ) : null}
    </Frame>
  );
}
