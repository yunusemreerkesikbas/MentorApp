"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { NotebookContentsDto } from "@mentor/types";
import { PAGE_PERCENT } from "@/components/notebook/notebook-surface";
import { useAuth } from "@/lib/auth-context";
import { prefetchNotebookContents } from "@/lib/notebook-contents-cache";
import {
  deskBookThickness,
  deskFlyTarget,
  deskFlyTargetSingle,
  DESK_PERSPECTIVE_PX,
  NOTEBOOK_OPENING,
} from "@/lib/notebook-desk";
import {
  notebookOpening,
  useNotebookOpening,
  type NotebookOpeningLanding,
  type NotebookOpeningStart,
} from "@/lib/notebook-opening";
import {
  bookTransform,
  flatTransformOnto,
  LIFT_POSE,
  openBookLanding,
  PHONE_QUERY,
} from "@/lib/notebook-opening-geometry";
import { playNotebookSfx } from "@/lib/notebook-sfx";
import { NotebookBook, NotebookInsideCover } from "./notebook-book";
import { NotebookContentsPage } from "./notebook-contents-page";

/**
 * The moment a notebook leaves the desk: it sinks under the finger, rises, flies to the middle of
 * the screen squaring up as it comes, and its cover swings open onto the contents page. The editor
 * mounts underneath while the book is still in the air, and the book lets go only once the editor's
 * first spread is laid out exactly where the book is about to land.
 *
 * Lives in the app shell because it outlives both pages it joins. Driven by the Web Animations API
 * rather than React state: one timeline, finishable in one call when the student taps to skip, and
 * nothing re-renders while it plays.
 *
 * DESIGN.md §9.1 caps a Moment at 600 ms; this one is the scoped exception (about 1.5 s, the fly may
 * overshoot) and a tap anywhere skips it. Under reduced motion there is no flight: the editor simply
 * opens on the contents spread.
 */
export function NotebookOpeningOverlay() {
  const state = useNotebookOpening();
  if (!state.start) return null;
  return (
    <OpeningFlight
      key={state.run}
      run={state.run}
      start={state.start}
      landing={state.landing}
    />
  );
}

/**
 * The editor's own margin around a spread on a wide screen: its padding and the overlays that sit
 * on the book rather than beside it. Measured off the editor; the landing nudge absorbs the rest.
 */
const EDITOR_CHROME = { top: 41, bottom: 41, side: 12 };

interface FlightParts {
  root: HTMLDivElement;
  scrim: HTMLButtonElement;
  shadow: HTMLDivElement;
  pose: HTMLDivElement;
  cover: HTMLDivElement;
}

interface FlightCallbacks {
  onLowered: () => void;
  onLeaving: () => void;
}

/**
 * One flight, as plain imperative code: React mounts the parts, this moves them. Kept out of the
 * component so nothing about the timeline ever runs during a render.
 */
