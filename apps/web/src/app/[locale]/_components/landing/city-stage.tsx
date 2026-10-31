"use client";

/* eslint-disable @next/next/no-img-element -- the stars are a plain decorative SVG over the sky. */

import "@fontsource-variable/caveat/wght.css";
import "./city-stage.css";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  CAMERA_KEYS,
  STOP_COUNT,
  cameraAt,
  frontOpacity,
  interiorOpacity,
  layerTransform,
  panelPresence,
  skyGradient,
  stopAt,
} from "./city-camera";
import {
  FACADE,
  FAR,
  FRONT,
  FRONT_LIFT_TALL,
  LAYER_DEPTHS,
  MID,
  STOP_SCROLL_SVH,
  WINDOWS,
  YOURS_WINDOW,
  type SceneArt,
} from "./city-scene";
import { usePaperFlutter } from "./paper-flutter";
import { SceneImg, sceneBackground } from "./scene-img";

const WIDE = "(min-width: 1024px)";
const STILL = "(prefers-reduced-motion: reduce)";
const STOP_LINK = 'a[href^="#durak-"]';

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export interface CityBell {
  no: number;
  name: string;
  stop: number;
  label: string;
}

function Art({ art, priority }: { art: SceneArt; priority?: boolean }) {
  return (
    <SceneImg
      className="lc-art"
      src={art.src}
      width={art.naturalWidth}
      height={art.naturalHeight}
      fetchPriority={priority ? "high" : undefined}
      style={{ left: art.left, top: art.top, width: art.width }}
    />
  );
}

/**
 * The scroll-driven city. Native scroll moves a sticky stage; one rAF write per frame places the
 * layers, the sky and the notes (the welcome carousel's pattern), and React renders again only when
 * the stop changes. Links to `#durak-N` work without the script too: each is an anchor in the track.
 */
