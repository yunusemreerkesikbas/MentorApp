import { useEffect, type RefObject } from "react";

/*
 * Taped paper notes bend like a sheet in a breeze: the tape holds the top, the lower half curls up
 * and its edge ripples from one side to the other, then the paper falls back flat. It is an SVG
 * displacement filter on the note, driven for DURATION and then removed, so a resting note stays
 * crisp. `--flutter-amp` (CSS, unitless px) is how far the bottom can lift; 0 keeps a note still.
 */

const NS = "http://www.w3.org/2000/svg";
const STILL = "(prefers-reduced-motion: reduce)";
/** Room around the note inside the filter: above for its tape, below for its shadow. */
const PAD = 40;
const PAD_BOTTOM = 90;
const DURATION = 1700;
/** The displacement map is drawn at half size; the filter stretches it back. */
const MAP_SCALE = 0.5;

/** One gust, then smaller ones, peaking near 1. Never below zero: the paper only falls back. */
const gust = (t: number) => (Math.exp(-3.4 * t) * Math.abs(Math.sin(2 * Math.PI * 1.75 * t))) / 0.6;

interface Bend {
  id: string;
  filter: SVGFilterElement;
  image: SVGFEImageElement;
  shade: SVGFEColorMatrixElement;
  move: SVGFEDisplacementMapElement;
  size?: string;
}

const bends = new WeakMap<Element, Bend>();
let sequence = 0;

function bendFor(note: Element): Bend {
  const existing = bends.get(note);
  if (existing) return existing;
  const id = `paper-bend-${sequence++}`;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  // The map is both the bend (G) and the shade (B): shade the paper first, then move it.
  svg.innerHTML = `<filter id="${id}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
    <feImage result="map" preserveAspectRatio="none"/>
    <feColorMatrix in="map" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0" result="shade"/>
    <feComposite in="shade" in2="SourceGraphic" operator="atop" result="paper"/>
    <feDisplacementMap in="paper" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G"/>
  </filter>`;
  document.body.append(svg);
  const bend: Bend = {
    id,
    filter: svg.querySelector("filter")!,
    image: svg.querySelector("feImage")!,
    shade: svg.querySelector("feColorMatrix")!,
    move: svg.querySelector("feDisplacementMap")!,
  };
  bends.set(note, bend);
  return bend;
}

/**
 * The map covers the filter region and runs two waves wide, so it can slide sideways. G pulls the
 * paper below the top third upward, more toward the bottom and more on a wave's crest: the curl.
 * B is the same amount, read back as a light shade over the curling part.
 */
function drawMap(bend: Bend, width: number, height: number) {
  const span = 2 * (width + 2 * PAD);
  const tall = height + PAD + PAD_BOTTOM;
  const size = `${width}x${height}`;
  if (bend.size !== size) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(span * MAP_SCALE);
    canvas.height = Math.ceil(tall * MAP_SCALE);
    const context = canvas.getContext("2d");
    if (!context) return false;
    const map = context.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) {
      const down = (y / MAP_SCALE - PAD) / height;
      const curl = down < 0.28 ? 0 : Math.min(1, ((down - 0.28) / 0.72) ** 2);
      for (let x = 0; x < canvas.width; x++) {
        const across = (x / MAP_SCALE - PAD) / width;
        const amount = curl * (0.55 + 0.45 * Math.sin(2 * Math.PI * across));
        const i = (y * canvas.width + x) * 4;
        map.data[i] = 128;
        map.data[i + 1] = 128 + 127 * amount;
        map.data[i + 2] = 255 * amount;
        map.data[i + 3] = 255;
      }
    }
    context.putImageData(map, 0, 0);
    bend.image.setAttribute("href", canvas.toDataURL());
    bend.size = size;
  }
  for (const [name, value] of [["x", -PAD], ["y", -PAD], ["width", width + 2 * PAD], ["height", tall]] as const) {
    bend.filter.setAttribute(name, String(value));
  }
  bend.image.setAttribute("y", String(-PAD));
  bend.image.setAttribute("width", String(span));
  bend.image.setAttribute("height", String(tall));
  return true;
}

/** One breeze on one note. A breeze in progress is never restarted, so the paper always settles. */
export function flutter(note: HTMLElement) {
  if (note.getAttribute("data-flutter") === "on") return;
  const amplitude = Number.parseFloat(getComputedStyle(note).getPropertyValue("--flutter-amp")) || 0;
  const width = note.offsetWidth;
  const height = note.offsetHeight;
  if (amplitude <= 0 || !width || !height) return;
  const bend = bendFor(note);
  if (!drawMap(bend, width, height)) return;

  note.setAttribute("data-flutter", "on");
  note.style.filter = `url(#${bend.id})`;
  const start = performance.now();
  const frame = (now: number) => {
    const t = Math.min(1, (now - start) / DURATION);
    const lift = gust(t);
    bend.move.setAttribute("scale", (amplitude * lift).toFixed(2));
    bend.shade.setAttribute("values", `0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${(0.16 * lift).toFixed(3)} 0 0`);
    // The ripple travels across the note as the gust passes.
    bend.image.setAttribute("x", (-PAD - t * 0.9 * width).toFixed(1));
    if (t < 1) {
      requestAnimationFrame(frame);
      return;
    }
    note.style.removeProperty("filter");
    note.setAttribute("data-flutter", "");
  };
  requestAnimationFrame(frame);
}

/**
 * Wires the `[data-flutter]` notes inside `root`: a mouse starts a breeze when it comes over a
 * note; on a touch screen each note gets one, the first time it comes into view.
 */
export function usePaperFlutter(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = root.current;
    if (!element || matchMedia(STILL).matches) return;

    const over = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !(event.target instanceof Element)) return;
      const note = event.target.closest<HTMLElement>("[data-flutter]");
      if (!note || (event.relatedTarget instanceof Node && note.contains(event.relatedTarget))) return;
      flutter(note);
    };
    element.addEventListener("pointerover", over);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue;
          observer.unobserve(entry.target);
          flutter(entry.target);
        }
      },
      { threshold: 0.35 },
    );
    if (matchMedia("(hover: none)").matches) {
      element.querySelectorAll("[data-flutter]").forEach((note) => observer.observe(note));
    }

    return () => {
      element.removeEventListener("pointerover", over);
      observer.disconnect();
    };
  }, [root]);
}

/** The cookie card is a taped note on the landing too: it gets one breeze as it opens. */
export function useCookieCardFlutter() {
  useEffect(() => {
    if (matchMedia(STILL).matches) return;
    let timer = 0;
    const settle = (card: HTMLElement) => {
      timer = window.setTimeout(() => flutter(card), 200);
    };
    const find = () => document.querySelector<HTMLElement>(".cookie-consent-banner");
    const open = find();
    if (open) {
      settle(open);
      return () => window.clearTimeout(timer);
    }
    const watcher = new MutationObserver(() => {
      const card = find();
      if (!card) return;
      watcher.disconnect();
      settle(card);
    });
    watcher.observe(document.body, { childList: true, subtree: true });
    return () => {
      watcher.disconnect();
      window.clearTimeout(timer);
    };
  }, []);
}
