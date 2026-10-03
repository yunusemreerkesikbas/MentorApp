"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { PUHU_MOTION_FRAMES } from "@/lib/onboarding-assets";

/**
 * Puhu, sitting on a stack of old books at the far edge of the desk.
 *
 * He watches the hand: his eyes follow whichever notebook is lifted, he waves when a new notebook
 * lands, and he blinks now and then so he reads as present rather than printed.
 *
 * Which sprite shows is decided in CSS from three attributes on the wrapper: `data-pose` (React:
 * idle or waving), `data-gaze` (written by `use-desk-light.ts` where it already measures the desk)
 * and `data-blink` (this component's own timer). None of them re-renders anything; the sprites share
 * one canvas and stay mounted, so a change of look is an opacity swap, never a fetch.
 */

const FRAMES = {
  rest: PUHU_MOTION_FRAMES.default,
  left: PUHU_MOTION_FRAMES.gazeLeft,
  right: PUHU_MOTION_FRAMES.gazeRight,
  blink: PUHU_MOTION_FRAMES.blink,
  wave: PUHU_MOTION_FRAMES.wave,
} as const;

const BLINK_EVERY_MS = 4800;
const BLINK_MS = 170;

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
    let open = 0;
    const timer = window.setInterval(() => {
      element.dataset.blink = "true";
      open = window.setTimeout(() => {
        element.dataset.blink = "false";
      }, BLINK_MS);
    }, BLINK_EVERY_MS);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(open);
      element.dataset.blink = "false";
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
      data-blink="false"
      aria-hidden="true"
    >
      <div style={{ position: "relative", width: 190, height: 226 }}>
        <div
          className="desk-puhu"
          style={{ position: "absolute", left: 29, top: 0, width: 132, height: 136 }}
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
        </div>
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
        </svg>
      </div>
    </div>
  );
}
