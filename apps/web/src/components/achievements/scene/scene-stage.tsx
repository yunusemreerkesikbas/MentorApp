"use client";

import type * as React from "react";
import type { AchievementId } from "@mentor/types";

import type { Point } from "./scene-engine";
import { SceneBadge } from "./scene-badge";
import { SceneCopy, SceneLedge, type SceneText } from "./scene-copy";

export interface StageCard {
  artKey: AchievementId;
  title: string;
}

/** The light that stays on behind the badge, in the badge's own colours. */
const HALO =
  "radial-gradient(circle, color-mix(in srgb, var(--scene-glow) 60%, transparent) 0%, color-mix(in srgb, var(--scene-glow) 24%, transparent) 26%, color-mix(in srgb, var(--scene-alt) 10%, transparent) 48%, transparent 68%)";

/** The whole screen lights up from the badge, then settles back into the halo. */
function flash(center: Point): string {
  return `radial-gradient(circle at ${center.x}px ${center.y}px, var(--achievement-flash-core) 0%, var(--achievement-flash-warm) 14%, color-mix(in srgb, var(--scene-glow) 62%, transparent) 34%, color-mix(in srgb, var(--scene-glow) 22%, transparent) 58%, transparent 82%)`;
}

const FILL = "pointer-events-none absolute inset-0";

interface SceneStageProps {
  rootRef: React.RefObject<HTMLElement | null>;
  slotRef: React.RefObject<HTMLDivElement | null>;
  copyRef: React.RefObject<HTMLDivElement | null>;
  titleId: string;
  bodyId: string;
  text: SceneText;
  /** Announced once the light comes on; the live region is in the DOM from the start. */
  announcement: string | null;
  ready: boolean;
  /** Visible cards; their edge is known once the slot has been measured. */
  cards: ReadonlyArray<StageCard>;
  edge: number | null;
  labels: boolean;
  /** Achievements beyond the visible cards, already formatted ("+3"); `null` for none. */
  more: string | null;
  center: Point | null;
  light: { glow: string; alt: string };
  error: string | null;
  onProceed: () => void;
}

/**
 * The layers of "Işık Yandı", back to front: the night curtain, the stars, the camera (halo, light
 * behind, cards, light in front), the words and the ledge, the flash. Every
 * moving part starts at its t = 0 pose here; the frame painter takes it from there.
 */
export function SceneStage(props: SceneStageProps) {
  const { rootRef, slotRef, copyRef, cards, edge, center } = props;
  return (
    <section
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={props.titleId}
      aria-describedby={props.bodyId}
      tabIndex={-1}
      className="achievement-scene-theme fixed inset-0 z-[120] touch-manipulation select-none overflow-hidden text-[var(--color-main)] outline-none"
      style={{ "--scene-glow": props.light.glow, "--scene-alt": props.light.alt } as React.CSSProperties}
    >
      <div aria-hidden="true" className={`${FILL} overflow-hidden`}>
        <div
          data-scene="dusk-sheet"
          className="absolute inset-x-0 top-0 h-[160%] bg-[image:var(--achievement-curtain)] will-change-transform"
          style={{ transform: "translate3d(0, -100%, 0)" }}
        />
        <div data-scene="dusk-glow" className="absolute inset-0 bg-[image:var(--achievement-horizon)] opacity-0" />
      </div>
      <canvas data-scene="stars" aria-hidden="true" className={`${FILL} size-full`} />

      <div data-scene="cam" aria-hidden="true" className={FILL}>
        <div
          data-scene="halo"
          className="absolute left-0 top-0 aspect-square w-[calc(var(--achievement-scene-badge)*2.4)] rounded-full opacity-0"
          style={{ background: HALO }}
        />
        <canvas data-scene="fx-back" className="absolute inset-0 size-full" />
        {edge !== null ? (
          <div className="absolute inset-0 isolate">
            {cards.map((card, i) => (
              <SceneBadge key={`${card.artKey}-${i}`} artKey={card.artKey} edge={edge} />
            ))}
            {props.labels
              ? cards.map((card, i) => (
                  <p
                    key={`${card.artKey}-label-${i}`}
                    data-scene="badge-label"
                    className="absolute left-0 top-0 z-30 text-center text-xs font-extrabold leading-tight text-[var(--achievement-label)] opacity-0"
                    style={{ width: edge * 1.1 }}
                  >
                    {card.title}
                  </p>
                ))
              : null}
            {props.more ? (
              <span
                data-scene="more"
                className="absolute left-0 top-0 z-30 rounded-full bg-[var(--achievement-chip)] px-2 py-0.5 text-caption font-extrabold opacity-0"
              >
                {props.more}
              </span>
            ) : null}
          </div>
        ) : null}
        <canvas data-scene="fx-front" className="absolute inset-0 size-full" />
      </div>

      <div className="pointer-events-none relative z-[2] flex h-full flex-col items-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[23vh] sm:justify-center sm:pt-6">
        <div ref={slotRef} className="size-[var(--achievement-scene-badge)] shrink-0" />
        <SceneCopy text={props.text} titleId={props.titleId} bodyId={props.bodyId} copyRef={copyRef} />
        <p role="status" className="sr-only">
          {props.announcement}
        </p>
        {cards.length > 1 ? (
          <ul className="sr-only">
            {cards.map((card, i) => (
              <li key={`${card.artKey}-${i}`}>{card.title}</li>
            ))}
          </ul>
        ) : null}
        <SceneLedge label={props.text.cta} ready={props.ready} error={props.error} onPress={props.onProceed} />
      </div>

      <div
        data-scene="flash"
        aria-hidden="true"
        className={`${FILL} z-[4] opacity-0 mix-blend-screen`}
        style={center ? { background: flash(center) } : undefined}
      />
    </section>
  );
}
