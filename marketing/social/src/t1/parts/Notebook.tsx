import type { CSSProperties, ReactNode } from "react";
import { C } from "../../brand";
import { COPY } from "../../copy";
import { caveat } from "../../fonts";

const T = COPY.T1!;

// The "Matematik Defteri" from the app's Defterlerim desk (notebook-desk.css: navy cover #33415c, cream label,
// subject tape #8fbef0), drawn at its open size: one portrait page filling the middle of the frame.
export const PAGE = { left: 110, top: 560, width: 860, height: 1100 } as const;
const COVER = "#33415C";
const TAPE = "#8FBEF0";
const RED_PEN = "#D93F4C";
export const STAMP_GREEN = "#1F9D55";

const box: CSSProperties = { position: "absolute", left: 0, top: 0, width: PAGE.width, height: PAGE.height, boxSizing: "border-box" };

function Coil() {
  return (
    <>
      {Array.from({ length: 15 }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: -18, top: 60 + i * 68, width: 52, height: 20, borderRadius: 10, border: "6px solid #8A93A6", boxSizing: "border-box", zIndex: 2 }} />
      ))}
    </>
  );
}

export function NotebookCover({ style }: { style?: CSSProperties }) {
  return (
    <div style={{ ...box, borderRadius: "14px 46px 46px 14px", background: COVER, boxShadow: "inset 0 0 0 5px rgba(0, 0, 0, 0.2), inset -30px 0 60px rgba(0, 0, 0, 0.16)", ...style }}>
      <Coil />
      <div style={{ position: "absolute", left: 150, top: 260, width: 620, padding: "46px 50px 40px", boxSizing: "border-box", borderRadius: 24, background: "#FBF6EA", boxShadow: "0 4px 0 rgba(0, 0, 0, 0.12), 0 20px 44px rgba(0, 0, 0, 0.22)" }}>
        <div style={{ fontSize: 92, fontWeight: 900, lineHeight: 1.04, color: "#1F2433" }}>{T.nbName}</div>
      </div>
      <div style={{ position: "absolute", left: 560, top: 70, width: 400, height: 92, display: "flex", alignItems: "center", justifyContent: "center", background: TAPE, rotate: "32deg", fontFamily: caveat, fontWeight: 700, fontSize: 56, color: "#1D2433" }}>
        {T.nbTape}
      </div>
    </div>
  );
}

// One lined page: subject tape, page counter, the taped wrong question and the red-pen note under it.
export function NotebookPage({ q, n, page, children, style }: { q: string; n: string; page: string; children?: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ ...box, borderRadius: "10px 26px 26px 10px", background: C.paper, boxShadow: "0 30px 60px -20px rgba(30, 20, 8, 0.55), inset 0 0 0 3px rgba(120, 96, 60, 0.12)", overflow: "visible", ...style }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 150, bottom: 40, backgroundImage: "repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0) 0 54px, #CFE0F5 54px 57px)" }} />
      <div style={{ position: "absolute", left: 92, top: 0, bottom: 0, width: 3, background: "#F2A7AE" }} />
      <Coil />
      <div style={{ position: "absolute", left: 110, top: 44, padding: "6px 28px", background: TAPE, rotate: "-4deg", fontFamily: caveat, fontWeight: 700, fontSize: 48, color: "#1D2433" }}>{T.nbTape}</div>
      <div style={{ position: "absolute", right: 70, top: 52, fontSize: 44, fontWeight: 1000, color: C.grey }}>{page}</div>
      <div style={{ position: "absolute", left: 120, top: 175, width: 640, padding: "44px 38px 34px", boxSizing: "border-box", background: "#FFFFFF", boxShadow: "0 8px 18px rgba(30, 20, 8, 0.18)", rotate: "-1deg", fontSize: 54, fontWeight: 900, lineHeight: 1.15, color: C.t1Ink }}>
        <div aria-hidden="true" style={{ position: "absolute", left: 240, top: -18, width: 160, height: 40, background: C.yellow, opacity: 0.9, rotate: "-3deg" }} />
        {q}
      </div>
      <svg aria-hidden="true" viewBox="0 0 120 120" style={{ position: "absolute", left: 600, top: 440, width: 120, height: 120 }}>
        <path d="M14 104 C60 100 96 70 100 18 M84 34 L100 16 L112 38" fill="none" stroke={RED_PEN} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ position: "absolute", left: 150, top: 500, fontFamily: caveat, fontWeight: 700, fontSize: 80, lineHeight: 1, color: RED_PEN, rotate: "-4deg" }}>{n}</div>
      {children}
    </div>
  );
}
