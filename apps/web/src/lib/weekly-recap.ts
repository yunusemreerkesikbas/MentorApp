import type { WeeklyRecapTitleId, WeeklyReviewDto } from "@mentor/types";

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
} as const;

export const WEEKLY_RECAP_AUDIO_ASSETS = {
  characterReveal: "/audio/mixkit-shot-light-energy-flowing-2589.wav",
  digitalClouds: "/audio/mixkit-digital-clouds-175.mp3",
  discover: "/audio/mixkit-discover-587.mp3",
  funkeeMonkeee: "/audio/mixkit-funkee-monkeee-1140.mp3",
  gimmeThatGroove: "/audio/mixkit-gimme-that-groove-872.mp3",
  popTrack03: "/audio/mixkit-pop-track-03-729.mp3",
} as const;

export type WeeklyRecapSlideKind =
  | "welcome"
  | "week_map"
  | "focus"
  | "weekly_run"
  | "weekly_best"
  | "performance"
  | "spark"
  | "weekly_title"
  | "partial_unlocks"
  | "partial_final"
  | "final";

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

const WEEKLY_RECAP_CHARACTER_VIDEO_BY_TITLE: Record<
  WeeklyRecapTitleId,
  WeeklyRecapCharacterVideo
> = {
  BALANCE_MASTER: {
    src: WEEKLY_RECAP_VIDEO_ASSETS.cosmicMaestro,
    posterSrc: WEEKLY_RECAP_CHARACTER_IMAGE_ASSETS.cosmicMaestro,
    headlineAtMs: 4_000,
    supportAtMs: 6_000,
  },
  RHYTHM_GUARDIAN: {
    src: WEEKLY_RECAP_VIDEO_ASSETS.timeBender,
    posterSrc: WEEKLY_RECAP_CHARACTER_IMAGE_ASSETS.timeBender,
    headlineAtMs: 4_000,
    supportAtMs: 6_000,
  },
  FOCUS_DIVER: {
    src: WEEKLY_RECAP_VIDEO_ASSETS.nebulaDiver,
    posterSrc: WEEKLY_RECAP_CHARACTER_IMAGE_ASSETS.nebulaDiver,
    headlineAtMs: 4_000,
    supportAtMs: 6_000,
  },
  PLAN_ARCHITECT: {
    src: WEEKLY_RECAP_VIDEO_ASSETS.routeArchitect,
    posterSrc: WEEKLY_RECAP_CHARACTER_IMAGE_ASSETS.routeArchitect,
    headlineAtMs: 4_000,
    supportAtMs: 6_000,
  },
  SUBJECT_EXPLORER: {
    src: WEEKLY_RECAP_VIDEO_ASSETS.dimensionExplorer,
    posterSrc: WEEKLY_RECAP_CHARACTER_IMAGE_ASSETS.dimensionExplorer,
    headlineAtMs: 4_000,
    supportAtMs: 6_000,
  },
  MOCK_BRAVE: {
    src: WEEKLY_RECAP_VIDEO_ASSETS.phoenixPilot,
    posterSrc: WEEKLY_RECAP_CHARACTER_IMAGE_ASSETS.phoenixPilot,
    headlineAtMs: 4_000,
    supportAtMs: 6_000,
  },
  FOCUS_TRAVELER: {
    src: WEEKLY_RECAP_VIDEO_ASSETS.novaTraveler,
    posterSrc: WEEKLY_RECAP_CHARACTER_IMAGE_ASSETS.novaTraveler,
    headlineAtMs: 4_000,
    supportAtMs: 6_000,
  },
};

const WEEKLY_RECAP_SLIDE_AUDIO: Record<
  WeeklyRecapSlideKind,
  { src: string; startSeconds: number }