function createFlight(
  run: number,
  start: NotebookOpeningStart,
  parts: FlightParts | null,
  callbacks: FlightCallbacks,
) {
  const animations: Animation[] = [];
  const timers: number[] = [];
  let navigated = false;
  let opened = false;
  let settled = false;
  let leaving = false;
  let landing: NotebookOpeningLanding | null = null;
  let flyEnd = "";
  let waiting = 0;

  const later = (ms: number, run: () => void) => {
    timers.push(window.setTimeout(run, ms));
  };

  function navigate() {
    if (navigated) return;
    navigated = true;
    start.navigate();
  }

  function leave() {
    if (leaving) return;
    leaving = true;
    callbacks.onLeaving();
    if (!parts) {
      notebookOpening.finish(run);
      return;
    }
    const fade = parts.root.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: NOTEBOOK_OPENING.fadeMs,
      easing: "ease-out",
      fill: "forwards",
    });
    fade.finished
      .catch(() => undefined)
      .then(() => notebookOpening.finish(run));
  }

  function settle() {
    if (!parts || settled || !opened || !landing) return;
    window.clearTimeout(waiting);
    settled = true;
    const onto = openBookLanding(landing, PAGE_PERCENT / 100);
    const move = parts.pose.animate(
      [{ transform: flyEnd }, { transform: flatTransformOnto(start.from, onto) }],
      {
        duration: NOTEBOOK_OPENING.settleMs,
        easing: NOTEBOOK_OPENING.settleEase,
        fill: "forwards",
      },
    );
    animations.push(move);
    move.finished.catch(() => undefined).then(leave);
  }

  function fly() {
    if (!parts) return;
    const { from, pose } = start;
    // Aimed at where the editor will put the book, so landing on it is a nudge rather than a move.
    const closed = window.matchMedia(PHONE_QUERY).matches
      ? deskFlyTargetSingle(start.area)
      : deskFlyTarget(start.area, EDITOR_CHROME);
    const resting = { x: 0, y: 0, scale: 1, rotateX: pose.rotateX, rotateZ: pose.rotateZ, lift: 0 };
    flyEnd = flatTransformOnto(from, closed);

    const { pressMs, liftMs, flyAtMs, flyMs, openAtMs, openMs } = NOTEBOOK_OPENING;
    const total = flyAtMs + flyMs;
    animations.push(
      parts.pose.animate(
        [
          { offset: 0, transform: bookTransform(resting), easing: "cubic-bezier(.3,0,.2,1)" },
          {
            offset: pressMs / total,
            transform: bookTransform({ ...resting, y: from.height * 0.01, scale: 0.985 }),
            easing: NOTEBOOK_OPENING.liftEase,
          },
          {
            offset: (pressMs + liftMs) / total,
            transform: bookTransform({
              x: 0,
              y: -from.height * LIFT_POSE.rise,
              scale: LIFT_POSE.scale,
              rotateX: LIFT_POSE.rotateX,
              rotateZ: pose.rotateZ * 0.3,
              lift: from.width * LIFT_POSE.lift,
            }),
            easing: NOTEBOOK_OPENING.flyEase,
          },
          { offset: 1, transform: flyEnd },
        ],
        { duration: total, fill: "forwards" },
      ),
    );
    const thickness = (deskBookThickness(start.book.pageCount) / 100) * from.width;
    const open = parts.cover.animate(
      [
        { transform: `translateZ(${thickness.toFixed(2)}px) rotateY(0deg)` },
        { transform: `translateZ(${thickness.toFixed(2)}px) rotateY(-180deg)` },
      ],
      { duration: openMs, delay: openAtMs, easing: NOTEBOOK_OPENING.openEase, fill: "both" },
    );
    animations.push(
      open,
      parts.scrim.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 420,
        delay: pressMs,
        easing: "ease",
        fill: "both",
      }),
      parts.shadow.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 380,
        delay: 60,
        easing: "ease-out",
        fill: "both",
      }),
    );

    playNotebookSfx("lift");
    later(pressMs, callbacks.onLowered);
    later(NOTEBOOK_OPENING.navigateAtMs, navigate);
    later(openAtMs, () => playNotebookSfx("open"));
    open.finished
      .then(() => {
        opened = true;
        if (!landing) waiting = window.setTimeout(leave, NOTEBOOK_OPENING.landingWaitMs);
        settle();
      })
      .catch(() => undefined);
  }

  return {
    begin() {
      later(NOTEBOOK_OPENING.giveUpMs, leave);
      if (parts) fly();
      else navigate();
    },
    /** Every running beat jumps to its end: the book is open in the middle of the screen. */
    skip() {
      if (opened || !parts) return;
      // Finished here, the open beat resolves on its own and `settle` takes over from there.
      for (const animation of animations) {
        try {
          animation.finish();
        } catch {
          /* already done */
        }
      }
      callbacks.onLowered();
      navigate();
    },
    land(next: NotebookOpeningLanding | null) {
      landing = next;
      if (!landing) return;
      if (!parts) leave();
      else settle();
    },
    dispose() {
      window.clearTimeout(waiting);
      for (const timer of timers) window.clearTimeout(timer);
      for (const animation of animations) animation.cancel();
    },
  };
}

