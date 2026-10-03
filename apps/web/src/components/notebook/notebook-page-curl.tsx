"use client";

import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import {
  clampCurlPoint,
  curlCorner,
  curlFrame,
  curlModel,
  curlPathPoint,
  curlTarget,
  easeInOutCubic,
  easeOutCubic,
  type CurlGeometry,
  type CurlPoint,
} from "@/lib/notebook-curl";

/**
 * A page being turned by its corner, with what is written on it still on it.
 *
 * Replaces a rigid 3D leaf that could only ever carry blank ruled paper: real pages bent in 3D
 * (a chain of hinged slices) kinked their rulings at every seam once the leaf lay down.
 * The turn here is the one a sheet of paper actually makes: one straight fold between the corner and
 * where the corner is held, the part beyond it laid over showing the back of the sheet, and the page
 * underneath showing through where it lifted away (`lib/notebook-curl.ts` has the geometry).
 *
 * The turn draws the whole book box itself, the pages that do not move included (`ground`), so the
 * live spread underneath can stay exactly as it was until the turn is over and then swap in one
 * commit to what the turn finished on. Every frame is written straight onto the DOM: a turn redraws
 * clip paths and gradients sixty times a second, and none of that is React's business.
 *
 * Two drivers. `auto` runs the corner along a lifted arc on its own (arrows, keys). `drag` follows
 * a pointer from the page corner; let go past a third of the way, or flick, and it finishes,
 * otherwise it falls back flat.
 */

export type CurlDrive =
  | {
      kind: "auto";
      /** Unfold instead: the corner comes back from the far side (a phone turning back a page). */
      reverse?: boolean;
      durationMs: number;
    }
  | {
      kind: "drag";
      pointerId: number;
      /** Where the pointer went down, in the book box's own pixels. */
      grab: CurlPoint;
      reverse?: boolean;
      /**
       * How far the corner moves per pixel of pointer travel. Unfolding a page back in starts with
       * its corner a whole page off-screen, which a finger crossing the screen once has to cover.
       */
      gain?: number;
    };

export interface NotebookPageCurlProps {
  geometry: CurlGeometry;
  /** The book box: pointer coordinates are taken relative to it. */
  boxRef: RefObject<HTMLElement | null>;
  /** Everything that lies still during the turn, the page being uncovered included. */
  ground: ReactNode;
  /** The face of the turning leaf that shows before the turn. */
  front: ReactNode;
  /** Its other face, the one the fold shows and the turn ends on. */
  back: ReactNode;
  /** Drawn over the turning leaf, under nothing: the coil the leaf threads through. */
  top?: ReactNode;
  drive: CurlDrive;
  /** How high the corner rises at the middle of a hands-off turn, in px. */
  lift: number;
  onDone: (committed: boolean) => void;
}

/** Past this share of the way, letting go finishes the turn. */
const COMMIT_PROGRESS = 0.32;
/** A release faster than this (px per ms, towards the far side) finishes it from anywhere. */
const FLICK_SPEED = 0.55;

