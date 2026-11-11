import { Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ART } from "../../art";
import { C } from "../../brand";
import { COPY } from "../../copy";
import { pop, slam, SNAPPY } from "../../motion";
import { NotebookCover, NotebookPage, PAGE, STAMP_GREEN } from "../parts/Notebook";
import { QuestionSlip, SLIP } from "../parts/QuestionSlip";
import { StickerWords } from "../parts/StickerWords";
import { EVENTS } from "../timeline";
import { SLIP_END } from "./S10";

const T = COPY.T1!;
const E = EVENTS["11"];
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.inOut(Easing.cubic);

// On the desk the notebook leans at the left, at 0.465 of its open size.
const DESK = { x: 170 - PAGE.left, y: 820 - PAGE.top, scale: 0.465, rot: -6 };
const DESK_TOP = 1300;
const FLIP = 7;
const OPEN_AT = E.page1! - FLIP; // the cover swings open as the book ends its flight; page 1 shows on its beat
const WORDS_OUT = E.review!;

// The last page with today's review chip and the green stamp; scene 12 slides it onto the table.
export function LastPage({ review, stamp }: { review: number; stamp: number }) {
  return (
    <NotebookPage q={T.q3!} n={T.n3!} page={T.page3!}>
      <div style={{ position: "absolute", left: 120, top: 660, display: "flex", alignItems: "center", gap: 14, padding: "16px 32px 16px 22px", borderRadius: 999, background: C.blue, color: "#FFFFFF", fontSize: 46, fontWeight: 1000, lineHeight: 1, boxShadow: `0 7px 0 ${C.t1Ink}`, scale: String(review) }}>
        <svg aria-hidden="true" viewBox="0 0 40 40" style={{ width: 46, height: 46 }}>
          <path d="M32 20 A12 12 0 1 1 26 9.6 M26 2 V10 H34" fill="none" stroke="#FFFFFF" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {T.review}
      </div>
      <div style={{ position: "absolute", left: 250, top: 800, padding: "10px 36px", border: `10px solid ${STAMP_GREEN}`, borderRadius: 20, color: STAMP_GREEN, fontSize: 88, fontWeight: 1000, letterSpacing: "0.06em", lineHeight: 1.1, background: "rgba(31, 157, 85, 0.08)", rotate: "-12deg", scale: String(stamp), opacity: stamp > 0 ? 1 : 0 }}>
        {T.solved}
      </div>
    </NotebookPage>
  );
}

// Flips a page (or the cover) away around its left edge, toward the camera.
const flipStyle = (frame: number, at: number) => {
  const t = interpolate(frame, [at, at + FLIP], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  return { transformOrigin: "0% 50%", transform: `perspective(2600px) rotateY(${-110 * t}deg)`, opacity: t >= 1 ? 0 : 1, backfaceVisibility: "hidden" as const };
};

// Defterlerim: the slip drops into the Matematik notebook on the desk; the book lifts, flies at the camera and
// opens; three pages turn one per beat; the review chip, the ÇÖZDÜM stamp, and desk Puhu peeks over the top.
export function S11() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lift = spring({ frame: frame - E.lift!, fps, config: SNAPPY });
  const flight = interpolate(frame, [E.fill!, E.fill! + 10], [0, 1], { ...clamp, easing: ease });
  const k = 1 - flight;
  const drop = interpolate(frame, [E.slip!, E.slip! + 12], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const deskCx = PAGE.left + DESK.x + (PAGE.width * DESK.scale) / 2;
  const deskCy = PAGE.top + DESK.y + (PAGE.height * DESK.scale) / 2;
  const blink = frame >= 40 && frame < 44;
  const wordsOut = interpolate(frame, [WORDS_OUT, WORDS_OUT + 6], [1, 0], { ...clamp, easing: Easing.in(Easing.back(2)) });
  const peek = spring({ frame: frame - E.peek!, fps, config: SNAPPY, from: 0, to: 1 });
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "linear-gradient(180deg, #E9E3F1 0%, #F2ECE4 52%, #EFE5D8 68%)" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: DESK_TOP, bottom: 0, background: "linear-gradient(180deg, #D4A77A 0, #D4A77A 16px, #B88757 16px, #9E6F43 100%)" }} />
      <Img
        src={staticFile(blink ? ART.t1DeskPuhuBlink : frame < 40 ? ART.t1DeskPuhuLeft : ART.t1DeskPuhuRight)}
        alt=""
        style={{ position: "absolute", left: 620, top: DESK_TOP - 370, width: 360, height: 384 }}
      />
      {frame >= E.peek! ? (
        <Img src={staticFile(ART.t1DeskPuhuPeek)} alt="" style={{ position: "absolute", left: 470, top: interpolate(peek, [0, 1], [PAGE.top, PAGE.top - 250]), width: 450, height: 480 }} />
      ) : null}
      <div
        style={{
          position: "absolute",
          left: PAGE.left,
          top: PAGE.top,
          width: PAGE.width,
          height: PAGE.height,
          transformOrigin: "0 0",
          translate: `${DESK.x * k}px ${DESK.y * k - 60 * lift * k}px`,
          scale: String((DESK.scale + (1 - DESK.scale) * flight) * (1 + 0.06 * lift * k)),
          rotate: `${DESK.rot * k}deg`,
          filter: `drop-shadow(0 ${30 + 30 * lift}px 40px rgba(40, 24, 8, 0.4))`,
        }}
      >
        <LastPage review={pop(frame, fps, E.review!)} stamp={slam(frame, fps, E.solved!)} />
        {frame < E.page3! + FLIP ? <NotebookPage q={T.q2!} n={T.n2!} page={T.page2!} style={flipStyle(frame, E.page3!)} /> : null}
        {frame < E.page2! + FLIP ? <NotebookPage q={T.q1!} n={T.n1!} page={T.page1!} style={flipStyle(frame, E.page2!)} /> : null}
        {frame < OPEN_AT + FLIP ? <NotebookCover style={flipStyle(frame, OPEN_AT)} /> : null}
      </div>
      {drop < 1 ? (
        <QuestionSlip
          style={{
            left: interpolate(drop, [0, 1], [SLIP_END.x, deskCx]) - SLIP.width / 2,
            top: interpolate(drop, [0, 1], [SLIP_END.y, deskCy]) - SLIP.height / 2,
            scale: String(interpolate(drop, [0, 1], [SLIP_END.scale, 0.35])),
            rotate: `${interpolate(drop, [0, 1], [SLIP_END.rot, 10])}deg`,
            opacity: interpolate(drop, [0.7, 1], [1, 0], clamp),
          }}
        />
      ) : null}
      {wordsOut > 0 ? (
        <div style={{ position: "absolute", inset: 0, scale: String(wordsOut), transformOrigin: "540px 400px" }}>
          <StickerWords lines={[T.nb1!, T.nb2!]} top={250} at={[E.lift!, E.fill!]} size={96} />
        </div>
      ) : null}
    </div>
  );
}
