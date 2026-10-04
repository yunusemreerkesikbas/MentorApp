"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import type { WELCOME_SCENES } from "@/lib/onboarding-assets";

type Scene = (typeof WELCOME_SCENES)[number];

/** Keeps Puhu in frame when the 3:5 clip is cropped into a wider stage. */
const FRAMING = "object-cover object-[50%_35%]";

/**
 * One slide's clip. It plays from the top each time its slide becomes active and holds on the last
 * frame; neighbours preload so a swipe never waits. Autoplay can still be refused (iOS low-power
 * mode), which leaves the first-frame poster up. Reduced motion shows the end state as a still.
 */
export function WelcomeScene({
  scene,
  active,
  near,
  still,
  priority,
}: {
  scene: Scene;
  active: boolean;
  near: boolean;
  still: boolean;
  priority: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!active) {
      video.pause();
      return;
    }
    video.currentTime = 0;
    video.play().catch(() => undefined);
  }, [active, still]);

  if (still) {
    return (
      <Image src={scene.end} alt="" fill priority={priority} sizes="(min-width: 1024px) 520px, 100vw" className={FRAMING} />
    );
  }

  return (
    <video
      ref={videoRef}
      className={`absolute inset-0 size-full ${FRAMING}`}
      poster={scene.start}
      muted
      playsInline
      preload={near ? "auto" : "none"}
      aria-hidden
    >
      <source src={scene.video} type="video/mp4" />
    </video>
  );
}