> = {
  welcome: { src: WEEKLY_RECAP_AUDIO_ASSETS.popTrack03, startSeconds: 0 },
  week_map: {
    src: WEEKLY_RECAP_AUDIO_ASSETS.gimmeThatGroove,
    startSeconds: 0,
  },
  focus: { src: WEEKLY_RECAP_AUDIO_ASSETS.digitalClouds, startSeconds: 0 },
  weekly_run: {
    src: WEEKLY_RECAP_AUDIO_ASSETS.gimmeThatGroove,
    startSeconds: 14,
  },
  weekly_best: {
    src: WEEKLY_RECAP_AUDIO_ASSETS.funkeeMonkeee,
    startSeconds: 0,
  },
  performance: {
    src: WEEKLY_RECAP_AUDIO_ASSETS.digitalClouds,
    startSeconds: 14,
  },
  spark: {
    src: WEEKLY_RECAP_AUDIO_ASSETS.funkeeMonkeee,
    startSeconds: 7,
  },
  weekly_title: {
    src: WEEKLY_RECAP_AUDIO_ASSETS.characterReveal,
    startSeconds: 0,
  },
  partial_unlocks: {
    src: WEEKLY_RECAP_AUDIO_ASSETS.popTrack03,
    startSeconds: 14,
  },
  partial_final: {
    src: WEEKLY_RECAP_AUDIO_ASSETS.discover,
    startSeconds: 0,
  },
  final: { src: WEEKLY_RECAP_AUDIO_ASSETS.discover, startSeconds: 0 },
};

function storySlide(
  kind: WeeklyRecapSlideKind,
  durationMs: number,
): WeeklyRecapSlide {
  const audio = WEEKLY_RECAP_SLIDE_AUDIO[kind];
  return {
    kind,
    durationMs,
    audioSrc: audio.src,
    audioStartSeconds: audio.startSeconds,
    characterVideo: null,
  };
}

const READY_STORY: readonly WeeklyRecapSlide[] = [
  storySlide("welcome", 10_000),
  storySlide("week_map", 7_000),
  storySlide("focus", 7_000),
  storySlide("weekly_run", 7_000),
  storySlide("weekly_best", 7_000),
  storySlide("performance", 7_000),
  storySlide("weekly_title", 8_000),
  storySlide("final", 7_000),
];

const PARTIAL_WELCOME_SLIDE = storySlide("welcome", 10_000);
const PARTIAL_STANDARD_DURATION_MS = 7_000;

function partialSlide(kind: WeeklyRecapSlideKind): WeeklyRecapSlide {
  return storySlide(kind, PARTIAL_STANDARD_DURATION_MS);
}

export type WeeklyRecapFocusStoryMode = "data" | "teaser";
export type WeeklyRecapPerformanceStoryMode = "data" | "curiosity_bridge";
export type WeeklyRecapTextBeat = "headline" | "support";
export type WeeklyRecapWeekMapPhase = "headline" | "active_days";
export type WeeklyRecapBestStorySource =
  | "focus_subject"
  | "plan_subject"
  | "highlight";

export function getWeeklyRecapFocusTimeMessage(
  review: WeeklyReviewDto,
): string | null {
  return review.rhythm.focusTimeBand?.message ?? null;
}

export function getWeeklyRecapPeakDayStory(
  review: WeeklyReviewDto,
  locale: string,
): {
  dayLabel: string;
  focusMinutes: number;
  message: string;
} | null {
  const peak = review.rhythm.peakFocusDay;
  if (!peak) return null;
  return {
    dayLabel: new Intl.DateTimeFormat(locale, { weekday: "long" }).format(
      new Date(`${peak.date}T12:00:00Z`),
    ),
    focusMinutes: peak.focusMinutes,
    message: peak.message,
  };
}

export interface WeeklyRecapPlaybackState {
  index: number;
  elapsedMs: number;
  playing: boolean;
  completed: boolean;
}

export interface WeeklyRecapAdvanceConditions {
  playing: boolean;
  pageVisible: boolean;
  held: boolean;
}

const WEEKLY_RECAP_HOLD_THRESHOLD_MS = 300;

export function getFocusStoryMode(
  review: WeeklyReviewDto,
): WeeklyRecapFocusStoryMode {
  return review.rhythm.focusMinutes > 0 ? "data" : "teaser";
}

export function getPerformanceStoryMode(
  review: WeeklyReviewDto,
): WeeklyRecapPerformanceStoryMode {
  return review.performance ? "data" : "curiosity_bridge";
}

export function getWeeklyBestStorySource(
  review: WeeklyReviewDto,
): WeeklyRecapBestStorySource {
  if (review.rhythm.subjectBreakdown.length > 0) return "focus_subject";
  if (review.plan.subjectBreakdown.length > 0) return "plan_subject";
  return "highlight";
}

export function createWeeklyRecapPlayback(
  reducedMotion: boolean,
): WeeklyRecapPlaybackState {
  return {
    index: 0,
    elapsedMs: 0,
    playing: !reducedMotion,
    completed: false,
  };
}

export function shouldWeeklyRecapAdvance({
  playing,
  pageVisible,
  held,
}: WeeklyRecapAdvanceConditions): boolean {
  return playing && pageVisible && !held;
}

