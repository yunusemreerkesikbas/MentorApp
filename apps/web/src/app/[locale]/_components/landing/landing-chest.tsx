"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "framer-motion";
import { ChestLamps } from "@/components/weekly-chest/chest-art";

/** The app's own chest scene media (`weekly-chest/chest-scene.tsx`): 16:9 from a tablet up, square below. */
const WIDE = "(min-width: 768px)";
const MEDIA = {
  wide: {
    closed: "/visuals/chest/desk-chest-closed-wide.webp",
    open: "/visuals/chest/desk-chest-open-wide.webp",
    clip: "/visuals/chest/chest-open-wide.mp4",
    strip: "deskWide",
  },
  square: {
    closed: "/visuals/chest/desk-chest-closed.webp",
    open: "/visuals/chest/desk-chest-open.webp",
    clip: "/visuals/chest/chest-open.mp4",
    strip: "desk",
  },
} as const;
type Layout = keyof typeof MEDIA;

/** The five active days the chest asks for (`weekly.effort-allowance`). */
const DAYS = 5;
/** One lamp lights this often once the scene is on screen. */
const LAMP_MS = 320;
/** The lamps flow into the lock before the lid opens, as in the app. */
const FLOW_MS = 400;

type Phase = "ready" | "flow" | "clip" | "open";

function subscribeLayout(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const currentLayout = (): Layout => (window.matchMedia(WIDE).matches ? "wide" : "square");

/**
 * "Masa lambası" on the landing, a small sibling of the app's chest scene. When it scrolls into
 * view the five day lamps light one by one and the chest says "Hazır!". Tap the chest (or the
 * button): the lamps flow into the lock, the lid clip plays once and rests on its last frame.
 * The clip downloads only on the tap. Reduced motion: lamps already lit, stills crossfade.
 */
export function LandingChest({
  title,
  body,
  readyLabel,
  openLabel,
  againLabel,
  closedAlt,
  openAlt,
}: {
  title: string;
  body: string;
  readyLabel: string;
  openLabel: string;
  againLabel: string;
  closedAlt: string;
  openAlt: string;
}) {
  const reduceMotion = Boolean(useReducedMotion());
  const layout = useSyncExternalStore(subscribeLayout, currentLayout, (): Layout => "square");
  const media = MEDIA[layout];
  const rootRef = useRef<HTMLDivElement>(null);
  const [lit, setLit] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [played, setPlayed] = useState(false);
  const full = lit;

  // Light the lamps once the scene is half on screen, one by one; with reduced motion, all at once.
  // Never in the first render: the server cannot know the setting, so it renders them unlit.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let timer = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        if (reduceMotion) {
          setLit(DAYS);
          return;
        }
        timer = window.setInterval(() => {
          setLit((count) => {
            if (count + 1 >= DAYS) window.clearInterval(timer);
            return Math.min(DAYS, count + 1);
          });
        }, LAMP_MS);
      },
      { threshold: 0.5 },
    );
    observer.observe(root);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [reduceMotion]);

  useEffect(() => {
    if (phase !== "flow") return;
    const timer = window.setTimeout(() => setPhase("clip"), FLOW_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // Every press plays the opening from the start, the open chest included (the clip unmounts during the flow).
  const open = () => {
    if (phase === "flow" || phase === "clip") return;
    setLit(DAYS);
    setPlayed(!reduceMotion);
    setPhase(reduceMotion ? "open" : "flow");
  };

  const isOpen = phase === "open";
  const showClip = played && (phase === "clip" || isOpen);

  return (
    <div ref={rootRef} className="lj-chest weekly-chest-night" data-phase={phase}>
      <div className="lj-chest-stage">
        {/* The clip's own first and last frames; the closed one stays under the clip while it plays. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- two fixed local stills that crossfade */}
        <img src={media.closed} alt={isOpen ? "" : closedAlt} className={`wc-fade ${isOpen ? "opacity-0" : ""}`} />
        {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
        <img src={media.open} alt={isOpen ? openAlt : ""} loading="lazy" className={`wc-fade ${isOpen ? "" : "opacity-0"}`} />
        {showClip ? (
          <video
            src={media.clip}
            autoPlay
            muted
            playsInline
            aria-hidden
            onEnded={() => setPhase("open")}
            onError={() => {
              setPlayed(false);
              setPhase("open");
            }}
          />
        ) : null}
        {phase === "ready" || phase === "flow" ? (
          <span className={`lj-chest-lamps${full === DAYS && phase === "ready" ? " wc-twinkle" : ""}`}>
            <ChestLamps lamps={Array.from({ length: DAYS }, (_, i) => i < full)} strip={media.strip} flowing={phase === "flow"} />
          </span>
        ) : null}
        {phase === "ready" && full === DAYS ? (
          <span className="lj-chest-ready" aria-hidden>
            {readyLabel}
          </span>
        ) : null}
        {/* The chest itself is the way in; the real button below carries the name and the focus. */}
        {phase === "ready" ? (
          <button type="button" tabIndex={-1} aria-hidden onClick={open} className="absolute inset-0 z-[3] cursor-pointer" />
        ) : null}
      </div>
      <div className="lj-chest-bar">
        <div>
          <h3 className="lj-chest-title">{title}</h3>
          <p className="lj-chest-body">{body}</p>
        </div>
        <button
          type="button"
          onClick={open}
          disabled={phase === "flow" || phase === "clip"}
          className="wc-gold-button min-h-12 shrink-0 cursor-pointer rounded-full px-7 text-base font-black outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--wc-ground)] disabled:cursor-default max-md:w-full"
        >
          {isOpen ? againLabel : openLabel}
        </button>
      </div>
    </div>
  );
}
