import type { WeeklyReviewDto } from "@mentor/types";
import {
  buildWeeklyRecapShareCardFacts,
  composeWeeklyRecapStory,
  type WeeklyRecapCharacterKey,
  type WeeklyRecapSlideKind,
} from "@mentor/core";

/**
 * The web side of the weekly recap. The story itself (which slides, timing, playback rules) lives in
 * `@mentor/core` so web and mobile compose the same deck; this file maps its media keys to public
 * URLs and keeps the browser-only helpers (storage, routes, share text).
 */
export {
  advanceWeeklyRecapPlayback,
  createWeeklyRecapPlayback,
  getFocusStoryMode,
  getPerformanceStoryMode,
  getWeeklyBestStorySource,
  getWeeklyRecapFocusTimeMessage,
  getWeeklyRecapPeakDayStory,
  getWeeklyRecapTextBeat,
  getWeeklyRecapWeekMapPhase,
  navigateWeeklyRecapPlayback,
  replayWeeklyRecap,
  shouldNavigateAfterWeeklyRecapPress,
  shouldWeeklyRecapAdvance,
  type WeeklyRecapAdvanceConditions,
  type WeeklyRecapBestStorySource,
  type WeeklyRecapFocusStoryMode,
  type WeeklyRecapPerformanceStoryMode,
  type WeeklyRecapPlaybackState,
  type WeeklyRecapSlideKind,
  type WeeklyRecapTextBeat,
  type WeeklyRecapWeekMapPhase,
} from "@mentor/core";

export const WEEKLY_RECAP_FIGMA_ASSETS = {
  floral: "/visuals/weekly-recap-2023/floral.png",
  graphics: "/visuals/weekly-recap-2023/graphics.png",
  greenShape: "/visuals/weekly-recap-2023/green-shape.png",
  greenWiggle: "/visuals/weekly-recap-2023/green-wiggle.png",
  lavenderPixel: "/visuals/weekly-recap-2023/lavender-pixel.png",
  lavenderShape: "/visuals/weekly-recap-2023/lavender-shape.png",
  redPixel: "/visuals/weekly-recap-2023/red-pixel.png",
  silverWiggle: "/visuals/weekly-recap-2023/silver-wiggle.png",
  worldMap: "/visuals/weekly-recap-2023/world-map.png",
} as const;

export const WEEKLY_RECAP_VIDEO_ASSETS = {
  cosmicMaestro: "/video/character/cosmic-maestro.mp4",
  dimensionExplorer: "/video/character/dimension-explorer.mp4",
  nebulaDiver: "/video/character/nebula-diver.mp4",
  novaTraveler: "/video/character/nova-traveler.mp4",
  phoenixPilot: "/video/character/phoenix-pilot.mp4",
  puhuFire: "/video/puhu-fire.mp4",
  routeArchitect: "/video/character/route-architect.mp4",
  timeBender: "/video/character/time-bender.mp4",
} as const;

export const WEEKLY_RECAP_CHARACTER_IMAGE_ASSETS = {
  cosmicMaestro: "/img/character/cosmic-maestro.png",
  dimensionExplorer: "/img/character/dimension-explorer.png",
  nebulaDiver: "/img/character/nebula-diver.png",
  novaTraveler: "/img/character/nova-traveler.png",
  phoenixPilot: "/img/character/phoenix-pilot.png",
  routeArchitect: "/img/character/route-architect.png",
  timeBender: "/img/character/time-bender.png",
} as const satisfies Record<WeeklyRecapCharacterKey, string>;

export const WEEKLY_RECAP_AUDIO_ASSETS = {
  characterReveal: "/audio/mixkit-shot-light-energy-flowing-2589.wav",
  digitalClouds: "/audio/mixkit-digital-clouds-175.mp3",
  discover: "/audio/mixkit-discover-587.mp3",
  funkeeMonkeee: "/audio/mixkit-funkee-monkeee-1140.mp3",
  gimmeThatGroove: "/audio/mixkit-gimme-that-groove-872.mp3",
  popTrack03: "/audio/mixkit-pop-track-03-729.mp3",
} as const;

export interface WeeklyRecapSlide {
  kind: WeeklyRecapSlideKind;
  durationMs: number;
  /** Public URL under apps/web/public. */
  audioSrc: string | null;
  /** Cue point used when a track is reused across multiple story scenes. */
  audioStartSeconds: number;
  /** Optional full-frame reveal selected from the backend's stable weekly character id. */
  characterVideo: WeeklyRecapCharacterVideo | null;
}

export interface WeeklyRecapCharacterVideo {
  src: string;
  posterSrc: string;
  headlineAtMs: number;
  supportAtMs: number;
}

/**
 * Compose the deterministic story from server-computed evidence (see `composeWeeklyRecapStory`),
 * with each media key resolved to its public URL.
 */