export function getWeeklyRecapTextBeat(
  elapsedMs: number,
  durationMs: number,
): WeeklyRecapTextBeat {
  return elapsedMs < durationMs * 0.45 ? "headline" : "support";
}

export function getWeeklyRecapWeekMapPhase(
  elapsedMs: number,
): WeeklyRecapWeekMapPhase {
  return elapsedMs < 2_200 ? "headline" : "active_days";
}

export function shouldNavigateAfterWeeklyRecapPress(
  pressDurationMs: number,
): boolean {
  return pressDurationMs < WEEKLY_RECAP_HOLD_THRESHOLD_MS;
}

export function navigateWeeklyRecapPlayback(
  state: WeeklyRecapPlaybackState,
  index: number,
  slides: readonly WeeklyRecapSlide[],
): WeeklyRecapPlaybackState {
  const lastIndex = Math.max(0, slides.length - 1);
  return {
    ...state,
    index: Math.min(Math.max(index, 0), lastIndex),
    elapsedMs: 0,
    completed: false,
  };
}

export function replayWeeklyRecap(): WeeklyRecapPlaybackState {
  return createWeeklyRecapPlayback(false);
}

export function advanceWeeklyRecapPlayback(
  state: WeeklyRecapPlaybackState,
  deltaMs: number,
  slides: readonly WeeklyRecapSlide[],
): WeeklyRecapPlaybackState {
  if (!state.playing || deltaMs <= 0 || slides.length === 0) return state;

  let index = Math.min(state.index, slides.length - 1);
  let elapsedMs = state.elapsedMs + deltaMs;

  while (elapsedMs >= slides[index]!.durationMs) {
    const currentDuration = slides[index]!.durationMs;
    if (index === slides.length - 1) {
      return {
        index,
        elapsedMs: currentDuration,
        playing: false,
        completed: true,
      };
    }
    elapsedMs -= currentDuration;
    index += 1;
  }

  return { ...state, index, elapsedMs, completed: false };
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

/**
 * Compose the deterministic story from server-computed evidence. Missing evidence never creates a
 * zero-emphasis slide. EMPTY is rendered as a dedicated state outside the deck.
 */
export function composeWeeklyRecapSlides(
  review: WeeklyReviewDto,
): WeeklyRecapSlide[] {
  if (review.recap.status === "EMPTY") return [];

  if (review.recap.status === "PARTIAL") {
    return [
      { ...PARTIAL_WELCOME_SLIDE },
      partialSlide("week_map"),
      ...(review.evidence.qualifyingSessionCount > 0
        ? [partialSlide("focus")]
        : []),
      ...(review.rhythm.longestActiveRun > 1
        ? [partialSlide("weekly_run")]
        : []),
      partialSlide("spark"),
      partialSlide("partial_unlocks"),
      partialSlide("partial_final"),
    ];
  }

  const characterVideo = review.recap.weeklyTitle
    ? (WEEKLY_RECAP_CHARACTER_VIDEO_BY_TITLE[review.recap.weeklyTitle.id] ??
      null)
    : null;

  return READY_STORY.map((slide) => ({
    ...slide,
    characterVideo:
      slide.kind === "weekly_title" ? characterVideo : slide.characterVideo,
  }));
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
  const topSubject = review.rhythm.subjectBreakdown[0] ?? null;
  return {
    weeklyTitle: review.recap.weeklyTitle?.label ?? null,
    characterImageSrc: review.recap.weeklyTitle
      ? WEEKLY_RECAP_CHARACTER_VIDEO_BY_TITLE[review.recap.weeklyTitle.id]
          .posterSrc
      : null,
    focusMinutes: review.rhythm.focusMinutes,
    activeDays: review.recap.activeDays,
    qualifyingSessionCount: review.evidence.qualifyingSessionCount,
    completedTaskCount: review.plan.completedTaskCount,
    longestSessionMinutes: review.rhythm.longestSessionMinutes,
    longestActiveRun: review.rhythm.longestActiveRun,
    topSubject: topSubject
      ? {
          subjectName: topSubject.subjectName,
          focusMinutes: topSubject.focusMinutes,
        }
      : null,
  };
}

export function weeklyRecapExitHref(
  source: WeeklyRecapSource,
): "/dashboard" | { pathname: "/analysis"; query: { tab: "progress" } } {
  return source === "dashboard"
    ? "/dashboard"
    : { pathname: "/analysis", query: { tab: "progress" } };
}
