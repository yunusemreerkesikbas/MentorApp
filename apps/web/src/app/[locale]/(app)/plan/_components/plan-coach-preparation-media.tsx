"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./plan-coach-preparation-scene.module.css";

const ART = "/mascot/puhu/planning-flight";

export function PlanCoachPreparationMedia() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      setPlaying(false);
      setFailed(false);
      setSource(
        reduced.matches
          ? null
          : `${ART}/${desktop.matches ? "desktop" : "mobile"}.mp4`,
      );
    };
    update();
    reduced.addEventListener("change", update);
    desktop.addEventListener("change", update);
    const pauseHidden = () => {
      const node = videoRef.current;
      if (!node) return;
      if (document.hidden) node.pause();
      else void node.play().catch(() => setPlaying(false));
    };
    document.addEventListener("visibilitychange", pauseHidden);
    return () => {
      reduced.removeEventListener("change", update);
      desktop.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", pauseHidden);
    };
  }, []);

  return (
    <div className={styles.media} aria-hidden>
      <picture>
        <source media="(min-width: 1024px)" srcSet={`${ART}/desktop.webp`} />
        <img
          src={`${ART}/mobile.webp`}
          alt=""
          className={styles.frame}
          fetchPriority="high"
        />
      </picture>
      {source && !failed ? (
        <video
          key={source}
          ref={videoRef}
          src={source}
          muted
          autoPlay
          loop
          playsInline
          preload="auto"
          className={`${styles.frame} ${playing ? styles.playing : styles.loadingVideo}`}
          onPlaying={() => setPlaying(true)}
          onError={() => {
            setFailed(true);
            setPlaying(false);
          }}
        />
      ) : null}
    </div>
  );
}
