"use client";

import { useEffect, useRef } from "react";

const LOOP = "/mascot/puhu/motion/puhu-hero-magic-loop.mp4";
/** The loop's first frame: the window's picture before the camera arrives, and with reduced motion. */
const POSTER = "/mascot/puhu/motion/puhu-hero-magic.webp";

/**
 * Puhu's "Koçla planla" magic loop as the Plan flat's room (window 4). It downloads and plays only
 * while the camera stands on that stop (`.lc-root[data-stop]`), and pauses when it moves on.
 * Reduced motion keeps the poster: the scene stacks the notes and never moves the stop.
 */
export function PlanMagicVideo({ stop, className }: { stop: number; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    const root = video?.closest<HTMLElement>(".lc-root");
    if (!video || !root) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (!still.matches && root.dataset.stop === String(stop)) void video.play().catch(() => {});
      else video.pause();
    };
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-stop"] });
    sync();
    return () => observer.disconnect();
  }, [stop]);

  return (
    <video
      ref={ref}
      className={className}
      src={LOOP}
      poster={POSTER}
      preload="none"
      muted
      loop
      playsInline
      aria-hidden
    />
  );
}
