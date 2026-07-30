"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { WeeklyRecapHighlightDto, WeeklyReviewDto } from "@mentor/types";
import { AnimatePresence, motion } from "framer-motion";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.mjs";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right.mjs";
import Pause from "lucide-react/dist/esm/icons/pause.mjs";
import Play from "lucide-react/dist/esm/icons/play.mjs";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw.mjs";
import Volume2 from "lucide-react/dist/esm/icons/volume-2.mjs";
import VolumeX from "lucide-react/dist/esm/icons/volume-x.mjs";
import X from "lucide-react/dist/esm/icons/x.mjs";
import { PuhuImage } from "@/components/puhu-image";
import {
  buildWeeklyRecapShareCardModel,
  getFocusStoryMode,
  getPerformanceStoryMode,
  getWeeklyRecapFocusTimeMessage,
  getWeeklyRecapPeakDayStory,
  getWeeklyRecapTextBeat,
  getWeeklyRecapWeekMapPhase,
  getWeeklyBestStorySource,
  shouldNavigateAfterWeeklyRecapPress,
  WEEKLY_RECAP_FIGMA_ASSETS,
  WEEKLY_RECAP_VIDEO_ASSETS,
  type WeeklyRecapCharacterVideo,
  type WeeklyRecapSlide,
  type WeeklyRecapSlideKind,
} from "@/lib/weekly-recap";
import { buildWeeklyRecapShareCardRows } from "@/lib/weekly-recap-share-card";
import { useWeeklyRecapAudio } from "./use-weekly-recap-audio";
import { useWeeklyRecapPlayback } from "./use-weekly-recap-playback";

const SWIPE_THRESHOLD_PX = 56;

export type RecapTranslate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

interface WeeklyRecapStoryProps {
  slides: readonly WeeklyRecapSlide[];
  review: WeeklyReviewDto;
  locale: string;
  reducedMotion: boolean;
  t: RecapTranslate;
  finalDock: React.ReactNode;
  onExit: () => void;
  onSlideView: (slide: WeeklyRecapSlide, index: number) => void;
  onComplete: () => void;
}

const STORY_COLORS: Record<WeeklyRecapSlideKind, string> = {
  welcome: "var(--recap-coral)",
  week_map: "var(--recap-sky)",
  focus: "var(--recap-coral)",
  weekly_run: "var(--recap-lavender)",
  weekly_best: "var(--recap-lavender)",
  performance: "var(--recap-mint)",
  spark: "var(--recap-mint)",
  weekly_title: "var(--recap-ink)",
  partial_unlocks: "var(--recap-coral)",
  partial_final: "var(--recap-ink)",
  final: "var(--recap-ink)",
};

const STORY_ASSET_DRIFT: Record<
  keyof typeof WEEKLY_RECAP_FIGMA_ASSETS,
  { x: number; y: number; rotate: number; duration: number }
> = {
  floral: { x: 10, y: -14, rotate: 3, duration: 8.4 },
  graphics: { x: -12, y: 10, rotate: -4, duration: 7.8 },
  greenShape: { x: 14, y: 8, rotate: 3, duration: 9.2 },
  greenWiggle: { x: -8, y: -16, rotate: -2, duration: 8.8 },
  lavenderPixel: { x: 12, y: -8, rotate: 2, duration: 7.6 },
  lavenderShape: { x: -10, y: 14, rotate: -3, duration: 9.4 },
  redPixel: { x: 8, y: 12, rotate: 2, duration: 8.2 },
  silverWiggle: { x: -14, y: 10, rotate: -2, duration: 10 },
  worldMap: { x: 8, y: -10, rotate: 2, duration: 9.6 },
};

