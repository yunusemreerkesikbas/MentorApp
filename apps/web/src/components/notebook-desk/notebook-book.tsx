"use client";

import "@fontsource-variable/fraunces/soft.css";
import "@fontsource-variable/caveat/wght.css";
import "./notebook-desk.css";
import { useId, type CSSProperties, type ReactNode, type Ref } from "react";
import Image from "next/image";
import type { NotebookCoverStyle, NotebookKind } from "@mentor/types";
import {
  COVER_COLORS,
  COVER_MATERIALS,
} from "@/components/notebook/notebook-surface";
import {
  DESK_TAPE_COLORS,
  deskBookThickness,
  deskDueTabs,
  deskTapeColor,
  shadeHex,
} from "@/lib/notebook-desk";
import { PUHU_MOTION_FRAMES } from "@/lib/onboarding-assets";

/**
 * A closed notebook as an object: boards, a page block with real thickness, the coil, the cover.
 *
 * The same drawing lies on the desk and flies off it. The desk poses it (`transform`) and lifts it
 * on hover (`lifted`); the opening overlay renders this very component at the same spot and takes
 * the pose from there, which is the only reason the hand-off from desk to air is invisible.
 *
 * Built from flat CSS faces in one preserve-3d context rather than a WebGL model: the cover keeps
 * real text (the desk's heading for the notebook is the title printed on its label), it themes with
 * CSS, and a scene of twelve books costs a few hundred DOM nodes, not a canvas per book.
 */

/** Where the due tabs stick out of the page block, top to bottom, in cqw of the book's width. */
const TAB_TOPS = [22.3, 43.1, 63.8, 84.6, 105.4] as const;

export interface NotebookBookSubject {
  /** Stable key for the tape colour: the subject's slug where there is one. */
  key: string;
  name: string;
}

export interface NotebookBookProps {
  title: string;
  kind: NotebookKind;
  cover: NotebookCoverStyle;
  pageCount: number;
  dueCount: number;
  /** Shown on the washi tape. Null for a general notebook and for the mistake notebook. */
  subject: NotebookBookSubject | null;
  /** "10 sayfa", already translated. Hidden on books too small to print it legibly. */
  meta: string;
  /** "Bugün 3 tekrar", or null when nothing is due. */
  dueLabel: string | null;
  /** On the desk the printed title is the notebook's heading; everywhere else it is a paragraph. */
  titleAs?: "h2" | "p";
  /** Hovered or focused: lifted a little off the desk, shadows spreading, a sheen across the cover. */
  lifted?: boolean;
  pressed?: boolean;
  /** The pose, written into the 3D container's transform (perspective, tilt, spin). */
  transform?: string;
  /** Desk shadows. The flying copy leaves them on the desk. */
  shadow?: boolean;
  /** The inside of the front cover, drawn only where the cover can open. */
  inside?: ReactNode;
  /** The top sheet under the cover, drawn only where the cover can open. */
  block?: ReactNode;
  poseRef?: Ref<HTMLDivElement>;
  coverRef?: Ref<HTMLDivElement>;
  className?: string;
  style?: CSSProperties;
}

/** The edge of the page block: sheets of paper between two boards, seen side-on. */
function pageEdge(direction: 90 | 180, board: string, cover: string): string {
  return [
    `repeating-linear-gradient(${direction}deg, rgba(110,90,60,0) 0 max(0.3cqw, 1.2px), rgba(110,90,60,0.22) max(0.3cqw, 1.2px) max(0.5cqw, 2px))`,
    `linear-gradient(${direction}deg, ${board} 0 0.6cqw, #f1eadb 0.6cqw, #e2d8c3 calc(100% - 0.6cqw), ${cover} calc(100% - 0.6cqw))`,
  ].join(", ");
}

/**
 * The wire, drawn as front halves of turns threading the punched holes — the same idea as the
 * editor's binding (`notebook-surface.tsx`), scaled to sit proud of a closed cover's spine.
 */
function BookCoil() {
  // Ids are document-global; twelve books on one desk would otherwise share one gradient.
  const id = useId();
  const wire = `${id}-wire`;
  const ring = `${id}-ring`;
  return (
    <svg
      className="nb-book-coil"
      viewBox="0 0 56 704"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ transform: "translateZ(calc(var(--nb-th) + 0.2cqw))" }}
    >
      <defs>
        <linearGradient id={wire} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1e222b" />
          <stop offset="0.55" stopColor="#a7afc0" />
          <stop offset="1" stopColor="#2a2f3a" />
        </linearGradient>
        <pattern id={ring} width="56" height="30" patternUnits="userSpaceOnUse">
          <ellipse cx="38" cy="16" rx="5.5" ry="4" fill="#0b0d13" opacity="0.62" />
          <path
            d="M38 18 C 24 19, 7 17, 6 12 C 5 7, 24 6, 38 14"
            fill="none"
            stroke={`url(#${wire})`}
            strokeWidth="3.6"
            strokeLinecap="round"
          />
        </pattern>
      </defs>
      <rect width="56" height="704" fill={`url(#${ring})`} />
    </svg>
  );
}

