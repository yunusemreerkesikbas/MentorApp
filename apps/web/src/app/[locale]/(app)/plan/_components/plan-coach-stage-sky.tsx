"use client";

import { useState } from "react";
import { SceneImg } from "@/app/[locale]/_components/landing/scene-img";

const LOOP = "/mascot/puhu/motion/puhu-magic-loop.mp4";
/** The loop's first frame: what shows while it loads, if it fails, and with reduced motion. */
const POSTER = "/mascot/puhu/motion/puhu-magic.webp";

/**
 * The landing's night city along the bottom of the scene (sizes in `plan-coach-stage.css`). Fixed,
 * so it stays put if a short screen scrolls the scene; the sky gradient is the dialog's own.
 */
export function PlanCoachStageSky() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <SceneImg src="/visuals/landing/city-far.webp" className="pcs-city pcs-city-far" />
      <SceneImg src="/visuals/landing/city-mid.webp" className="pcs-city pcs-city-mid" />
      <SceneImg src="/visuals/landing/city-front.webp" className="pcs-city pcs-city-front" />
      <div className="pcs-shade" />
    </div>
  );
}

/** Puhu's magic loop in a soft round mask, over the city. */
export function PlanCoachStageVideo({ reduceMotion }: { reduceMotion: boolean }) {
  const [failed, setFailed] = useState(false);
  if (reduceMotion || failed) {
    // eslint-disable-next-line @next/next/no-img-element -- one fixed-size local still, as the poster
    return <img src={POSTER} alt="" aria-hidden className="pcs-video" />;
  }
  return (
    <video
      className="pcs-video"
      src={LOOP}
      poster={POSTER}
      autoPlay
      muted
      loop
      playsInline
      aria-hidden
      onError={() => setFailed(true)}
    />
  );
}