export function WeeklyRecapStory({
  slides,
  review,
  locale,
  reducedMotion,
  t,
  finalDock,
  onExit,
  onSlideView,
  onComplete,
}: WeeklyRecapStoryProps) {
  const playback = useWeeklyRecapPlayback(slides, reducedMotion);
  const currentSlide = slides[playback.state.index] ?? slides[0];
  const viewedRef = useRef("");
  const completedRef = useRef(false);
  const audio = useWeeklyRecapAudio({
    audioSrc: currentSlide?.audioSrc ?? null,
    audioStartSeconds: currentSlide?.audioStartSeconds ?? 0,
    audioKey: `${playback.state.index}:${currentSlide?.kind ?? "none"}`,
    shouldPlay:
      playback.state.playing && playback.pageVisible && !playback.held,
  });
  const { goBack, goForward, setHeld, togglePlaying } = playback;

  useEffect(() => {
    if (!currentSlide) return;
    const key = `${playback.state.index}:${currentSlide.kind}`;
    if (viewedRef.current === key) return;
    viewedRef.current = key;
    onSlideView(currentSlide, playback.state.index);
  }, [currentSlide, onSlideView, playback.state.index]);

  useEffect(() => {
    if (!playback.state.completed || completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete, playback.state.completed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goBack();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goForward();
      } else if (event.key === "Escape") {
        event.preventDefault();
        onExit();
      } else if (event.key === " ") {
        event.preventDefault();
        togglePlaying();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goBack, goForward, onExit, togglePlaying]);

  const handleDragEnd = useCallback(
    (
      _: MouseEvent | TouchEvent | PointerEvent,
      info: { offset: { x: number } },
    ) => {
      setHeld(false);
      if (info.offset.x <= -SWIPE_THRESHOLD_PX) goForward();
      if (info.offset.x >= SWIPE_THRESHOLD_PX) goBack();
    },
    [goBack, goForward, setHeld],
  );

  if (!currentSlide) return null;

  const isFirst = playback.state.index === 0;
  const isLast = playback.state.index === slides.length - 1;
  const finalActionsVisible =
    currentSlide.kind === "final" &&
    getWeeklyRecapTextBeat(
      playback.state.elapsedMs,
      currentSlide.durationMs,
    ) === "support";

  return (
    <div
      className="weekly-recap-theme fixed inset-0 z-[70] grid min-h-dvh overflow-hidden md:place-items-center md:p-4"
      style={{ background: STORY_COLORS[currentSlide.kind] }}
      data-testid="weekly-recap-story"
      data-reduced-motion={reducedMotion ? "true" : "false"}
    >
      <div className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block">
        <Image
          src={WEEKLY_RECAP_FIGMA_ASSETS.floral}
          alt=""
          width={704}
          height={704}
          className="absolute -left-36 -top-36 w-[42vw] max-w-[680px] opacity-20 blur-sm"
          aria-hidden
        />
        <Image
          src={WEEKLY_RECAP_FIGMA_ASSETS.silverWiggle}
          alt=""
          width={959}
          height={1184}
          className="absolute -bottom-80 -right-52 w-[52vw] max-w-[800px] rotate-12 opacity-15 blur-[2px]"
          aria-hidden
        />
      </div>

      <button
        type="button"
        onClick={goBack}
        disabled={isFirst}
        aria-label={t("previous")}
        className="absolute left-[calc(50%_-_min(27dvh,240px)_-_64px)] z-40 hidden size-12 items-center justify-center rounded-full bg-black/55 text-white shadow-[var(--shadow-card)] backdrop-blur-md transition-opacity hover:bg-black/70 disabled:opacity-25 md:flex"
      >
        <ArrowLeft className="size-5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={goForward}
        disabled={isLast}
        aria-label={t("next")}
        className="absolute right-[calc(50%_-_min(27dvh,240px)_-_64px)] z-40 hidden size-12 items-center justify-center rounded-full bg-black/55 text-white shadow-[var(--shadow-card)] backdrop-blur-md transition-opacity hover:bg-black/70 disabled:opacity-25 md:flex"
      >
        <ArrowRight className="size-5" aria-hidden />
      </button>

      <div className="relative h-dvh w-dvw overflow-hidden bg-black shadow-2xl md:h-[calc(100dvh-2rem)] md:w-auto md:aspect-[9/16] md:rounded-[var(--radius-card)]">
        <StoryProgress
          slides={slides}
          activeIndex={playback.state.index}
          activeProgress={playback.progress}
          label={t("progress", {
            current: playback.state.index + 1,
            total: slides.length,
          })}
        />

        <div className="absolute right-[max(12px,env(safe-area-inset-right))] top-[max(24px,calc(env(safe-area-inset-top)+20px))] z-50 flex items-center gap-1.5">
          <StoryControl
            label={
              playback.state.completed
                ? t("controls.replay")
                : playback.state.playing
                  ? t("controls.pause")
                  : t("controls.play")
            }
            onClick={togglePlaying}
          >
            {playback.state.completed ? (
              <RotateCcw className="size-5" aria-hidden />
            ) : playback.state.playing ? (
              <Pause className="size-5" aria-hidden />
            ) : (
              <Play className="size-5" aria-hidden />
            )}
          </StoryControl>
          <StoryControl
            label={
              audio.available
                ? audio.muted
                  ? t("controls.sound_on")
                  : t("controls.sound_off")
                : t("controls.silent")
            }
            onClick={audio.toggleMuted}
            disabled={!audio.available}
          >
            {audio.available && !audio.muted ? (
              <Volume2 className="size-5" aria-hidden />
            ) : (
              <VolumeX className="size-5" aria-hidden />
            )}
          </StoryControl>
          <StoryControl label={t("exit")} onClick={onExit}>
            <X className="size-5" aria-hidden />
          </StoryControl>
        </div>

        <AnimatePresence initial={false} mode="wait">
          <motion.section
            key={`${currentSlide.kind}-${playback.state.index}`}
            role="region"
            aria-live="polite"
            data-testid="weekly-recap-slide"
            data-slide-kind={currentSlide.kind}
            drag={slides.length > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.08}
            onDragStart={() => setHeld(true)}
            onDragEnd={handleDragEnd}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
            transition={{ duration: reducedMotion ? 0.12 : 0.42 }}
            className="absolute inset-0 cursor-grab touch-pan-y overflow-hidden active:cursor-grabbing"
            style={{ background: STORY_COLORS[currentSlide.kind] }}
          >
            {currentSlide.characterVideo ? (
              <WeeklyRecapCharacterVideo
                video={currentSlide.characterVideo}
                elapsedMs={playback.state.elapsedMs}
                playing={
                  playback.state.playing &&
                  playback.pageVisible &&
                  !playback.held
                }
                reducedMotion={reducedMotion}
              />
            ) : currentSlide.kind === "week_map" ? null : (
              <StoryDecor
                kind={currentSlide.kind}
                reducedMotion={reducedMotion}
              />
            )}
            <StoryContent
              slide={currentSlide}
              review={review}
              locale={locale}
              elapsedMs={playback.state.elapsedMs}
              mediaPlaying={
                playback.state.playing && playback.pageVisible && !playback.held
              }
              reducedMotion={reducedMotion}
              t={t}
            />

            <StoryTapZone
              side="left"
              label={t("previous")}
              disabled={isFirst}
              onNavigate={goBack}
              onHeldChange={setHeld}
            />
            <StoryTapZone
              side="right"
              label={t("next")}
              disabled={isLast}
              onNavigate={goForward}
              onHeldChange={setHeld}
            />
          </motion.section>
        </AnimatePresence>

        {currentSlide.kind === "final" ? (
          <motion.div
            className="absolute inset-x-0 bottom-[max(12px,env(safe-area-inset-bottom))] z-50 px-4"
            initial={false}
            animate={
              finalActionsVisible
                ? { opacity: 1, y: 0 }
                : { opacity: 0, y: reducedMotion ? 0 : 16 }
            }
            transition={{ duration: reducedMotion ? 0.12 : 0.4 }}
            aria-hidden={!finalActionsVisible}
            style={{
              pointerEvents: finalActionsVisible ? "auto" : "none",
            }}
          >
            {finalDock}
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}

function StoryProgress({
  slides,
  activeIndex,
  activeProgress,
  label,
}: {
  slides: readonly WeeklyRecapSlide[];
  activeIndex: number;
  activeProgress: number;
  label: string;
}) {
  return (
    <div
      className="absolute inset-x-0 top-[max(8px,env(safe-area-inset-top))] z-50 flex gap-1 px-3"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={slides.length}
      aria-valuenow={activeIndex + 1}
      aria-label={label}
    >
      {slides.map((slide, index) => {
        const ratio =
          index < activeIndex ? 1 : index === activeIndex ? activeProgress : 0;
        return (
          <span
            key={`${slide.kind}-${index}`}
            className="h-1 flex-1 overflow-hidden rounded-full bg-white/35"
            aria-hidden
          >
            <span
              className="block h-full origin-left rounded-full bg-white transition-transform duration-75 ease-linear motion-reduce:transition-none"
              style={{ transform: `scaleX(${ratio})` }}
            />
          </span>
        );
      })}
    </div>
  );
}

function StoryControl({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex size-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}

function StoryTapZone({
  side,
  label,
  disabled,
  onNavigate,
  onHeldChange,
}: {
  side: "left" | "right";
  label: string;
  disabled: boolean;
  onNavigate: () => void;
  onHeldChange: (held: boolean) => void;
}) {
  const pressStartedAtRef = useRef<number | null>(null);
  const pressDurationRef = useRef<number | null>(null);

  const releaseHold = (timeStamp: number) => {
    if (pressStartedAtRef.current !== null) {
      pressDurationRef.current = timeStamp - pressStartedAtRef.current;
    }
    pressStartedAtRef.current = null;
    onHeldChange(false);
  };

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        const duration = pressDurationRef.current;
        pressDurationRef.current = null;
        if (
          duration === null ||
          shouldNavigateAfterWeeklyRecapPress(duration)
        ) {
          onNavigate();
        }
      }}
      onPointerDown={(event) => {
        pressStartedAtRef.current = event.timeStamp;
        onHeldChange(true);
      }}
      onPointerUp={(event) => releaseHold(event.timeStamp)}
      onPointerCancel={() => {
        pressStartedAtRef.current = null;
        pressDurationRef.current = null;
        onHeldChange(false);
      }}
      onPointerLeave={(event) => {
        if (pressStartedAtRef.current !== null) {
          releaseHold(event.timeStamp);
        }
      }}
      className={`absolute inset-y-0 z-20 w-1/2 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80 ${
        side === "left" ? "left-0" : "right-0"
      } disabled:pointer-events-none`}
    />
  );
}

function StoryContent({
  slide,
  review,
  locale,
  elapsedMs,
  mediaPlaying,
  reducedMotion,
  t,
}: {
  slide: WeeklyRecapSlide;
  review: WeeklyReviewDto;
  locale: string;
  elapsedMs: number;
  mediaPlaying: boolean;
  reducedMotion: boolean;
  t: RecapTranslate;
}) {
  const period = {
    startDate: formatRecapDate(review.period.startDate, locale),
    endDate: formatRecapDate(review.period.endDate, locale),
  };
  const beat = getWeeklyRecapTextBeat(elapsedMs, slide.durationMs);

  switch (slide.kind) {
    case "welcome": {
      const secondBeat = elapsedMs >= 4_000;
      return (
        <StoryCenter>
          <AnimatePresence mode="wait">
            {!secondBeat ? (
              <motion.div
                key="welcome"
                className="flex flex-col items-center"
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -80 }}
                transition={{ duration: reducedMotion ? 0.12 : 0.52 }}
              >
                <motion.div
                  animate={
                    reducedMotion
                      ? undefined
                      : { y: [0, -7, 0], rotate: [0, -0.8, 0] }
                  }
                  transition={
                    reducedMotion
                      ? undefined
                      : {
                          duration: 3.8,
                          repeat: Number.POSITIVE_INFINITY,
                          ease: "easeInOut",
                        }
                  }
                >
                  <PuhuImage
                    variant="host"
                    size={260}
                    priority
                    className="drop-shadow-2xl"
                  />
                </motion.div>
                <h1 className="mt-7 max-w-sm text-balance text-center text-4xl font-black leading-[0.98] tracking-[-0.04em] text-black">
                  {t("welcome.title")}
                </h1>
                <p className="mt-4 text-center text-sm font-bold text-black/70">
                  {t("cover.period", period)}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="next"
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 48 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reducedMotion ? 0.12 : 0.52 }}
              >
                <h2 className="max-w-sm text-balance text-center text-5xl font-black leading-[0.96] tracking-[-0.05em] text-black">
                  {t("welcome.next")}
                </h2>
              </motion.div>
            )}
          </AnimatePresence>
        </StoryCenter>
      );
    }
    case "week_map":
      return (
        <WeekMapStory
          review={review}
          locale={locale}
          elapsedMs={elapsedMs}
          mediaPlaying={mediaPlaying}
          reducedMotion={reducedMotion}
          t={t}
        />
      );
    case "focus": {
      const mode = getFocusStoryMode(review);
      const focusTimeMessage = getWeeklyRecapFocusTimeMessage(review);
      return (
        <StoryCenter align="top">
          <StoryTextBeat
            beat={beat}
            reducedMotion={reducedMotion}
            headline={
              mode === "data" ? (
                <>
                  <h2 className="max-w-sm text-balance text-center text-4xl font-black leading-[0.98] tracking-[-0.04em] text-black">
                    {t("focus.title")}
                  </h2>
                  <p className="mt-7 text-8xl font-black leading-none tracking-[-0.06em] tabular-nums text-black">
                    {review.rhythm.focusMinutes}
                  </p>
                  <p className="mt-2 text-2xl font-black text-black">
                    {t("focus.minutes")}
                  </p>
                </>
              ) : (
                <h2 className="max-w-sm text-balance text-center text-4xl font-black leading-[0.98] tracking-[-0.04em] text-black">
                  {t("focus.teaser_title")}
                </h2>
              )
            }
            support={
              <>
                <p className="max-w-sm text-balance text-center text-2xl font-black leading-8 text-black/75">
                  {mode === "data"
                    ? t("focus.support", {
                        sessions: review.evidence.qualifyingSessionCount,
                        longest: review.rhythm.longestSessionMinutes,
                      })
                    : t("focus.teaser_message")}
                </p>
                {mode === "data" && focusTimeMessage ? (
                  <p className="mt-5 max-w-xs text-balance text-center text-lg font-black leading-6 text-black/60">
                    {focusTimeMessage}
                  </p>
                ) : null}
              </>
            }
          />
        </StoryCenter>
      );
    }
    case "weekly_run": {
      const hasRun = review.rhythm.longestActiveRun > 1;
      return (
        <StoryCenter>
          <StoryTextBeat
            beat={beat}
            reducedMotion={reducedMotion}
            headline={
              <>
                <p className="text-8xl font-black leading-none tracking-[-0.06em] tabular-nums text-black">
                  {hasRun
                    ? review.rhythm.longestActiveRun
                    : review.recap.activeDays}
                </p>
                <h2 className="mt-5 max-w-sm text-balance text-center text-4xl font-black leading-[0.98] tracking-[-0.04em] text-black">
                  {t(
                    hasRun
                      ? "weekly_run.title"
                      : "weekly_run.active_days_title",
                    {
                      count: hasRun
                        ? review.rhythm.longestActiveRun
                        : review.recap.activeDays,
                    },
                  )}
                </h2>
              </>
            }
            support={
              <p className="max-w-sm text-balance text-center text-2xl font-black leading-8 text-black/70">
                {review.rhythm.message}
              </p>
            }
          />
        </StoryCenter>
      );
    }
    case "weekly_best":
      return (
        <StoryCenter>
          <WeeklyBestContent
            review={review}
            locale={locale}
            beat={beat}
            reducedMotion={reducedMotion}
            t={t}
          />
        </StoryCenter>
      );
    case "performance": {
      const mode = getPerformanceStoryMode(review);
      return (
        <StoryCenter>
          <StoryTextBeat
            beat={beat}
            reducedMotion={reducedMotion}
            headline={
              mode === "data" ? (
                <>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-black/55">
                    {t("performance.eyebrow")}
                  </p>
                  <h2 className="mt-5 max-w-sm text-balance text-center text-4xl font-black leading-[0.98] tracking-[-0.04em] text-black">
                    {t("performance.title")}
                  </h2>
                  <p className="mt-7 text-8xl font-black leading-none tracking-[-0.06em] tabular-nums text-black">
                    {review.performance?.averageNet}
                  </p>
                  <p className="mt-2 text-xl font-black text-black">
                    {t("performance.net")}
                  </p>
                </>
              ) : (
                <h2 className="max-w-sm text-balance text-center text-4xl font-black leading-[0.98] tracking-[-0.04em] text-black">
                  {t("performance.bridge_title")}
                </h2>
              )
            }
            support={
              <p className="max-w-sm text-balance text-center text-2xl font-black leading-8 text-black/70">
                {mode === "data"
                  ? review.performance?.message
                  : t("performance.bridge_message")}
              </p>
            }
          />
        </StoryCenter>
      );
    }
    case "weekly_title": {
      if (
        slide.characterVideo &&
        elapsedMs < slide.characterVideo.headlineAtMs
      ) {
        return null;
      }
      const weeklyTitleBeat =
        slide.characterVideo && elapsedMs >= slide.characterVideo.supportAtMs
          ? "support"
          : "headline";
      return (
        <StoryCenter>
          <div
            className={`w-full ${
              slide.characterVideo ? "-translate-y-[200px]" : ""
            }`}
          >
            <StoryTextBeat
              beat={weeklyTitleBeat}
              reducedMotion={reducedMotion}
              headline={
                <>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-white/65">
                    {t("weekly_title.label")}
                  </p>
                  <h2 className="mt-3 max-w-sm text-balance text-center text-4xl font-black leading-[0.98] tracking-[-0.04em] text-white">
                    {review.recap.weeklyTitle?.label ??
                      t("weekly_title.fallback")}
                  </h2>
                </>
              }
              support={
                <p className="max-w-sm text-balance text-center text-2xl font-black leading-8 text-white/85">
                  {review.recap.weeklyTitle?.message ??
                    review.recap.closingMessage}
                </p>
              }
            />
          </div>
        </StoryCenter>
      );
    }
    case "spark": {
      const highlight = review.highlights[0] ?? null;
      return (
        <StoryCenter>
          <StoryTextBeat
            beat={beat}
            reducedMotion={reducedMotion}
            headline={
              <>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-black/55">
                  {t("spark.label")}
                </p>
                <h2 className="mt-4 max-w-sm text-balance text-center text-4xl font-black leading-[0.98] tracking-[-0.04em] text-black">
                  {t("spark.title")}
                </h2>
              </>
            }
            support={
              <p className="max-w-sm text-balance text-center text-2xl font-black leading-8 text-black/75">
                {highlight?.message ?? review.recap.closingMessage}
              </p>
            }
          />
        </StoryCenter>
      );
    }
    case "partial_unlocks": {
      const signals =
        review.recap.nextStorySignals?.length > 0
          ? review.recap.nextStorySignals
          : review.recap.nextStorySignal
            ? [review.recap.nextStorySignal]
            : [];
      return (
        <StoryCenter>
          <StoryTextBeat
            beat={beat}
            reducedMotion={reducedMotion}
            headline={
              <div className="flex w-full max-w-sm flex-col items-start text-left">
                <span className="-rotate-2 bg-black px-4 py-2 text-sm font-black uppercase tracking-[0.14em] text-white">
                  {t("partial_unlocks.count", { count: signals.length })}
                </span>
                <h2 className="mt-5 max-w-sm text-balance text-left text-6xl font-black leading-[0.88] tracking-[-0.04em] text-black">
                  {t("partial_unlocks.title")}
                </h2>
              </div>
            }
            support={
              signals.length > 0 ? (
                <div className="w-[calc(100%+2rem)] max-w-[26rem]">
                  <p className="mb-3 inline-block bg-black px-3 py-2 text-sm font-black uppercase tracking-[0.12em] text-white">
                    {t("partial_unlocks.kicker")}
                  </p>
                  <ol className="grid gap-2">
                    {signals.map((signal, index) => {
                      const darkPanel = index % 3 === 2;
                      const panelColor =
                        index % 3 === 0
                          ? "bg-[var(--recap-lavender)]"
                          : index % 3 === 1
                            ? "bg-[var(--recap-mint)]"
                            : "bg-black";
                      return (
                        <motion.li
                          key={signal.kind}
                          className={`grid min-h-28 grid-cols-[5.25rem_1fr] overflow-hidden border-[3px] border-black ${panelColor} ${
                            darkPanel ? "text-white" : "text-black"
                          }`}
                          initial={
                            reducedMotion
                              ? { opacity: 0 }
                              : {
                                  opacity: 0,
                                  x: index % 2 === 0 ? -32 : 32,
                                  rotate: index % 2 === 0 ? -3 : 3,
                                }
                          }
                          animate={{
                            opacity: 1,
                            x: 0,
                            rotate: reducedMotion || index % 2 === 0 ? 0 : 0.6,
                          }}
                          transition={{
                            duration: reducedMotion ? 0.12 : 0.48,
                            delay: reducedMotion ? 0 : index * 0.08,
                          }}
                        >
                          <span
                            className={`grid place-items-center border-r-[3px] border-current text-5xl font-black leading-none tabular-nums ${
                              darkPanel ? "text-[var(--recap-coral)]" : ""
                            }`}
                            aria-hidden
                          >
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="flex flex-col justify-center px-4 py-3">
                            <strong className="block text-xl font-black leading-5">
                              {signal.title}
                            </strong>
                            <span
                              className={`mt-2 block text-sm font-bold leading-[1.35] ${
                                darkPanel ? "text-white/75" : "text-black/70"
                              }`}
                            >
                              {signal.message}
                            </span>
                          </span>
                        </motion.li>
                      );
                    })}
                  </ol>
                </div>
              ) : (
                <p className="max-w-sm text-balance text-center text-2xl font-black leading-8 text-black/70">
                  {review.recap.closingMessage}
                </p>
              )
            }
          />
        </StoryCenter>
      );
    }
    case "partial_final":
      return (
        <StoryCenter>
          <StoryTextBeat
            beat={beat}
            reducedMotion={reducedMotion}
            headline={
              <h2 className="max-w-sm text-balance text-center text-5xl font-black leading-[0.96] tracking-[-0.04em] text-white">
                {t("partial_final.title")}
              </h2>
            }
            support={
              <p className="max-w-sm text-balance text-center text-2xl font-black leading-8 text-white/80">
                {review.recap.closingMessage}
              </p>
            }
          />
        </StoryCenter>
      );
    case "final":
      return (
        <StoryCenter>
          <StoryTextBeat
            beat={beat}
            reducedMotion={reducedMotion}
            headline={
              <h2 className="max-w-sm text-balance text-center text-5xl font-black leading-[0.96] tracking-[-0.04em] text-white">
                {t("final.title")}
              </h2>
            }
            support={<WeeklyRecapShareCardPreview review={review} t={t} />}
          />
        </StoryCenter>
      );
  }
}