export function CityStage({
  panels,
  bells,
  intercomTitle,
  intercomLabel,
}: {
  /** One per stop, in order: the hero, seven windows, the dawn. */
  panels: ReactNode[];
  bells: CityBell[];
  intercomTitle: string;
  intercomLabel: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  usePaperFlutter(rootRef);
  const [stop, setStop] = useState(0);
  // The rooms are only visible up close; their art waits until the camera moves in.
  const [roomsOn, setRoomsOn] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const pick = (selector: string) => root.querySelector<HTMLElement>(selector);
    const track = pick(".lc-track");
    const stage = pick(".lc-stage");
    const sky = pick(".lc-sky");
    const stars = pick(".lc-stars");
    const moon = pick(".lc-moon");
    const sun = pick(".lc-sun");
    const scrim = pick(".lc-scrim");
    const rooms = pick(".lc-rooms");
    const layers = Array.from(root.querySelectorAll<HTMLElement>(".lc-layer"));
    const panelEls = Array.from(root.querySelectorAll<HTMLElement>(".lc-panel"));
    if (!track || !stage || !sky || !stars || !moon || !sun || !scrim || !rooms) return;

    // Outside this component, on the same page: the paper section after the dawn and the fixed nav.
    // While the paper is under the nav, the page root gets `data-day` and the nav turns to paper.
    const page = root.closest<HTMLElement>(".landing-city-theme");
    const paper = document.querySelector<HTMLElement>(".landing-paper");
    const nav = document.querySelector<HTMLElement>(".landing-nav");

    const wideMq = window.matchMedia(WIDE);
    const stillMq = window.matchMedia(STILL);
    let raf = 0;
    let idle = 0;
    let current = -1;
    let roomsLoaded = false;

    const progress = () => {
      const range = track.offsetHeight - stage.clientHeight;
      return range > 0 ? clamp01(-track.getBoundingClientRect().top / range) : 0;
    };

    const draw = () => {
      raf = 0;
      const still = stillMq.matches;
      const wide = wideMq.matches;
      const width = stage.clientWidth;
      const height = still ? window.innerHeight : stage.clientHeight;
      const p = still ? 0 : progress();
      const camera = cameraAt(p, wide ? CAMERA_KEYS.wide : CAMERA_KEYS.tall);

      sky.style.background = skyGradient(camera.sky);
      stars.style.opacity = Math.max(0, 1 - camera.sky * 2.2).toFixed(3);

      // The moon arcs left over the story and sets at dawn; the sun rises behind the building.
      const moonT = clamp01(p / 0.88);
      const moonHalf = wide ? 28 : 20;
      const moonX = (0.465 - 0.33 * moonT) * width;
      const moonY = (0.14 - 0.03 * Math.sin(Math.PI * moonT)) * height + Math.max(0, camera.sky - 0.25) * 0.5 * height;
      moon.style.transform = `translate3d(${(moonX - moonHalf).toFixed(1)}px,${(moonY - moonHalf).toFixed(1)}px,0)`;
      moon.style.opacity = (1 - clamp01((camera.sky - 0.35) / 0.4)).toFixed(3);
      const sunHalf = wide ? 75 : 50;
      const sunRise = clamp01((camera.sky - 0.3) / 0.7);
      const sunX = (wide ? 0.74 : 0.5) * width;
      const sunY = (0.85 + ((wide ? 0.36 : 0.22) - 0.85) * sunRise) * height;
      sun.style.transform = `translate3d(${(sunX - sunHalf).toFixed(1)}px,${(sunY - sunHalf).toFixed(1)}px,0)`;
      sun.style.opacity = clamp01((camera.sky - 0.25) / 0.4).toFixed(3);

      layers.forEach((layer, i) => {
        const lift = i === 3 && !wide ? FRONT_LIFT_TALL : 0;
        layer.style.transform = layerTransform(camera, LAYER_DEPTHS[i], width, height, lift);
      });
      layers[3].style.opacity = frontOpacity(camera.z).toFixed(3);
      rooms.style.opacity = interiorOpacity(camera.z).toFixed(3);

      panelEls.forEach((panel, i) => {
        if (still) {
          panel.style.removeProperty("opacity");
          panel.style.removeProperty("transform");
          panel.style.removeProperty("pointer-events");
          return;
        }
        const presence = panelPresence(p, i);
        panel.style.opacity = presence.toFixed(3);
        panel.style.transform = `translateY(${((1 - presence) * 24).toFixed(1)}px)`;
        panel.style.pointerEvents = presence > 0.6 ? "auto" : "none";
      });
      scrim.style.opacity = still ? "1" : panelPresence(p, 0).toFixed(3);

      // Rooms load once the camera leaves the wide shot, however it got there (scroll, a #durak link
      // the browser followed before this script ran, a doorbell).
      if (!roomsLoaded && p > 0) {
        roomsLoaded = true;
        setRoomsOn(true);
      }

      const next = still ? 0 : stopAt(p);
      if (next !== current) {
        current = next;
        root.dataset.stop = String(next);
        setStop(next);
      }

      if (page && paper) {
        const line = nav ? nav.getBoundingClientRect().bottom : 0;
        const sheet = paper.getBoundingClientRect();
        page.toggleAttribute("data-day", sheet.top <= line && sheet.bottom > line);
      }
      root.dataset.ready = "";
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    const onScroll = () => {
      schedule();
      root.dataset.moving = "";
      window.clearTimeout(idle);
      idle = window.setTimeout(() => delete root.dataset.moving, 180);
    };

    const scrollToStop = (index: number, smooth: boolean) => {
      if (stillMq.matches) {
        panelEls[index]?.scrollIntoView({ block: "start" });
        return;
      }
      const range = track.offsetHeight - stage.clientHeight;
      const top = window.scrollY + track.getBoundingClientRect().top + (index / (STOP_COUNT - 1)) * range;
      window.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
    };

    // "Nasıl çalışır", "Hikayeyi atla" and the doorbells: a smooth move to the stop instead of the jump.
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest(STOP_LINK) : null;
      const index = Number(link?.getAttribute("href")?.slice("#durak-".length));
      if (!link || !Number.isInteger(index) || index < 0 || index >= STOP_COUNT) return;
      event.preventDefault();
      scrollToStop(index, true);
    };

    // Tabbing into a note that is not on screen brings the camera to it.
    const onFocusIn = (event: FocusEvent) => {
      const panel = event.target instanceof Element ? event.target.closest<HTMLElement>(".lc-panel") : null;
      if (!panel || stillMq.matches) return;
      const index = Number(panel.dataset.stop);
      if (panelPresence(progress(), index) < 0.98) scrollToStop(index, false);
    };

    draw();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", schedule);
    wideMq.addEventListener("change", schedule);
    stillMq.addEventListener("change", schedule);
    document.addEventListener("click", onClick);
    root.addEventListener("focusin", onFocusIn);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(idle);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", schedule);
      wideMq.removeEventListener("change", schedule);
      stillMq.removeEventListener("change", schedule);
      document.removeEventListener("click", onClick);
      root.removeEventListener("focusin", onFocusIn);
    };
  }, []);

  return (
    <div ref={rootRef} className="lc-root" data-stop="0">
      <div className="lc-track" style={{ height: `${100 + (STOP_COUNT - 1) * STOP_SCROLL_SVH}svh` }}>
        {Array.from({ length: STOP_COUNT - 1 }, (_, i) => (
          <span
            key={i}
            id={`durak-${i + 1}`}
            className="lc-anchor"
            style={{ top: `${(i + 1) * STOP_SCROLL_SVH}svh` }}
          />
        ))}
        <div className="lc-stage">
          <div className="lc-scene" aria-hidden="true">
            <div className="lc-sky" />
            <img className="lc-stars" src="/visuals/landing/stars.svg" alt="" />
            <div className="lc-moon" />
            <div className="lc-sun" />
            <div className="lc-layer">
              <Art art={FAR} />
            </div>
            <div className="lc-layer">
              <Art art={MID} />
            </div>
            <div className="lc-layer">
              <Art art={FACADE} priority />
              {WINDOWS.filter((w) => w.room === "puhu").map((w) => (
                <div key={w.room} className="lc-win" data-stop={w.stop} style={{ left: w.left, top: w.top, width: w.width, height: w.height }}>
                  <SceneImg className="lc-room-art is-cover" src={`/visuals/landing/room-${w.room}.webp`} />
                </div>
              ))}
              {/* CSS backgrounds rather than image tags: nothing here loads until a pick shows it (city-stage.css). */}
              <div className="lc-win lc-win-yours" style={YOURS_WINDOW}>
                <div className="lc-room" />
                <div className="lc-oda">
                  <div className="lc-oda-art" style={sceneBackground("/visuals/landing/room-senin.webp")} />
                  <div className="lc-career" style={sceneBackground("/visuals/landing/careers.webp")} />
                  <div className="lc-undecided" style={sceneBackground("/visuals/landing/puhu-undecided.webp")} />
                  <div className="lc-oda-art lc-oda-front" style={sceneBackground("/visuals/landing/room-senin.webp")} />
                </div>
                <div className="lc-glass" />
              </div>
              <div className="lc-rooms">
                {WINDOWS.filter((w) => w.room !== "puhu").map((w) => (
                  <div key={w.room} className="lc-win" data-stop={w.stop} style={{ left: w.left, top: w.top, width: w.width, height: w.height }}>
                    <div className="lc-room" />
                    {roomsOn ? <SceneImg className="lc-room-art" src={`/visuals/landing/room-${w.room}.webp`} /> : null}
                  </div>
                ))}
              </div>
            </div>
            <div className="lc-layer">
              <Art art={FRONT} />
            </div>
            <div className="lc-scrim" />
          </div>
          {panels.map((panel, i) => (
            <section
              key={i}
              className="lc-panel"
              data-stop={i}
              data-kind={i === 0 ? "hero" : i === STOP_COUNT - 1 ? "dawn" : "note"}
            >
              {panel}
            </section>
          ))}
          <nav className="lc-intercom" aria-label={intercomLabel}>
            <span className="lc-intercom-title" aria-hidden="true">
              {intercomTitle}
            </span>
            {bells.map((bell) => (
              <a
                key={bell.no}
                className="lc-bell"
                href={`#durak-${bell.stop}`}
                aria-label={bell.label}
                aria-current={stop === bell.stop ? "location" : undefined}
              >
                <b>{bell.no}</b>
                <span>{bell.name}</span>
                <i />
              </a>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
