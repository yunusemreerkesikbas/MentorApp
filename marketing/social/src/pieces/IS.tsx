import type { CSSProperties } from "react";
import { Img, staticFile } from "remotion";
import { Phone } from "../components/Phone";
import { ART } from "../art";
import { C } from "../brand";
import { COPY } from "../copy";
import { PovStory } from "../components/Pov";
import type { PieceProps } from "../pieces";
import { NotebookPage, PAGE, STAMP_GREEN } from "../t1/parts/Notebook";
import { Ring } from "../t1/parts/Ring";
import { StickerWords } from "../t1/parts/StickerWords";
import { TradingCard } from "../t1/parts/TradingCard";

// Feature ads, POV stories. Each is PovStory + one Puhu + the feature card's rows.

// 1 · Odak seansı: no card. The app's seans table in the yellow timer ring, set to 25:00 (as in T1 scene 09).
const IS1_RING = { cy: 1450, r: 260 };
export function IS1({ guides, safe }: PieceProps) {
  const T = COPY.IS1!;
  const table = IS1_RING.r * 1.76;
  return (
    <PovStory bare copy={T} guides={guides} safe={safe} puhu={{ art: "facepalm", alt: T.altPuhu, left: 610, top: 760, width: 420, height: 446 }}>
      <div aria-hidden="true" style={{ position: "absolute", left: 540 - 420, top: IS1_RING.cy - 300, width: 840, height: 600, borderRadius: "50%", background: "radial-gradient(ellipse at 50% 50%, rgba(255, 224, 130, 0.45) 0%, rgba(255, 224, 130, 0) 70%)" }} />
      <Img src={staticFile(ART.t1RoomHomeTable)} alt={T.altMasa} style={{ position: "absolute", left: 540 - table / 2, top: IS1_RING.cy - table / 2, width: table, height: table, filter: "drop-shadow(0 22px 22px rgba(6, 14, 40, 0.45))" }} />
      <Ring cy={IS1_RING.cy} r={IS1_RING.r} stroke={26} />
      <StickerWords lines={[T.dial]} top={IS1_RING.cy - 80} at={[-90]} size={140} />
    </PovStory>
  );
}

// The real app capture on the 3D phone, scrolled by `scroll` (screen px) so the part that matters sits at the top.
function AppPhone({ art, alt, scroll, style }: { art: "t1ScreenPlan" | "t1ScreenDeneme"; alt: string; scroll: number; style: CSSProperties }) {
  return (
    <Phone
      width={style.width as number}
      screenBg="#F5F7FB"
      style={{ filter: "drop-shadow(0 30px 40px rgba(6, 14, 40, 0.5))", ...style }}
      screen={<Img src={staticFile(ART[art])} alt={alt} style={{ position: "absolute", left: 0, top: -scroll, width: 378, height: 822 }} />}
    />
  );
}

// 2 · Haftalık plan: no card. Puhu peeks over the phone; the real /plan screen shows Monday picked and the first tasks.
export function IS2({ guides, safe }: PieceProps) {
  const T = COPY.IS2!;
  return (
    <PovStory bare copy={T} guides={guides} safe={safe} puhu={{ art: "p2", alt: T.altPuhu, left: 360, top: 640, width: 760, height: 760 }}>
      <AppPhone art="t1ScreenPlan" alt={T.altScreen} scroll={110} style={{ left: 290, top: 1150, width: 820, rotate: "5deg" }} />
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

// 4 · Deneme analizi: no card. The real deneme result on the phone, the next-topic chip from T1 stuck beside it.
export function IS4({ guides, safe }: PieceProps) {
  const T = COPY.IS4!;
  return (
    <PovStory bare copy={T} guides={guides} safe={safe} bubbleSize={44} puhu={{ art: "hava", alt: T.altPuhu, left: 470, top: 770, width: 600, height: 588 }}>
      <AppPhone art="t1ScreenDeneme" alt={T.altScreen} scroll={140} style={{ left: 20, top: 1150, width: 700, rotate: "-5deg" }} />
      <div style={{ position: "absolute", left: 560, top: 1470, padding: "18px 32px", borderRadius: 999, background: C.yellow, color: C.navy, fontSize: 46, fontWeight: 1000, lineHeight: 1, whiteSpace: "nowrap", boxShadow: `0 8px 0 ${C.navy}`, rotate: "-4deg" }}>{T.next}</div>
    </PovStory>
  );
}

// 5 · Masa: no card. The table of four sits in a pool of lamp light and fills the bottom of the story.
export function IS5({ guides, safe }: PieceProps) {
  const T = COPY.IS5!;
  return (
    <PovStory bare copy={T} guides={guides} safe={safe} quoteSize={88} bubbleSize={44} puhu={{ art: "p1", alt: T.altPuhu, left: 610, top: 770, width: 430, height: 431 }}>
      <div aria-hidden="true" style={{ position: "absolute", left: -60, top: 1210, width: 1200, height: 560, borderRadius: "50%", background: "radial-gradient(ellipse at 50% 50%, rgba(255, 224, 130, 0.5) 0%, rgba(255, 224, 130, 0.16) 45%, rgba(255, 224, 130, 0) 70%)" }} />
      <Img src={staticFile(ART.masa)} alt={T.altMasa} style={{ position: "absolute", left: 30, top: 1150, width: 1020, height: 573, filter: "drop-shadow(0 26px 24px rgba(6, 14, 40, 0.5))" }} />    </PovStory>
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