function WeeklyRecapShareCardPreview({
  review,
  t,
}: {
  review: WeeklyReviewDto;
  t: RecapTranslate;
}) {
  const model = buildWeeklyRecapShareCardModel(review);
  const rows = buildWeeklyRecapShareCardRows(model, {
    focus: t("share_card.focus"),
    activeDays: t("share_card.active_days"),
    sessions: t("share_card.sessions"),
    completedTasks: t("share_card.completed_tasks"),
    longestSession: t("share_card.longest_session"),
    longestRun: t("share_card.longest_run"),
    topSubject: t("share_card.top_subject"),
    minutes: (count) => t("share_card.minutes", { count }),
    days: (count) => t("share_card.days", { count }),
    count: (count) => t("share_card.count", { count }),
    subject: (name, minutes) => t("share_card.subject", { name, minutes }),
  });
  const subjectRow =
    rows.find((row) => row.label === t("share_card.top_subject")) ?? null;
  const metricRows = rows.filter((row) => row !== subjectRow);
  const leadRow = metricRows[0] ?? null;
  const statRows = metricRows.slice(1, 6);

  return (
    <div className="w-[calc(100%+3rem)] max-w-[370px] overflow-hidden rounded-[var(--radius-card)] bg-[var(--recap-coral)] text-left text-black">
      <div className="relative h-44 overflow-hidden bg-[var(--recap-ink)]">
        {model.characterImageSrc ? (
          <Image
            src={model.characterImageSrc}
            alt=""
            fill
            sizes="370px"
            className="object-cover object-center"
          />
        ) : (
          <div className="grid size-full place-items-center">
            <PuhuImage variant="proud" size={128} priority />
          </div>
        )}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10"
          aria-hidden
        />
        <div className="absolute inset-x-5 bottom-7 text-white">
          <p className="text-xs font-extrabold leading-4 text-white/70">
            {t("share_card.weekly_title_label")}
          </p>
          <p className="mt-1 text-balance text-[30px] font-black leading-[0.98] tracking-[-0.03em]">
            {model.weeklyTitle ?? t("share_card.weekly_title_fallback")}
          </p>
        </div>
      </div>

      <div className="px-6 pb-5 pt-4">
        <p className="max-w-64 text-balance text-xl font-black leading-[1.02] tracking-[-0.03em]">
          {t("share_card.title")}
        </p>

        {leadRow ? (
          <div className="mt-3 border-y-2 border-black/15 py-3">
            <p className="text-[40px] font-black leading-none tracking-[-0.04em] tabular-nums">
              {leadRow.value}
            </p>
            <p className="mt-1 text-sm font-extrabold leading-5 text-black/65">
              {leadRow.label}
            </p>
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3">
          {statRows.map((row) => (
            <div key={row.label}>
              <p className="text-[22px] font-black leading-none tracking-[-0.03em] tabular-nums">
                {row.value}
              </p>
              <p className="mt-1 text-[11px] font-extrabold leading-[1.15] text-black/60">
                {row.label}
              </p>
            </div>
          ))}
        </div>

        {subjectRow ? (
          <div className="mt-4 border-t-2 border-black pt-3">
            <p className="text-xs font-extrabold leading-4 text-black/60">
              {subjectRow.label}
            </p>
            <p className="mt-1 text-balance text-[22px] font-black leading-[1.05] tracking-[-0.025em]">
              {subjectRow.value}
            </p>
          </div>
        ) : null}

        <p className="mt-4 text-xs font-black tracking-[-0.01em]">
          {t("share_card.signature")}
        </p>
      </div>
    </div>
  );
}

function WeekMapStory({
  review,
  locale,
  elapsedMs,
  mediaPlaying,
  reducedMotion,
  t,
}: {
  review: WeeklyReviewDto;
  locale: string;
  elapsedMs: number;
  mediaPlaying: boolean;
  reducedMotion: boolean;
  t: RecapTranslate;
}) {
  const phase = getWeeklyRecapWeekMapPhase(elapsedMs);
  const activeDaysVisible = phase === "active_days";
  const peakDay = getWeeklyRecapPeakDayStory(review, locale);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <WeeklyRecapFireVideo elapsedMs={elapsedMs} playing={mediaPlaying} />
      </div>
      <div
        className="absolute inset-x-0 top-0 z-[1] h-72 bg-gradient-to-b from-black/75 via-black/30 to-transparent"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 bottom-0 z-[1] h-56 bg-gradient-to-t from-black/75 via-black/30 to-transparent"
        aria-hidden
      />
      <div className="absolute inset-0 z-[2]">
        <StoryDecor kind="week_map" reducedMotion={reducedMotion} />
      </div>

      <div className="relative z-10 flex h-full w-full flex-col items-center px-6 pb-12 pt-24">
        <div className="grid min-h-28 w-full place-items-center">
          <AnimatePresence mode="wait">
            {activeDaysVisible ? (
              <motion.div
                key="active-days"
                className="flex flex-col items-center"
                initial={
                  reducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: 30, scale: 0.86 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: reducedMotion ? 0.12 : 0.48 }}
              >
                <p className="text-7xl font-black leading-none tabular-nums text-white">
                  {review.recap.activeDays}
                </p>
                <p className="mt-1 text-xl font-black text-white">
                  {t("week_map.active_days")}
                </p>
              </motion.div>
            ) : (
              <motion.h2
                key="headline"
                className="max-w-sm text-balance text-center text-4xl font-black leading-[0.98] tracking-[-0.04em] text-white"
                initial={
                  reducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: 22, scale: 0.96 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={
                  reducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: -52, scale: 0.92 }
                }
                transition={{ duration: reducedMotion ? 0.12 : 0.48 }}
              >
                {t("week_map.title")}
              </motion.h2>
            )}
          </AnimatePresence>
        </div>

        {activeDaysVisible && peakDay ? (
          <motion.div
            className="mt-auto max-w-sm text-center text-white"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reducedMotion ? 0.12 : 0.42 }}
          >
            <p className="text-sm font-black uppercase tracking-[0.14em] text-white/75">
              {t("week_map.power_day", {
                day: peakDay.dayLabel,
                minutes: peakDay.focusMinutes,
              })}
            </p>
            <p className="mt-1 text-sm font-bold text-white/90">
              {peakDay.message}
            </p>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}

function WeeklyRecapFireVideo({
  elapsedMs,
  playing,
}: {
  elapsedMs: number;
  playing: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [failed, setFailed] = useState(false);
  const shouldPlay = playing && elapsedMs < 4_000;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || failed) return;
    const expectedTime = Math.min(elapsedMs / 1_000, 4);
    if (Math.abs(video.currentTime - expectedTime) > 0.25) {
      video.currentTime = expectedTime;
    }
  }, [elapsedMs, failed]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || failed) return;
    if (shouldPlay) {
      void video.play().catch(() => {
        // The story timer remains authoritative if media playback is declined.
      });
    } else {
      video.pause();
    }
  }, [failed, shouldPlay]);

  if (failed) {
    return (
      <div className="grid size-full place-items-center bg-[var(--recap-sky)]">
        <PuhuImage variant="proud" size={180} priority />
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={WEEKLY_RECAP_VIDEO_ASSETS.puhuFire}
      muted
      playsInline
      preload="auto"
      aria-hidden
      onError={() => setFailed(true)}
      className="size-full object-cover object-center"
    />
  );
}

