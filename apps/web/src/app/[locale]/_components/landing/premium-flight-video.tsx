"use client";

import { useEffect, useRef, useState } from "react";

const LOOP = "/mascot/puhu/motion/puhu-premium-flight-loop.mp4";
/** The loop's first frame: what shows before it plays, if it fails, and with reduced motion. */
const POSTER = "/mascot/puhu/motion/puhu-premium-flight.webp";

/**
 * Premium Puhu's flying loop. It downloads and plays only while the sheet is on screen and pauses
 * when it scrolls away. Reduced motion never plays it, so the poster stays. The server and the
 * first client render are the same `<video>`: the reduced-motion choice lives in the effect.
 */
export function PremiumFlightVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    let onScreen = false;
    const sync = () => {
      if (onScreen && !still.matches) void video.play().catch(() => {});
      else video.pause();
    };
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = Boolean(entry?.isIntersecting);
      sync();
    }, { threshold: 0.25 });
    observer.observe(video);
    still.addEventListener("change", sync);
    return () => {
      observer.disconnect();
      still.removeEventListener("change", sync);
    };
  }, [failed]);

  if (failed) {
    // eslint-disable-next-line @next/next/no-img-element -- one fixed-size local still, the loop's poster
    return <img src={POSTER} alt="" width={720} height={720} />;
  }
  return <video ref={ref} src={LOOP} poster={POSTER} preload="none" muted loop playsInline onError={() => setFailed(true)} />;
}
