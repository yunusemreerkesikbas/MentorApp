"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

/**
 * Puhu, sitting on a stack of old books at the far edge of the desk, reading one of his own.
 *
 * His eyes go down the left page, then the right one, and a blink carries them back to the left,
 * the way a reader's eyes jump back to the start of a line. His feet swing over the edge of the top
 * book. He still watches the hand: when a notebook is lifted he looks up from his book towards it,
 * and when a new one lands he waves with the book still in his other wing.
 *
 * Which sprite shows is decided in CSS from four attributes on the wrapper: `data-pose` (React:
 * idle or waving), `data-gaze` (written by `use-desk-light.ts` where it already measures the desk),
 * and `data-read` and `data-blink` (this component's own timer). None of them re-renders anything;
 * the sprites share one canvas and stay mounted, so a change of look is an opacity swap, never a
 * fetch. The feet are their own layers on the same canvas and swing in CSS.
 */

const ROOT = "/mascot/puhu/desk";

const FRAMES = {
  readLeft: `${ROOT}/read-left.png`,
  readRight: `${ROOT}/read-right.png`,
  blink: `${ROOT}/blink.png`,
  peekLeft: `${ROOT}/peek-left.png`,
  peekRight: `${ROOT}/peek-right.png`,
  wave: `${ROOT}/wave.png`,
} as const;

/**
 * The desk set's shared canvas, where his belly rests (`seat`, a fraction of the height) and the
 * point each foot hangs from. `scripts/desk-puhu-sprites.mjs` prints all of them; re-read them
 * whenever the art is rebuilt.
 */
const DESK_PUHU_ART = {
  width: 360,
  height: 384,
  seat: 0.896,
  feet: {
    left: { src: `${ROOT}/foot-left.png`, pivot: "37.8% 84.3%" },
    right: { src: `${ROOT}/foot-right.png`, pivot: "64.7% 86.3%" },
  },
} as const;

/** The stage is 190 × 226; the stack fills its bottom and the top book's upper edge is at y 134. */
const PUHU_WIDTH = 116;
const PUHU_HEIGHT = (PUHU_WIDTH * DESK_PUHU_ART.height) / DESK_PUHU_ART.width;
/** He sinks a little into the top book's edge, so he reads as sitting on it, not floating over it. */
const SEAT_Y = 137;
/** Centred on the top book (x 28 to 172). */
const PUHU_LEFT = 100 - PUHU_WIDTH / 2;

/** How long one page holds his eyes; varied a little so the loop does not tick like a clock. */
const PAGE_MS = [2200, 3200] as const;
const BLINK_MS = 170;

/** Puhu reading on the desk's book stack. Decorative, so hidden from screen readers. */
export function DeskPuhu({
  waving,
  reduceMotion,
  onElement,
  className,
}: {
  waving: boolean;
  reduceMotion: boolean;
  /** The wrapper, for the light hook to measure and to write `data-gaze` on. */
  onElement?: (element: HTMLDivElement | null) => void;
  className?: string;
}) {
  const own = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = own.current;
    if (!element || reduceMotion) return;
    let timer = 0;
    const page = () => PAGE_MS[0] + Math.random() * (PAGE_MS[1] - PAGE_MS[0]);
    const readLeft = () => {
      element.dataset.blink = "false";
      element.dataset.read = "left";
      timer = window.setTimeout(readRight, page());
    };
    const readRight = () => {
      element.dataset.read = "right";
      timer = window.setTimeout(blink, page());
    };
    const blink = () => {
      element.dataset.blink = "true";
      timer = window.setTimeout(readLeft, BLINK_MS);
    };
    timer = window.setTimeout(readRight, page());
    return () => {
      window.clearTimeout(timer);
      element.dataset.blink = "false";
      element.dataset.read = "left";
    };
  }, [reduceMotion]);

  return (
    <div
      ref={(element) => {
        own.current = element;
        onElement?.(element);
      }}
      className={`desk-prop desk-puhu-wrap ${className ?? ""}`}
      data-pose={waving ? "wave" : "idle"}
      data-gaze="ahead"
      data-read="left"
      data-blink="false"
      aria-hidden="true"
    >
      <div style={{ position: "relative", width: 190, height: 226 }}>
        <svg
          width="190"
          height="100"
          viewBox="0 0 190 100"
          style={{ position: "absolute", left: 0, top: 126, overflow: "visible" }}
        >
          <ellipse cx="95" cy="96" rx="96" ry="8" fill="#000" opacity="0.42" style={{ filter: "blur(5px)" }} />
          <rect x="4" y="62" width="182" height="32" rx="5" fill="#7a3333" />
          <rect x="4" y="71" width="182" height="5" fill="#ffdca0" opacity="0.35" />
          <rect x="4" y="82" width="182" height="3" fill="#ffdca0" opacity="0.25" />
          <rect x="16" y="34" width="162" height="29" rx="5" fill="#2c6461" />
          <rect x="16" y="54" width="162" height="4" fill="#ffe6b4" opacity="0.32" />
          <rect x="28" y="8" width="144" height="27" rx="5" fill="#b8873a" />
          <rect x="28" y="15" width="144" height="4" fill="#5a320a" opacity="0.35" />
          <rect x="4" y="62" width="182" height="4" rx="2" fill="#fff" opacity="0.12" />
          <rect x="16" y="34" width="162" height="4" rx="2" fill="#fff" opacity="0.12" />
          <rect x="28" y="8" width="144" height="4" rx="2" fill="#fff" opacity="0.16" />
          {/* Where he sits, the top book darkens a little under him. */}
          <ellipse cx="100" cy="11" rx="46" ry="5" fill="#000" opacity="0.3" style={{ filter: "blur(3px)" }} />
        </svg>
        <div
          className="desk-puhu"
          style={{
            position: "absolute",
            left: PUHU_LEFT,
            top: SEAT_Y - DESK_PUHU_ART.seat * PUHU_HEIGHT,
            width: PUHU_WIDTH,
            height: PUHU_HEIGHT,
          }}
        >
          {(Object.keys(FRAMES) as Array<keyof typeof FRAMES>).map((key) => (
            <Image
              key={key}
              src={FRAMES[key]}
              alt=""
              fill
              sizes="136px"
              data-frame={key}
              className="desk-puhu-frame object-contain"
            />
          ))}
          {(["left", "right"] as const).map((side) => (
            <Image
              key={side}
              src={DESK_PUHU_ART.feet[side].src}
              alt=""
              fill
              sizes="136px"
              data-foot={side}
              className="desk-puhu-foot object-contain"
              style={{ transformOrigin: DESK_PUHU_ART.feet[side].pivot }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