function WeeklyRecapCharacterVideo({
  video,
  elapsedMs,
  playing,
  reducedMotion,
}: {
  video: WeeklyRecapCharacterVideo;
  elapsedMs: number;
  playing: boolean;
  reducedMotion: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const shouldPlay =
    playing && (durationSeconds == null || elapsedMs < durationSeconds * 1_000);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || failed || element.readyState === 0) return;
    const upperBound =
      durationSeconds == null
        ? elapsedMs / 1_000
        : Math.max(0, durationSeconds - 0.05);
    const expectedTime = Math.min(elapsedMs / 1_000, upperBound);
    if (Math.abs(element.currentTime - expectedTime) > 0.25) {
      element.currentTime = expectedTime;
    }
  }, [durationSeconds, elapsedMs, failed]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || failed) return;
    if (shouldPlay) {
      void element.play().catch(() => {
        // Story playback stays authoritative when the browser declines media playback.
      });
    } else {
      element.pause();
    }
  }, [failed, shouldPlay]);

  if (failed) {
    return <StoryDecor kind="weekly_title" reducedMotion={reducedMotion} />;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <video
        ref={videoRef}
        src={video.src}
        poster={video.posterSrc}
        muted
        playsInline
        preload="auto"
        aria-hidden
        onLoadedMetadata={(event) => {
          const nextDuration = event.currentTarget.duration;
          if (Number.isFinite(nextDuration) && nextDuration > 0) {
            setDurationSeconds(nextDuration);
          }
        }}
        onError={() => setFailed(true)}
        className="size-full object-cover object-center"
      />
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/45"
        aria-hidden
      />
    </div>
  );
}

