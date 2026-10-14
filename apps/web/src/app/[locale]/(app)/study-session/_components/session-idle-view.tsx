"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { StudyRoomTheme } from "@mentor/types";
import { ROOM_CURTAIN_MS } from "@/lib/study-room-theme";

const noopSubscribe = () => () => {};

/**
 * The panel's frame without its 72rem cap: the rail belongs at the scene's right edge, not
 * wherever a centred 1152px box happens to end. A size container, so the grid below can ask how
 * wide the frame is (the app sidebar is 240 or 52px, a viewport breakpoint cannot know which).
 */
export const SESSION_MAIN_CLASS = "@container w-full px-5 py-4 sm:px-8 lg:px-10 lg:py-8";

/**
 * Below `xl` everything stacks. From `xl` the centre column (top bar + timer, one axis) sits
 * beside the 340px rail. Once the frame holds a rail's width on both sides (78rem), an empty
 * mirror column puts that axis on the screen's centre line, with the rail at the right edge.
 */
export const SESSION_GRID_CLASS =
  "grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start @min-[78rem]:grid-cols-[340px_minmax(0,1fr)_340px]";
export const SESSION_CENTER_CLASS = "flex min-w-0 flex-col gap-5 @min-[78rem]:col-start-2";
export const SESSION_RAIL_CLASS =
  "grid min-w-0 gap-5 md:grid-cols-2 md:items-start xl:grid-cols-1 @min-[78rem]:col-start-3";

/**
 * Start steps the setup back, each part its own way (top bar up, timer down, rail aside), and
 * the end of a session brings it back the same way. 200ms: the lights take 500 and lead.
 * The shell's `AnimatePresence initial={false}` keeps the first paint still.
 */
function recede(reduceMotion: boolean | null, offset: { x?: number; y?: number }) {
  if (reduceMotion) return {};
  const transition = { duration: 0.2, ease: "easeOut" as const };
  const away = { opacity: 0, ...offset, transition };
  return { initial: away, animate: { opacity: 1, x: 0, y: 0, transition }, exit: away };
}

/**
 * The idle /seans screen: top bar and timer on one centre axis, the day beside them in a 340px
 * rail from `xl` (see `SESSION_GRID_CLASS`). Below that the rail's cards follow the timer, two
 * abreast from `md`. It replaced a four-column layout (nav, history rail, timer, card rail) that
 * left the timer ~190px wide at 1024.
 *
 * One page scroll. The scene is `SessionStage`'s, fixed behind it, so the room stays put while
 * the day's cards slide past.
 */
export function SessionIdleView({
  groundTheme,
  curtain,
  onCurtainDone,
  topBar,
  timer,
  rail,
  drawer,
}: {
  groundTheme: StudyRoomTheme | null;
  /** Arriving from "Bu masada çalışmaya başla": the lights come back up. */
  curtain: boolean;
  onCurtainDone: () => void;
  topBar: ReactNode;
  timer: ReactNode;
  rail: ReactNode;
  drawer: ReactNode;
}) {
  const t = useTranslations("session");
  const reduceMotion = useReducedMotion();
  // The curtain portals to `body`; false on the server and during hydration, true after.
  const onClient = useSyncExternalStore(noopSubscribe, () => true, () => false);

  return (
    <main
      className={`relative isolate w-full${groundTheme ? " room-stage" : ""}`}
      data-room-theme={groundTheme ?? undefined}
      aria-label={t("title")}
    >
      <h1 className="sr-only">{t("title")}</h1>
      {/* Portalled: inside this `isolate` main (and the stage) its z-50 would sit under the app
          chrome, and the sidebar would pop out of the black before the room does. */}
      {curtain && !reduceMotion && onClient
        ? createPortal(
            <motion.div
              aria-hidden
              className="pointer-events-none fixed inset-0 z-50"
              style={{ backgroundColor: "#000" }}
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: ROOM_CURTAIN_MS / 1000, ease: "easeOut" }}
              onAnimationComplete={onCurtainDone}
            />,
            document.body,
          )
        : null}

      <div className={SESSION_MAIN_CLASS}>
        <div className={SESSION_GRID_CLASS}>
          <div className={SESSION_CENTER_CLASS}>
            <motion.div className="flex justify-center" {...recede(reduceMotion, { y: -8 })}>
              {topBar}
            </motion.div>
            <motion.section
              aria-label={t("timer_label")}
              className="mx-auto flex w-full max-w-md flex-col items-center gap-5 xl:pt-2"
              {...recede(reduceMotion, { y: 8 })}
            >
              {timer}
            </motion.section>
          </div>
          <motion.div className={SESSION_RAIL_CLASS} {...recede(reduceMotion, { x: 24 })}>
            {rail}
          </motion.div>
        </div>
      </div>
      {drawer}
    </main>
  );
}
