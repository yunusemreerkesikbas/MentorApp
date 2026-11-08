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
import { DOT_PAPER } from "./F2";

const T = COPY.S3!;
const DONE_GREY = "#6B7280";

function Box({ checked }: { checked: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 60 60" style={{ width: 54, height: 54, flexShrink: 0, overflow: checked ? "visible" : undefined }}>
      <rect x="3" y="3" width="54" height="54" rx="11" fill="none" stroke={C.navy} strokeWidth="5" />
      {checked ? <path d="M12 30 L26 44 L54 8" stroke={C.blue} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
    </svg>
  );
}

const row = { height: 84, display: "flex", alignItems: "center", gap: 24 } as const;

export function S3({ guides, safe }: PieceProps) {
  const done = [T.item1, T.item2, T.item3];
  return (
    <Frame format="story" background={C.cream} color={C.navy} safe={safe} style={DOT_PAPER}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 258, display: "flex", justifyContent: "center" }}>
        <Logo size={46} color="#111111" />
      </div>

      <p style={{ position: "absolute", left: 0, right: 0, top: 322, margin: 0, textAlign: "center", fontFamily: caveat, fontWeight: 700, fontSize: 100, lineHeight: 1, color: C.blue, transform: "rotate(-2deg)" }}>{T.title}</p>

      <TapedNote
        tape={{ left: 360, top: -20, width: 140, height: 40, rotate: -3 }}
        style={{
          left: 110,
          top: 470,
          width: 860,
          padding: "52px 56px 44px",
          backgroundImage: "repeating-linear-gradient(180deg, rgba(227, 236, 247, 0) 0px, rgba(227, 236, 247, 0) 82px, #E3ECF7 82px, #E3ECF7 84px)",
          backgroundPosition: "0 46px",
          border: `1px solid ${C.dot}`,
          borderRadius: 10,
          transform: "rotate(-2deg)",
          boxShadow: "0 18px 36px rgba(15, 34, 51, 0.12)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {done.map((item) => (
          <div key={item} style={row}>
            <Box checked />
            <span style={{ fontSize: 50, fontWeight: 900, color: DONE_GREY, textDecoration: "line-through", textDecorationThickness: 5, textDecorationColor: C.blue }}>{item}</span>
          </div>
        ))}
        <div style={row}>
          <Box checked={false} />
          <span style={{ fontSize: 50, fontWeight: 1000, color: C.navy, background: `linear-gradient(180deg, rgba(255, 224, 130, 0) 52%, ${C.yellow} 52%)`, padding: "0 6px" }}>{T.item4}</span>
        </div>
      </TapedNote>

      <p style={{ position: "absolute", left: 0, right: 0, top: 960, margin: 0, textAlign: "center", fontFamily: caveat, fontWeight: 700, fontSize: 64, lineHeight: 1, color: C.navy, transform: "rotate(-2deg)" }}>{T.footnote}</p>

      <Img src={staticFile(ART.readPuhu)} alt={T.altPuhu} style={{ position: "absolute", left: 300, top: 1036, width: 480, height: 512, objectFit: "contain" }} />

      {guides ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 1562, display: "flex", justifyContent: "center" }}>
          <LinkGuide show style={{ width: 620, height: 96, border: "4px dashed rgba(15, 34, 51, 0.55)", borderRadius: 24, fontSize: 28, color: C.navy }} />
        </div>
      ) : null}
    </Frame>
  );
}