function WeeklyBestContent({
  review,
  locale,
  beat,
  reducedMotion,
  t,
}: {
  review: WeeklyReviewDto;
  locale: string;
  beat: "headline" | "support";
  reducedMotion: boolean;
  t: RecapTranslate;
}) {
  const source = getWeeklyBestStorySource(review);
  const focusSubject = review.rhythm.subjectBreakdown[0] ?? null;
  const planSubject = review.plan.subjectBreakdown[0] ?? null;
  const highlight = review.highlights[0] ?? null;

  const title =
    source === "focus_subject"
      ? focusSubject?.subjectName
      : source === "plan_subject"
        ? planSubject?.subjectName
        : highlight
          ? highlightDisplayValue(highlight, locale, t)
          : t("weekly_best.fallback");
  const message =
    source === "focus_subject"
      ? t("weekly_best.focus_subject", {
          minutes: focusSubject?.focusMinutes ?? 0,
        })
      : source === "plan_subject"
        ? t("weekly_best.plan_subject", {
            count: planSubject?.completedTaskCount ?? 0,
          })
        : (highlight?.message ?? t("weekly_best.fallback_message"));

  return (
    <StoryTextBeat
      beat={beat}
      reducedMotion={reducedMotion}
      headline={
        <>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-black/55">
            {t("weekly_best.eyebrow")}
          </p>
          <div className="mt-7 grid aspect-square w-64 place-items-center border-8 border-black bg-[var(--recap-coral)] px-5 text-center shadow-[12px_12px_0_var(--recap-mint)]">
            <span className="text-balance text-4xl font-black leading-[0.95] tracking-[-0.05em] text-black">
              {title}
            </span>
          </div>
        </>
      }
      support={
        <>
          <h2 className="max-w-sm text-balance text-center text-4xl font-black leading-[1.02] tracking-[-0.04em] text-black">
            {t("weekly_best.title")}
          </h2>
          <p className="mt-6 max-w-sm text-balance text-center text-xl font-black leading-8 text-black/70">
            {message}
          </p>
        </>
      }
    />
  );
}