export function NotebookPageCurl({
  geometry,
  boxRef,
  ground,
  front,
  back,
  top,
  drive,
  lift,
  onDone,
}: NotebookPageCurlProps) {
  const frontRef = useRef<HTMLDivElement>(null);
  const frontShadeRef = useRef<HTMLDivElement>(null);
  const underRef = useRef<HTMLDivElement>(null);
  const flapWrapRef = useRef<HTMLDivElement>(null);
  const flapRef = useRef<HTMLDivElement>(null);
  const flapShadeRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const parts = {
      front: frontRef.current,
      frontShade: frontShadeRef.current,
      under: underRef.current,
      flapWrap: flapWrapRef.current,
      flap: flapRef.current,
      flapShade: flapShadeRef.current,
    };
    if (Object.values(parts).some((part) => part === null)) return;
    const el = parts as { [K in keyof typeof parts]: HTMLDivElement };
    const scale = geometry.leafWidth / 1080;
    const corner = curlCorner(geometry);
    const target = curlTarget(geometry);
    let frame = 0;
    let finished = false;

    function draw(point: CurlPoint) {
      const view = curlFrame(geometry, point, scale);
      if (!view) {
        el.front.style.clipPath = "none";
        el.frontShade.style.background = "none";
        el.under.style.clipPath = "polygon(0px 0px, 0px 0px, 0px 0px)";
        el.flapWrap.style.visibility = "hidden";
        return;
      }
      el.front.style.clipPath = view.front;
      el.frontShade.style.background = view.frontShade;
      el.under.style.clipPath = view.folded;
      el.under.style.background = view.underShade;
      el.flapWrap.style.visibility = "visible";
      // The higher the sheet stands, the further and softer the shadow it throws on the book.
      const rise = view.lift;
      el.flapWrap.style.filter = `drop-shadow(0 ${(4 + 18 * rise * scale).toFixed(1)}px ${(6 + 34 * rise * scale).toFixed(1)}px rgba(0,0,0,${(0.1 + 0.26 * rise).toFixed(3)}))`;
      el.flap.style.clipPath = view.folded;
      el.flap.style.transform = view.reflection;
      el.flapShade.style.background = view.flapShade;
    }

    function tween(
      from: CurlPoint,
      to: CurlPoint,
      durationMs: number,
      ease: (t: number) => number,
      arc: number,
      done: () => void,
    ) {
      const started = performance.now();
      const step = () => {
        const t = Math.min(1, (performance.now() - started) / durationMs);
        draw(curlPathPoint(from, to, ease(t), arc));
        if (t < 1) frame = requestAnimationFrame(step);
        else done();
      };
      frame = requestAnimationFrame(step);
    }

    function finish(committed: boolean) {
      if (finished) return;
      finished = true;
      onDone(committed);
    }

    if (drive.kind === "auto") {
      const from = drive.reverse ? target : corner;
      const to = drive.reverse ? corner : target;
      draw(from);
      tween(from, to, drive.durationMs, easeInOutCubic, lift, () => finish(true));
      return () => cancelAnimationFrame(frame);
    }

    // Dragged: the corner starts where it is and moves with the pointer from where it went down.
    const start = drive.reverse ? target : corner;
    const gain = drive.gain ?? 1;
    const toward = drive.reverse ? corner : target;
    let point = start;
    let samples: Array<{ x: number; t: number }> = [];
    draw(point);

    const local = (event: PointerEvent): CurlPoint => {
      const box = boxRef.current?.getBoundingClientRect();
      const x = event.clientX - (box?.left ?? 0);
      const y = event.clientY - (box?.top ?? 0);
      return {
        x: start.x + (x - drive.grab.x) * gain,
        y: start.y + (y - drive.grab.y),
      };
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== drive.pointerId) return;
      event.preventDefault();
      point = clampCurlPoint(geometry, local(event));
      samples = [...samples.slice(-4), { x: point.x, t: event.timeStamp }];
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => draw(point));
    };
    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== drive.pointerId) return;
      detach();
      const model = curlModel(geometry, point);
      // Unfolding runs the other way: "done" is the corner coming home, not leaving.
      const travelled = model ? (drive.reverse ? 1 - model.progress : model.progress) : drive.reverse ? 1 : 0;
      const first = samples[0];
      const last = samples[samples.length - 1];
      const speed =
        first && last && last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;
      const towards = Math.sign(toward.x - start.x);
      const commit =
        event.type !== "pointercancel" &&
        (travelled > COMMIT_PROGRESS || speed * towards > FLICK_SPEED);
      const end = commit ? toward : start;
      const remaining = commit ? 1 - travelled : travelled;
      tween(point, end, 140 + 420 * remaining, easeOutCubic, 0, () => finish(commit));
    };
    function detach() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    }
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      detach();
      cancelAnimationFrame(frame);
    };
    // A curl is mounted once per turn (`key`), and runs to its end with what it started with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leafBox = {
    position: "absolute" as const,
    top: 0,
    left: geometry.leafX,
    width: geometry.leafWidth,
    height: geometry.height,
  };

  return (
    <div
      aria-hidden="true"
      className="nb-curl"
      style={{ position: "absolute", inset: 0, overflow: "hidden", touchAction: "none" }}
    >
      <div style={{ position: "absolute", inset: 0 }}>{ground}</div>
      <div ref={frontRef} style={leafBox}>
        {front}
        <div ref={frontShadeRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
      </div>
      <div ref={underRef} style={{ ...leafBox, pointerEvents: "none" }} />
      <div
        ref={flapWrapRef}
        style={{ position: "absolute", inset: 0, pointerEvents: "none", visibility: "hidden" }}
      >
        <div ref={flapRef} style={{ ...leafBox, transformOrigin: "0 0" }}>
          {/* The back of the sheet, mirrored here so the fold's own mirroring sets it right. */}
          <div style={{ position: "absolute", inset: 0, transform: "scaleX(-1)" }}>{back}</div>
          <div ref={flapShadeRef} style={{ position: "absolute", inset: 0 }} />
        </div>
      </div>
      {top ? (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>{top}</div>
      ) : null}
    </div>
  );
}