export function NotebookBook({
  title,
  kind,
  cover,
  pageCount,
  dueCount,
  subject,
  meta,
  dueLabel,
  titleAs: TitleTag = "p",
  lifted = false,
  pressed = false,
  transform,
  shadow = false,
  inside,
  block,
  poseRef,
  coverRef,
  className,
  style,
}: NotebookBookProps) {
  const hex = COVER_COLORS[cover.color];
  const board = shadeHex(hex, -0.35);
  const thickness = deskBookThickness(pageCount);
  const tabs = kind === "MISTAKE" ? deskDueTabs(dueCount) : 0;
  const printed = kind === "MISTAKE";

  return (
    <div
      className={`nb-book ${className ?? ""}`}
      data-lifted={lifted}
      data-pressed={pressed}
      style={{ ["--nb-th" as string]: `${thickness}cqw`, ...style }}
    >
      <div ref={poseRef} className="nb-book-3d" style={{ transform }}>
        {shadow ? (
          <>
            <div className="nb-book-shadow" data-layer="ambient" />
            <div className="nb-book-shadow" data-layer="contact" />
          </>
        ) : null}
        <div className="nb-book-lift">
          <div className="nb-book-back" style={{ background: board }} />
          <div
            className="nb-book-edge-bottom"
            style={{ background: pageEdge(180, board, hex) }}
          />
          <div
            className="nb-book-edge-right"
            style={{ background: pageEdge(90, board, hex) }}
          />
          {TAB_TOPS.slice(0, tabs).map((top, index) => (
            <div
              key={top}
              className="nb-book-tab"
              style={{
                top: `${top}cqw`,
                background: DESK_TAPE_COLORS[index],
                transform: "translateZ(calc(var(--nb-th) * 0.5))",
              }}
            />
          ))}
          {kind === "MISTAKE" ? (
            <div
              className="nb-book-ribbon"
              style={{
                transform: "translateZ(calc(var(--nb-th) * 0.5)) rotateZ(7deg)",
              }}
            />
          ) : null}
          {block !== undefined ? (
            <div
              className="nb-book-block"
              style={{ transform: "translateZ(calc(var(--nb-th) - 0.25cqw))" }}
            >
              {block}
            </div>
          ) : null}
          <div
            ref={coverRef}
            className="nb-book-cover"
            style={{ transform: "translateZ(var(--nb-th)) rotateY(0deg)" }}
          >
            <div
              className="nb-book-face nb-book-front"
              style={{
                backgroundColor: hex,
                backgroundImage: COVER_MATERIALS[cover.material],
              }}
            >
              {subject ? (
                <div
                  className="nb-book-tape"
                  style={{ background: deskTapeColor(subject.key) }}
                >
                  {subject.name}
                </div>
              ) : null}
              <div className="nb-book-label">
                <TitleTag className="nb-book-title" data-hand={!printed}>
                  {title}
                </TitleTag>
                <p className="nb-book-meta">{meta}</p>
              </div>
              {dueLabel ? (
                <div className="nb-book-sticky" aria-hidden="true">
                  {dueLabel}
                </div>
              ) : null}
              <div className="nb-book-sheen" />
            </div>
            {inside !== undefined ? (
              <div className="nb-book-face nb-book-inside">{inside}</div>
            ) : null}
          </div>
          <BookCoil />
        </div>
      </div>
    </div>
  );
}

export interface NotebookInsideCoverProps {
  cover: NotebookCoverStyle;
  /** "Bu defterin sahibi", already translated. */
  kicker: string;
  /** The student's own name, written in by hand. Null renders the plate without a name line. */
  owner: string | null;
}

/**
 * The inside of the front board: the cover colour in shadow, a few printed dots, and the ex-libris
 * plate a schoolbook gets signed on. Fills its parent, which has to be a size container so it reads
 * the same as the flying book's inside face (the editor wraps it in one for the contents spread).
 */
export function NotebookInsideCover({
  cover,
  kicker,
  owner,
}: NotebookInsideCoverProps) {
  const inside = shadeHex(COVER_COLORS[cover.color], -0.42);
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        background: [
          "radial-gradient(circle at 30% 30%, rgba(255,236,200,0.22) 0 0.46cqw, transparent 0.58cqw) 0 0 / 9.2cqw 9.2cqw",
          "radial-gradient(circle at 70% 70%, rgba(255,236,200,0.14) 0 0.31cqw, transparent 0.42cqw) 0 0 / 7.7cqw 7.7cqw",
          inside,
        ].join(", "),
      }}
    >
      <div className="nb-exlibris">
        <p className="nb-exlibris-kicker">{kicker}</p>
        {owner ? <p className="nb-exlibris-name">{owner}</p> : null}
        <Image
          className="nb-exlibris-stamp"
          src={PUHU_MOTION_FRAMES.default}
          alt=""
          width={96}
          height={96}
          sizes="96px"
        />
      </div>
    </div>
  );
}