function StoryTextBeat({
  beat,
  reducedMotion,
  headline,
  support,
}: {
  beat: "headline" | "support";
  reducedMotion: boolean;
  headline: React.ReactNode;
  support: React.ReactNode;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={beat}
        className="flex w-full flex-col items-center"
        initial={
          reducedMotion
            ? { opacity: 0 }
            : {
                opacity: 0,
                y: beat === "headline" ? 24 : 48,
                scale: beat === "headline" ? 0.96 : 1,
              }
        }
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={
          reducedMotion
            ? { opacity: 0 }
            : {
                opacity: 0,
                y: -56,
                scale: 0.94,
              }
        }
        transition={{ duration: reducedMotion ? 0.12 : 0.48 }}
      >
        {beat === "headline" ? headline : support}
      </motion.div>
    </AnimatePresence>
  );
}

function StoryCenter({
  align = "center",
  children,
}: {
  align?: "center" | "top";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`pointer-events-none relative z-10 flex h-full w-full flex-col items-center px-8 pb-36 pt-28 ${
        align === "top" ? "justify-start pt-40" : "justify-center"
      }`}
    >
      {children}
    </div>
  );
}

function StoryDecor({
  kind,
  reducedMotion,
}: {
  kind: WeeklyRecapSlideKind;
  reducedMotion: boolean;
}) {
  switch (kind) {
    case "welcome":
      return (
        <>
          <DecorAsset
            src="floral"
            className="-left-[22%] -top-[8%] w-[74%] aspect-square"
            reducedMotion={reducedMotion}
          />
          <DecorAsset
            src="lavenderShape"
            className="-right-[18%] -top-[2%] w-[58%] aspect-square rotate-90"
            delay={0.08}
            reducedMotion={reducedMotion}
          />
          <DecorAsset
            src="silverWiggle"
            className="-bottom-[24%] -left-[42%] h-[72%] w-[92%] rotate-[30deg]"
            delay={0.16}
            reducedMotion={reducedMotion}
          />
          <DecorAsset
            src="redPixel"
            className="-bottom-[5%] -right-[12%] w-[58%] aspect-square"
            delay={0.24}
            reducedMotion={reducedMotion}
          />
        </>
      );
    case "week_map":
      return (
        <>
          <DecorAsset
            src="greenShape"
            className="-bottom-[12%] -left-[18%] w-[44%] aspect-square"
            delay={0.18}
            reducedMotion={reducedMotion}
          />
          <DecorAsset
            src="floral"
            className="-bottom-[12%] -right-[18%] w-[42%] aspect-square"
            delay={0.24}
            reducedMotion={reducedMotion}
          />
        </>
      );
    case "focus":
      return (
        <>
          <DecorAsset
            src="greenShape"
            className="-bottom-[12%] -left-[24%] w-[62%] aspect-square"
            reducedMotion={reducedMotion}
          />
          <DecorAsset
            src="greenWiggle"
            className="-bottom-[18%] -right-[15%] h-[54%] w-[52%] rotate-180"
            delay={0.18}
            reducedMotion={reducedMotion}
          />
          <DecorAsset
            src="worldMap"
            className="bottom-[7%] left-1/2 size-[64%] -translate-x-1/2 opacity-85"
            delay={0.24}
            reducedMotion={reducedMotion}
          />
        </>
      );
    case "weekly_run":
      return (
        <>
          <DecorAsset
            src="lavenderShape"
            className="-left-[9%] -top-[7%] w-[48%] aspect-square"
            reducedMotion={reducedMotion}
          />
          <DecorAsset
            src="floral"
            className="-right-[18%] -top-[8%] w-[58%] aspect-square"
            delay={0.08}
            reducedMotion={reducedMotion}
          />
          <DecorAsset
            src="silverWiggle"
            className="-bottom-[34%] -left-[48%] h-[72%] w-[98%] rotate-[52deg]"
            delay={0.16}
            reducedMotion={reducedMotion}
          />
          <DecorAsset
            src="lavenderPixel"
            className="-bottom-[2%] right-[-24%] h-[32%] w-[72%] -rotate-12"
            delay={0.22}
            reducedMotion={reducedMotion}
          />
        </>
      );
    case "weekly_best":
      return (
        <>
          <DecorAsset
            src="greenShape"
            className="-left-[14%] -top-[8%] w-[58%] aspect-square"
            reducedMotion={reducedMotion}
          />
          <DecorAsset
            src="silverWiggle"
            className="-right-[50%] -top-[32%] h-[76%] w-[105%] rotate-[145deg]"
            delay={0.08}
            reducedMotion={reducedMotion}
          />
          <DecorAsset
            src="graphics"
            className="-bottom-[5%] -left-[20%] w-[54%] aspect-square"
            delay={0.16}
            reducedMotion={reducedMotion}
          />
          <DecorAsset
            src="lavenderShape"
            className="-bottom-[12%] -right-[12%] w-[44%] aspect-square rotate-180"
            delay={0.22}
            reducedMotion={reducedMotion}
          />
        </>
      );
    case "performance":
    case "spark":
      return (
        <>
          <DecorAsset
            src="greenWiggle"
            className="-left-[18%] -top-[18%] h-[50%] w-[48%] rotate-180"
            reducedMotion={reducedMotion}
          />
          <DecorAsset
            src="greenShape"
            className="-right-[22%] -top-[12%] w-[62%] aspect-square -rotate-[22deg]"
            delay={0.08}
            reducedMotion={reducedMotion}
          />
          <DecorAsset
            src="floral"
            className="-bottom-[2%] -left-[26%] w-[60%] aspect-square"
            delay={0.16}
            reducedMotion={reducedMotion}
          />
          <DecorAsset
            src="graphics"
            className="-bottom-[10%] -right-[22%] w-[58%] aspect-square -rotate-[110deg]"
            delay={0.24}
            reducedMotion={reducedMotion}
          />
        </>
      );
    case "weekly_title":
      return (
        <>
          <DecorAsset
            src="silverWiggle"
            className="-left-[42%] -top-[20%] h-[64%] w-[92%] rotate-[32deg]"
            reducedMotion={reducedMotion}
          />
          <DecorAsset
            src="greenWiggle"
            className="-right-[4%] -top-[10%] h-[44%] w-[42%] rotate-180"
            delay={0.08}
            reducedMotion={reducedMotion}
          />
          <DecorAsset
            src="redPixel"
            className="-right-[2%] top-[2%] w-[32%] aspect-square"
            delay={0.13}
            reducedMotion={reducedMotion}
          />
          <DecorAsset
            src="graphics"
            className="-bottom-[10%] -left-[20%] w-[50%] aspect-square"
            delay={0.18}
            reducedMotion={reducedMotion}
          />
          <DecorAsset
            src="floral"
            className="-bottom-[8%] -right-[20%] w-[52%] aspect-square"
            delay={0.24}
            reducedMotion={reducedMotion}
          />
        </>
      );
    case "partial_unlocks":
    case "partial_final":
    case "final":
      return (
        <>
          <DecorAsset
            src="lavenderShape"
            className="-left-[22%] -top-[12%] w-[62%] aspect-square"
            reducedMotion={reducedMotion}
          />
          <DecorAsset
            src="silverWiggle"
            className="-right-[26%] -top-[18%] h-[48%] w-[62%] rotate-[40deg]"
            delay={0.08}
            reducedMotion={reducedMotion}
          />
          <DecorAsset
            src="greenWiggle"
            className="-bottom-[14%] -left-[24%] h-[42%] w-[52%] rotate-180"
            delay={0.16}
            reducedMotion={reducedMotion}
          />
          <DecorAsset
            src="floral"
            className="-bottom-[12%] -right-[22%] w-[54%] aspect-square"
            delay={0.24}
            reducedMotion={reducedMotion}
          />
        </>
      );
  }
}

