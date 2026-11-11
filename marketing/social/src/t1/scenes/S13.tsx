import type { ReactNode } from "react";
import { Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ART } from "../../art";
import { C } from "../../brand";
import { COPY } from "../../copy";
import { pop, slideUp } from "../../motion";
import { StickerWords } from "../parts/StickerWords";
import { Sunburst } from "../parts/Sunburst";
import { EVENTS } from "../timeline";

const T = COPY.T1!;
const E = EVENTS["13"];

// A community message card as in the app's Topluluk feed: round avatar, bold name, the message.
function Message({ avatar, name, text, at, left, top, width, fill = "#FFFFFF", children }: { avatar: ReactNode; name: string; text: string; at: number; left: number; top: number; width: number; fill?: string; children?: ReactNode }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width,
        boxSizing: "border-box",
        display: "flex",
        gap: 24,
        padding: "30px 34px",
        borderRadius: 40,
        background: fill,
        color: C.t1Ink,
        boxShadow: `0 10px 0 ${C.t1Ink}`,
        translate: `0 ${slideUp(frame, fps, at, 120)}px`,
        scale: String(pop(frame, fps, at)),
      }}
    >
      <div style={{ width: 96, height: 96, flex: "none", borderRadius: "50%", overflow: "hidden" }}>{avatar}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 38, fontWeight: 1000, lineHeight: 1.1 }}>{name}</div>
        <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1.18, marginTop: 6 }}>{text}</div>
        {children}
      </div>
    </div>
  );
}

const Initial = ({ letter, bg }: { letter: string; bg: string }) => (
  <div style={{ width: "100%", height: "100%", background: bg, color: "#FFFFFF", fontSize: 52, fontWeight: 1000, lineHeight: "96px", textAlign: "center" }}>{letter}</div>
);

// Takıldın mı?: a question, an answer with its alkış count, then Puhu's yellow bubble, one per beat.
export function S13() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: "absolute", inset: 0, background: C.blue }}>
      <Sunburst cx={50} cy={60} />
      <StickerWords lines={[T.ask1!]} top={250} at={[E.ask!]} size={120} />
      <StickerWords lines={[T.ask2!]} top={400} at={[E.ask! + 6]} size={56} color={C.yellow} />
      <Message avatar={<Initial letter="Z" bg="#E0719B" />} name={T.zeynepName!} text={T.zeynep!} at={E.q!} left={70} top={560} width={800} />
      <Message avatar={<Initial letter="C" bg="#3FA27A" />} name={T.canName!} text={T.can!} at={E.a!} left={110} top={860} width={790}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 16, padding: "8px 20px 8px 14px", borderRadius: 999, background: "#FFF3C4", fontSize: 34, fontWeight: 1000, scale: String(pop(frame, fps, E.a! + 6)) }}>
          <svg aria-hidden="true" viewBox="0 0 40 40" style={{ width: 38, height: 38 }}>
            <path d="M20 3 L23.5 14 L35 14.5 L26 21.5 L29.5 33 L20 26.5 L10.5 33 L14 21.5 L5 14.5 L16.5 14 Z" fill={C.yellow} stroke={C.t1Ink} strokeWidth={3} strokeLinejoin="round" />
          </svg>
          {T.clap}
        </div>
      </Message>
      <Message
        avatar={<Img src={staticFile(ART.p2)} alt="" style={{ width: 146, height: 146, marginLeft: -25, marginTop: -8, objectFit: "contain", background: C.tint }} />}
        name={T.puhuName!}
        text={T.puhu!}
        at={E.puhu!}
        left={70}
        top={1200}
        width={830}
        fill={C.yellow}
      />
    </div>
  );
}
