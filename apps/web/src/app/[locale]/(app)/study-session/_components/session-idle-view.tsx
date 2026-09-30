"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { StudyRoomTheme } from "@mentor/types";
import { PANEL_GRID_CLASS, PANEL_MAIN_CLASS } from "@/components/panel/panel-styles";
import { ROOM_CURTAIN_MS } from "@/lib/study-room-theme";

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
 * The idle /seans screen in the panel's frame: the timer in the main column and the day beside
 * it in a 340px rail from `xl`. Below that the rail's cards follow the timer, two abreast from
 * `md`. It replaced a four-column layout (nav, history rail, timer, card rail) that left the
 * timer ~190px wide at 1024.
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

  return (
    <main
      className={`relative isolate w-full${groundTheme ? " room-stage" : ""}`}
      data-room-theme={groundTheme ?? undefined}
      aria-label={t("title")}
    >
      <h1 className="sr-only">{t("title")}</h1>
      {curtain && !reduceMotion ? (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-50"
          style={{ backgroundColor: "#000" }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: ROOM_CURTAIN_MS / 1000, ease: "easeOut" }}
          onAnimationComplete={onCurtainDone}
        />
      ) : null}

      <div className={PANEL_MAIN_CLASS}>
        <motion.div className="flex justify-center" {...recede(reduceMotion, { y: -8 })}>
          {topBar}
        </motion.div>
        <div className={PANEL_GRID_CLASS}>
          <motion.section
            aria-label={t("timer_label")}
            className="mx-auto flex w-full max-w-md flex-col items-center gap-5 xl:pt-2"
            {...recede(reduceMotion, { y: 8 })}
          >
            {timer}
          </motion.section>
          <motion.div
            className="grid min-w-0 gap-5 md:grid-cols-2 md:items-start xl:grid-cols-1"
            {...recede(reduceMotion, { x: 24 })}
          >
            {rail}
          </motion.div>
        </div>
      </div>
      {drawer}
    </main>
  );
}
