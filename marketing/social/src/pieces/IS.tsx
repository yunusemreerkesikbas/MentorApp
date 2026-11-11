import { Img, staticFile } from "remotion";
import { ART } from "../art";
import { C } from "../brand";
import { COPY } from "../copy";
import { MasaChip } from "../components/MasaChip";
import { CardRow, PovStory } from "../components/Pov";
import type { PieceProps } from "../pieces";
import { NotebookPage, PAGE, STAMP_GREEN } from "../t1/parts/Notebook";
import { TradingCard } from "../t1/parts/TradingCard";

// Feature ads, POV stories. Each is PovStory + one Puhu + the feature card's rows.

// 1 · Odak seansı.
export function IS1({ guides, safe }: PieceProps) {
  const T = COPY.IS1!;
  return (
    <PovStory copy={T} guides={guides} safe={safe} puhu={{ art: "facepalm", alt: T.altPuhu, left: 520, top: 760, width: 500, height: 531 }}>
      <CardRow tag={T.row1Tag} text={T.row1} />
      <CardRow tag={T.row2Tag} text={T.row2} />
    </PovStory>
  );
}

// 2 · Haftalık plan (canvas board F-POV-Story).
export function IS2({ guides, safe }: PieceProps) {
  const T = COPY.IS2!;
  return (
    <PovStory copy={T} guides={guides} safe={safe} puhu={{ art: "p2", alt: T.altPuhu, left: 360, top: 640, width: 760, height: 760 }}>
      {[1, 2, 3].map((i) => (
        <CardRow key={i} tag={T[`row${i}Tag`]} text={T[`row${i}`]} meta={T[`row${i}Meta`]} />
      ))}
    </PovStory>
  );
}

// 3 · Yanlış Defterim: no card. The app's own notebook page with the taped question and the red-pen note.
export function IS3({ guides, safe }: PieceProps) {
  const T = COPY.IS3!;
  return (
    <PovStory bare guide={{ left: 690, top: 1500 }} copy={T} guides={guides} safe={safe} puhu={{ art: "dedektif", alt: T.altPuhu, left: 600, top: 780, width: 480, height: 528 }}>
      <div style={{ position: "absolute", left: 84, top: 1040, width: PAGE.width, height: PAGE.height, transformOrigin: "0 0", transform: "rotate(-4deg) scale(0.7)" }}>
        <NotebookPage q={T.question} n={T.note} page={T.page}>
          <div style={{ position: "absolute", left: 250, top: 690, padding: "6px 34px", border: `10px solid ${STAMP_GREEN}`, borderRadius: 22, color: STAMP_GREEN, fontSize: 104, fontWeight: 1000, letterSpacing: "0.04em", lineHeight: 1.1, rotate: "-9deg" }}>{T.solved}</div>
        </NotebookPage>
      </div>
    </PovStory>
  );
}

// 4 · Deneme analizi.
export function IS4({ guides, safe }: PieceProps) {
  const T = COPY.IS4!;
  return (
    <PovStory copy={T} guides={guides} safe={safe} bubbleSize={44} puhu={{ art: "hava", alt: T.altPuhu, left: 470, top: 770, width: 600, height: 588 }}>
      {[1, 2, 3].map((i) => (
        <CardRow key={i} tag={String(i)} text={T[`row${i}`]} meta={T[`row${i}Meta`]} />
      ))}
    </PovStory>
  );
}

// 5 · Masa: no card. The table of four sits in a pool of lamp light and fills the bottom of the story.
export function IS5({ guides, safe }: PieceProps) {
  const T = COPY.IS5!;
  return (
    <PovStory bare copy={T} guides={guides} safe={safe} quoteSize={88} bubbleSize={44} puhu={{ art: "p1", alt: T.altPuhu, left: 610, top: 770, width: 430, height: 431 }}>
      <div aria-hidden="true" style={{ position: "absolute", left: -60, top: 1210, width: 1200, height: 560, borderRadius: "50%", background: "radial-gradient(ellipse at 50% 50%, rgba(255, 224, 130, 0.5) 0%, rgba(255, 224, 130, 0.16) 45%, rgba(255, 224, 130, 0) 70%)" }} />
      <Img src={staticFile(ART.masa)} alt={T.altMasa} style={{ position: "absolute", left: 30, top: 1150, width: 1020, height: 573, filter: "drop-shadow(0 26px 24px rgba(6, 14, 40, 0.5))" }} />
      <MasaChip count={4} fontSize={34} background="#FFFFFF" style={{ position: "absolute", left: 392, top: 1596, boxShadow: `0 8px 0 ${C.navy}`, transform: "rotate(-4deg)" }} />
    </PovStory>
  );
}

// 6 · Haftalık lakap: the app's trading card, as in IF6; the host peeks from behind it.
export function IS6({ guides, safe }: PieceProps) {
  const T = COPY.IS6!;
  return (
    <PovStory bare guide={{ left: 640, top: 1470 }} copy={T} guides={guides} safe={safe} bubbleSize={46} puhu={{ art: "host", alt: T.altPuhu, left: 560, top: 780, width: 500, height: 625 }}>
      <TradingCard art="t1CharStreak" name={T.nick} msg={T.nickMsg} style={{ left: 96, top: 1050, transformOrigin: "0 0", transform: "rotate(-3deg) scale(0.74)" }} />
    </PovStory>
  );
}