export function composeWeeklyRecapSlides(review: WeeklyReviewDto): WeeklyRecapSlide[] {
  return composeWeeklyRecapStory(review).map(({ kind, durationMs, audio, character }) => ({
    kind,
    durationMs,
    audioSrc: WEEKLY_RECAP_AUDIO_ASSETS[audio.key],
    audioStartSeconds: audio.startSeconds,
    characterVideo: character
      ? {
          src: WEEKLY_RECAP_VIDEO_ASSETS[character.key],
          posterSrc: WEEKLY_RECAP_CHARACTER_IMAGE_ASSETS[character.key],
          headlineAtMs: character.headlineAtMs,
          supportAtMs: character.supportAtMs,
        }
      : null,
  }));
}

type RecapStorage = Pick<Storage, "getItem" | "setItem">;
export type WeeklyRecapSource = "analysis" | "dashboard";

export function buildWeeklyRecapTeaserHref({
  source,
  examId,
  examType,
}: {
  source: WeeklyRecapSource;
  examId?: string;
  examType?: string;
}) {
  return {
    pathname: "/analysis/recap" as const,
    query: {
      source,
      ...(examId ? { examId } : {}),
      ...(examType ? { examType } : {}),
    },
  };
}

export interface WeeklyRecapShareCopy {
  title: string;
  sessions: (count: number) => string;
  minutes: (count: number) => string;
  activeDays: (count: number) => string;
  completedTasks: (count: number) => string;
  weeklyTitle: (label: string) => string;
  topSubject: (name: string, minutes: number) => string;
}

export interface WeeklyRecapShareCardModel {
  weeklyTitle: string | null;
  characterImageSrc: string | null;
  focusMinutes: number;
  activeDays: number;
  qualifyingSessionCount: number;
  completedTaskCount: number;
  longestSessionMinutes: number;
  longestActiveRun: number;
  topSubject: {
    subjectName: string;
    focusMinutes: number;
  } | null;
}

export function weeklyRecapOpenedKey(startDate: string): string {
  return `mentor.weekly-recap.opened.v2:${startDate}`;
}

export type WeeklyRecapTeaserState = "hidden" | "new" | "replay";

export function getWeeklyRecapTeaserState(
  storage: Pick<RecapStorage, "getItem">,
  startDate: string,
  status: WeeklyReviewDto["recap"]["status"] = "READY",
): WeeklyRecapTeaserState {
  if (status === "EMPTY") return "hidden";
  return storage.getItem(weeklyRecapOpenedKey(startDate)) === "1"
    ? "replay"
    : "new";
}

export function markWeeklyRecapOpened(
  storage: Pick<RecapStorage, "setItem">,
  startDate: string,
): void {
  storage.setItem(weeklyRecapOpenedKey(startDate), "1");
}

/**
 * Share copy intentionally reads only effort aggregates and the server-verified top focus subject.
 * Net, mood, task titles and free-form behavioral text cannot enter through this boundary.
 */
export function buildWeeklyRecapShareText(
  review: WeeklyReviewDto,
  copy: WeeklyRecapShareCopy,
): string {
  const parts = [copy.title];
  if (review.recap.weeklyTitle) {
    parts.push(copy.weeklyTitle(review.recap.weeklyTitle.label));
  }
  if (review.evidence.qualifyingSessionCount > 0) {
    parts.push(copy.sessions(review.evidence.qualifyingSessionCount));
  }
  if (review.rhythm.focusMinutes > 0) {
    parts.push(copy.minutes(review.rhythm.focusMinutes));
  }
  if (review.recap.activeDays > 0) {
    parts.push(copy.activeDays(review.recap.activeDays));
  }
  if (review.plan.completedTaskCount > 0) {
    parts.push(copy.completedTasks(review.plan.completedTaskCount));
  }
  const topSubject = review.rhythm.subjectBreakdown[0];
  if (topSubject) {
    parts.push(
      copy.topSubject(topSubject.subjectName, topSubject.focusMinutes),
    );
  }
  return parts.join(" · ");
}

export function buildWeeklyRecapShareCardModel(
  review: WeeklyReviewDto,
): WeeklyRecapShareCardModel {
  const { characterKey, ...facts } = buildWeeklyRecapShareCardFacts(review);
  return {
    ...facts,
    characterImageSrc: characterKey ? WEEKLY_RECAP_CHARACTER_IMAGE_ASSETS[characterKey] : null,
  };
}

export function weeklyRecapExitHref(
  source: WeeklyRecapSource,
): "/dashboard" | { pathname: "/analysis"; query: { tab: "progress" } } {
  return source === "dashboard"
    ? "/dashboard"
    : { pathname: "/analysis", query: { tab: "progress" } };
}