function DecorAsset({
  src,
  className,
  delay = 0,
  reducedMotion,
}: {
  src: keyof typeof WEEKLY_RECAP_FIGMA_ASSETS;
  className: string;
  delay?: number;
  reducedMotion: boolean;
}) {
  const drift = STORY_ASSET_DRIFT[src];

  return (
    <div
      className={`pointer-events-none absolute z-0 ${className}`}
      aria-hidden
    >
      <motion.div
        className="relative size-full"
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
        animate={
          reducedMotion
            ? { opacity: 1 }
            : {
                opacity: 1,
                x: [0, drift.x, 0],
                y: [0, drift.y, 0],
                rotate: [0, drift.rotate, 0],
                scale: [1, 1.025, 1],
              }
        }
        transition={
          reducedMotion
            ? { duration: 0.12 }
            : {
                opacity: { duration: 0.5, delay },
                x: {
                  duration: drift.duration,
                  delay,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                },
                y: {
                  duration: drift.duration,
                  delay,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                },
                rotate: {
                  duration: drift.duration,
                  delay,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                },
                scale: {
                  duration: drift.duration,
                  delay,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                },
              }
        }
      >
        <Image
          src={WEEKLY_RECAP_FIGMA_ASSETS[src]}
          alt=""
          fill
          sizes="(min-width: 768px) 480px, 70vw"
          className="object-contain"
        />
      </motion.div>
    </div>
  );
}

function highlightDisplayValue(
  highlight: WeeklyRecapHighlightDto,
  locale: string,
  t: RecapTranslate,
): string {
  switch (highlight.kind) {
    case "POSITIVE_COMPARISON":
      return t(`bests.comparison_${highlight.metric}`, {
        count: highlight.delta,
      });
    case "LONGEST_SESSION":
      return t("bests.minutes", { count: highlight.minutes });
    case "TOP_FOCUS_SUBJECT":
    case "TOP_PLAN_SUBJECT":
      return highlight.subjectName;
    case "PEAK_FOCUS_DAY":
      return formatRecapLongWeekday(highlight.date, locale);
    case "COMPLETED_TASKS":
      return t("bests.tasks", { count: highlight.completedTaskCount });
    case "MOCK_EXAMS":
      return t("bests.exams", { count: highlight.mockExamCount });
  }
}

function formatRecapDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00.000Z`));
}

function formatRecapLongWeekday(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(
    new Date(`${date}T12:00:00.000Z`),
  );
}