function OpeningFlight({
  run,
  start,
  landing,
}: {
  run: number;
  start: NotebookOpeningStart;
  landing: NotebookOpeningLanding | null;
}) {
  const t = useTranslations("notebooks.desk");
  const notebookT = useTranslations("notebook");
  const { user } = useAuth();
  const reduceMotion = useReducedMotion() ?? false;
  const [contents, setContents] = useState<NotebookContentsDto | null>(null);
  const [lifted, setLifted] = useState(start.pose.lifted);
  const [leaving, setLeaving] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrimRef = useRef<HTMLButtonElement | null>(null);
  const shadowRef = useRef<HTMLDivElement | null>(null);
  const poseRef = useRef<HTMLDivElement | null>(null);
  const coverRef = useRef<HTMLDivElement | null>(null);
  const flight = useRef<ReturnType<typeof createFlight> | null>(null);

  const { book, from } = start;
  const notebookId = book.key === "mistake" ? undefined : book.key;

  useEffect(() => {
    let active = true;
    prefetchNotebookContents(notebookId)
      .then((value) => {
        if (active) setContents(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [notebookId]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const scrim = scrimRef.current;
    const shadow = shadowRef.current;
    const pose = poseRef.current;
    const cover = coverRef.current;
    const parts =
      !reduceMotion && root && scrim && shadow && pose && cover
        ? { root, scrim, shadow, pose, cover }
        : null;
    const current = createFlight(run, start, parts, {
      onLowered: () => setLifted(false),
      onLeaving: () => setLeaving(true),
    });
    flight.current = current;
    current.begin();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        current.skip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      current.dispose();
      flight.current = null;
    };
    // One flight per mount; the next notebook remounts this component (`key={run}`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    flight.current?.land(landing);
  }, [landing]);

  if (reduceMotion) return null;

  return (
    <div
      ref={rootRef}
      className="nb-opening"
      style={{ pointerEvents: leaving ? "none" : undefined }}
    >
      <button
        ref={scrimRef}
        type="button"
        className="nb-opening-scrim"
        aria-label={t("skip")}
        onClick={() => flight.current?.skip()}
      />
      <div
        ref={shadowRef}
        className="nb-opening-desk-shadow"
        aria-hidden="true"
        style={{
          left: from.x,
          top: from.y,
          width: from.width,
          height: from.height,
          transform: `perspective(${DESK_PERSPECTIVE_PX}px) rotateX(${start.pose.rotateX}deg) rotateZ(${start.pose.rotateZ}deg) translate(3%, 4%)`,
        }}
      />
      <div
        className="nb-opening-book"
        aria-hidden="true"
        style={{ left: from.x, top: from.y, width: from.width, height: from.height }}
      >
        <NotebookBook
          title={book.title}
          kind={book.kind}
          cover={book.cover}
          pageCount={book.pageCount}
          dueCount={book.dueCount}
          subject={book.subject}
          meta={book.meta}
          dueLabel={book.dueLabel}
          lifted={lifted}
          poseRef={poseRef}
          coverRef={coverRef}
          transform={bookTransform({
            x: 0,
            y: 0,
            scale: 1,
            rotateX: start.pose.rotateX,
            rotateZ: start.pose.rotateZ,
            lift: 0,
          })}
          inside={
            <NotebookInsideCover
              cover={book.cover}
              kicker={notebookT("owner_kicker")}
              owner={user?.displayName ?? null}
            />
          }
          block={<NotebookContentsPage contents={contents} />}
        />
      </div>
    </div>
  );
}
