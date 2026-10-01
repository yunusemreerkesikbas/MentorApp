"use client";

import { getImageProps } from "next/image";
import type * as React from "react";
import type { AchievementId } from "@mentor/types";

import { AchievementArt } from "../achievement-art";
import { GLINT_BAND } from "./scene-frame-badges";

/** Puhu's silhouette, engraved into the card back. */
const PUHU_SILHOUETTE = "/mascot/puhu/motion/rest.png";
/** Masks never need more than this: 2× the largest badge, from the image optimiser. */
const MASK_WIDTH = 320;

const ART_SIZES = "260px";

function optimised(src: string): string {
  return getImageProps({ src, width: MASK_WIDTH, height: MASK_WIDTH, alt: "" }).props.src;
}

function mask(url: string, size = "100% 100%", position = "center"): React.CSSProperties {
  const image = `url("${url}")`;
  return {
    maskImage: image,
    WebkitMaskImage: image,
    maskSize: size,
    WebkitMaskSize: size,
    maskPosition: position,
    WebkitMaskPosition: position,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
  };
}

const LAYER = "absolute inset-0";
const FACE = `${LAYER} [backface-visibility:hidden] [-webkit-backface-visibility:hidden]`;
const SHEEN =
  "absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.9)_50%,transparent_70%)] opacity-0";

/**
 * Puhu's mark on the card back: the round glasses, the eyes and the chest heart, measured on
 * `rest.png` (256-unit space) so they sit exactly on the silhouette the mask draws.
 */
function PuhuMark() {
  return (
    <svg
      viewBox="0 0 256 256"
      aria-hidden="true"
      className="absolute left-1/4 top-[30%] size-1/2 overflow-visible"
    >
      <g className="fill-[color-mix(in_srgb,var(--achievement-card-ink)_16%,transparent)] stroke-[var(--achievement-card-ink)]" strokeWidth={7}>
        <circle cx="93.5" cy="107" r="27" />
        <circle cx="161.5" cy="107.5" r="27" />
      </g>
      <path
        d="M120.5 103.5 Q128 97 135 103.5"
        fill="none"
        className="stroke-[var(--achievement-card-ink)]"
        strokeWidth={6}
        strokeLinecap="round"
      />
      <circle cx="98" cy="110" r="8.5" className="fill-[var(--achievement-card-ink)]" />
      <circle cx="157" cy="110.5" r="8.5" className="fill-[var(--achievement-card-ink)]" />
      <path d="M127.5 121 l-5.5 7.5 h11 z" className="fill-[color-mix(in_srgb,var(--achievement-card-ink)_55%,transparent)]" />
      <path
        d="M145.5 171 c-9.5 -6 -13 -10.5 -13 -15 a6.4 6.4 0 0 1 13 -2 a6.4 6.4 0 0 1 13 2 c0 4.5 -3.5 9 -13 15z"
        className="fill-[var(--achievement-card-ink)]"
      />
    </svg>
  );
}

/**
 * One card of the scene. Born showing its back (Puhu engraved in gold on a night field cut to the
 * badge's own silhouette), it flips to the art. The frame painter moves it: `tf` carries position,
 * squash and flight, `rot` the flip, and the light parts (faces, sheens, glints, rim, mark) fade.
 */
export function SceneBadge({ artKey, edge }: { artKey: AchievementId; edge: number }) {
  const art = optimised(`/achievements/puhu/${artKey}.webp`);
  const silhouette = optimised(PUHU_SILHOUETTE);
  const glintWidth = `${GLINT_BAND * 100}%`;

  return (
    <div data-scene="badge" className="absolute left-0 top-0 opacity-0" style={{ width: edge, height: edge }}>
      <div data-part="tf" className={`${LAYER} will-change-transform`}>
        <div className={`${LAYER} [perspective:900px]`}>
          <div data-part="rot" className={`${LAYER} [transform-style:preserve-3d]`}>
            <div data-part="face" className={FACE}>
              <div className={`${LAYER} bg-[image:var(--achievement-card-rim)]`} style={mask(art)} />
              <div className={`${LAYER} bg-[image:var(--achievement-card-border)]`} style={mask(art, "90% 90%")} />
              <div className={`${LAYER} bg-[image:var(--achievement-card-field)]`} style={mask(art, "86% 86%")} />
              <div
                className={`${LAYER} bg-[image:var(--achievement-card-stars)] bg-[size:26px_26px,19px_19px] opacity-55`}
                style={mask(art, "86% 86%")}
              />
              <div data-part="mark" className={LAYER}>
                <div className={`${LAYER} bg-[image:var(--achievement-card-puhu)]`} style={mask(silhouette, "50% auto", "50% 60%")} />
                <PuhuMark />
              </div>
              <div className={LAYER} style={mask(art)}>
                <div data-part="sheen" className={SHEEN} />
              </div>
            </div>
            <div data-part="face" className={`${FACE} [transform:rotateY(180deg)]`}>
              <AchievementArt artKey={artKey} alt="" priority sizes={ART_SIZES} className="absolute inset-0 size-full" />
              <div className={`${LAYER} overflow-hidden`} style={mask(art)}>
                {[0, 1, 2].map((band) => (
                  <div
                    key={band}
                    data-part="glint"
                    className="absolute -bottom-[10%] -top-[10%] left-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.7),transparent)] opacity-0 blur-[3px]"
                    style={{ width: glintWidth }}
                  />
                ))}
              </div>
              <div className={LAYER} style={mask(art)}>
                <div data-part="sheen" className={SHEEN} />
              </div>
            </div>
            <div
              data-part="edge"
              className="absolute left-[48.1%] top-[7%] h-[86%] w-[3.8%] rounded-[4px] bg-[image:var(--achievement-card-edge)] opacity-0 [transform:rotateY(90deg)]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
