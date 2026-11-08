import { Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ART, type ArtKey } from "../art";
import { C, REEL_TEXT } from "../brand";
import { COPY } from "../copy";
import { EndCard } from "../components/EndCard";
import { Frame } from "../components/Frame";
import { caveat } from "../fonts";
import { pop, shake, slam } from "../motion";
import { PIECES, type PieceProps } from "../pieces";
import { DOT_PAPER } from "./F2";
import { ExamBadge } from "./F5";

const T = COPY.R3!;
const VIDEO = PIECES.find((p) => p.id === "R3")!.video!;
const AT = { question: 105, note: 150 } as const;
const CX = (REEL_TEXT.left + REEL_TEXT.right) / 2;
const BADGE = 240;
// 3 + 2 inside the reel text box, one stamp per beat.
const BADGES = [
  { exam: "KPSS", at: 15, x: 80, y: 290, rotate: -6 },
  { exam: "YKS", at: 30, x: 360, y: 274, rotate: 4 },
  { exam: "LGS", at: 45, x: 640, y: 296, rotate: -3 },
  { exam: "ALES", at: 60, x: 220, y: 572, rotate: 5 },
  { exam: "DGS", at: 75, x: 500, y: 586, rotate: -5 },
];
const STICKERS: { art: ArtKey; at: number; x: number; rotate: number }[] = [
  { art: "mindBlown", at: 90, x: 60, rotate: -7 },
  { art: "nightShift", at: 94, x: 350, rotate: 4 },
  { art: "facepalm", at: 98, x: 640, rotate: -4 },
];

// Exam stamps on the beat, three moods, then the comment ask.
export function R3({ safe }: PieceProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Frame format="reel" background={C.cream} color={C.navy} safe={safe} style={DOT_PAPER}>
      {BADGES.map((b) => (
        <div key={b.exam} style={{ position: "absolute", left: b.x, top: b.y, transform: `scale(${slam(frame, fps, b.at)})` }}>
          <ExamBadge exam={b.exam} size={BADGE} rotate={b.rotate + shake(frame, b.at) / 2} />
        </div>
      ))}

      {STICKERS.map((s) => (
        <Img
          key={s.art}
          src={staticFile(ART[s.art])}
          alt={T.altStickers}
          style={{ position: "absolute", left: s.x, top: 866, width: 260, height: 272, objectFit: "contain", transform: `rotate(${s.rotate}deg) scale(${pop(frame, fps, s.at)})` }}
        />
      ))}

      <p
        style={{
          position: "absolute",
          left: REEL_TEXT.left,
          width: REEL_TEXT.right - REEL_TEXT.left,
          top: 1172,
          margin: 0,
          textAlign: "center",
          fontWeight: 1000,
          fontSize: 104,
          lineHeight: 1,
          letterSpacing: "-0.035em",
          color: C.blue,
          transform: `scale(${slam(frame, fps, AT.question)})`,
        }}
      >
        {T.question}
      </p>
      <p style={{ position: "absolute", left: CX - 300, width: 600, top: 1306, margin: 0, textAlign: "center", fontFamily: caveat, fontWeight: 700, fontSize: 92, lineHeight: 1, color: C.inkBlue, transform: `rotate(-3deg) scale(${pop(frame, fps, AT.note)})` }}>
        {T.note}
      </p>

      <EndCard ground={C.cream} ink={C.navy} puhu="host" enter={VIDEO.endCardFrom} />
    </Frame>
  );
}
