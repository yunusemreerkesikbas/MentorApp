import type {
  WeeklyRecapOfferDto,
  WeeklyRecapTitleId,
  WeeklyReviewDto,
} from "@mentor/types";

/**
 * The weekly recap story, shared by web and mobile: which slides a week gets, how long each plays,
 * and the playback rules. Media are named by key; each app maps keys to its own sources (web: public
 * URLs, mobile: bundled assets), so the two apps can never compose different decks.
 */

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

export type WeeklyRecapCharacterKey =
  | "cosmicMaestro"
  | "dimensionExplorer"
  | "nebulaDiver"
  | "novaTraveler"
  | "phoenixPilot"
  | "routeArchitect"
  | "timeBender";

export type WeeklyRecapAudioKey =
  | "characterReveal"
  | "digitalClouds"
  | "discover"
  | "funkeeMonkeee"
  | "gimmeThatGroove"
  | "popTrack03";

export interface WeeklyRecapStorySlide {
  kind: WeeklyRecapSlideKind;
  durationMs: number;
  /** Cue point used when a track is reused across multiple story scenes. */
  audio: { key: WeeklyRecapAudioKey; startSeconds: number };
  /** Full-frame reveal selected from the backend's stable weekly character id. */
  character: { key: WeeklyRecapCharacterKey; headlineAtMs: number; supportAtMs: number } | null;
}

export const WEEKLY_RECAP_CHARACTER_BY_TITLE: Record<WeeklyRecapTitleId, WeeklyRecapCharacterKey> = {
  BALANCE_MASTER: "cosmicMaestro",
  RHYTHM_GUARDIAN: "timeBender",
  FOCUS_DIVER: "nebulaDiver",
  PLAN_ARCHITECT: "routeArchitect",
  SUBJECT_EXPLORER: "dimensionExplorer",
  MOCK_BRAVE: "phoenixPilot",
  FOCUS_TRAVELER: "novaTraveler",
};

const CHARACTER_CUES = { headlineAtMs: 4_000, supportAtMs: 6_000 } as const;

const SLIDE_AUDIO: Record<WeeklyRecapSlideKind, { key: WeeklyRecapAudioKey; startSeconds: number }> = {
  welcome: { key: "popTrack03", startSeconds: 0 },
  week_map: { key: "gimmeThatGroove", startSeconds: 0 },
  focus: { key: "digitalClouds", startSeconds: 0 },
  weekly_run: { key: "gimmeThatGroove", startSeconds: 14 },
  weekly_best: { key: "funkeeMonkeee", startSeconds: 0 },
  performance: { key: "digitalClouds", startSeconds: 14 },
  spark: { key: "funkeeMonkeee", startSeconds: 7 },
  weekly_title: { key: "characterReveal", startSeconds: 0 },
  partial_unlocks: { key: "popTrack03", startSeconds: 14 },
  partial_final: { key: "discover", startSeconds: 0 },
  final: { key: "discover", startSeconds: 0 },
};

const STANDARD_DURATION_MS = 7_000;

function storySlide(kind: WeeklyRecapSlideKind, durationMs = STANDARD_DURATION_MS): WeeklyRecapStorySlide {
  return { kind, durationMs, audio: { ...SLIDE_AUDIO[kind] }, character: null };
}

/**
 * Compose the deterministic story from server-computed evidence. Missing evidence never creates a
 * zero-emphasis slide. EMPTY is rendered as a dedicated state outside the deck.
 */
export function composeWeeklyRecapStory(review: WeeklyReviewDto): WeeklyRecapStorySlide[] {
  if (review.recap.status === "EMPTY") return [];

  if (review.recap.status === "PARTIAL") {
    return [
      storySlide("welcome", 10_000),
      storySlide("week_map"),
      ...(review.evidence.qualifyingSessionCount > 0 ? [storySlide("focus")] : []),
      ...(review.rhythm.longestActiveRun > 1 ? [storySlide("weekly_run")] : []),
      storySlide("spark"),
      storySlide("partial_unlocks"),
      storySlide("partial_final"),
    ];
  }

  const title = review.recap.weeklyTitle;
  const characterKey = title ? WEEKLY_RECAP_CHARACTER_BY_TITLE[title.id] : undefined;
  return [
    storySlide("welcome", 10_000),
    storySlide("week_map"),
    storySlide("focus"),
    storySlide("weekly_run"),
    storySlide("weekly_best"),
    storySlide("performance"),
    {
      ...storySlide("weekly_title", 8_000),
      character: characterKey ? { key: characterKey, ...CHARACTER_CUES } : null,
    },
    storySlide("final"),
  ];
}

/* ------------------------------ evidence selectors ------------------------------ */

export type WeeklyRecapFocusStoryMode = "data" | "teaser";
export type WeeklyRecapPerformanceStoryMode = "data" | "curiosity_bridge";
export type WeeklyRecapTextBeat = "headline" | "support";
export type WeeklyRecapWeekMapPhase = "headline" | "active_days";
export type WeeklyRecapBestStorySource = "focus_subject" | "plan_subject" | "highlight";

export function getWeeklyRecapFocusTimeMessage(review: WeeklyReviewDto): string | null {
  return review.rhythm.focusTimeBand?.message ?? null;
}

export function getWeeklyRecapPeakDayStory(
  review: WeeklyReviewDto,
  locale: string,
): { dayLabel: string; focusMinutes: number; message: string } | null {
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

export function getFocusStoryMode(review: WeeklyReviewDto): WeeklyRecapFocusStoryMode {
  return review.rhythm.focusMinutes > 0 ? "data" : "teaser";
}

export function getPerformanceStoryMode(review: WeeklyReviewDto): WeeklyRecapPerformanceStoryMode {
  return review.performance ? "data" : "curiosity_bridge";
}

export function getWeeklyBestStorySource(review: WeeklyReviewDto): WeeklyRecapBestStorySource {
  if (review.rhythm.subjectBreakdown.length > 0) return "focus_subject";
  if (review.plan.subjectBreakdown.length > 0) return "plan_subject";
  return "highlight";
}

/* ------------------------------ playback ------------------------------ */

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

type TimedSlide = { durationMs: number };

const HOLD_THRESHOLD_MS = 300;

export function createWeeklyRecapPlayback(reducedMotion: boolean): WeeklyRecapPlaybackState {
  return { index: 0, elapsedMs: 0, playing: !reducedMotion, completed: false };
}

export function shouldWeeklyRecapAdvance({ playing, pageVisible, held }: WeeklyRecapAdvanceConditions): boolean {
  return playing && pageVisible && !held;
}

export function getWeeklyRecapTextBeat(elapsedMs: number, durationMs: number): WeeklyRecapTextBeat {
  return elapsedMs < durationMs * 0.45 ? "headline" : "support";
}

export function getWeeklyRecapWeekMapPhase(elapsedMs: number): WeeklyRecapWeekMapPhase {
  return elapsedMs < 2_200 ? "headline" : "active_days";
}

export function shouldNavigateAfterWeeklyRecapPress(pressDurationMs: number): boolean {
  return pressDurationMs < HOLD_THRESHOLD_MS;
}

export function navigateWeeklyRecapPlayback(
  state: WeeklyRecapPlaybackState,
  index: number,
  slides: readonly TimedSlide[],
): WeeklyRecapPlaybackState {
  const lastIndex = Math.max(0, slides.length - 1);
  return { ...state, index: Math.min(Math.max(index, 0), lastIndex), elapsedMs: 0, completed: false };
}

export function replayWeeklyRecap(): WeeklyRecapPlaybackState {
  return createWeeklyRecapPlayback(false);
}

export function advanceWeeklyRecapPlayback(
  state: WeeklyRecapPlaybackState,
  deltaMs: number,
  slides: readonly TimedSlide[],
): WeeklyRecapPlaybackState {
  if (!state.playing || deltaMs <= 0 || slides.length === 0) return state;

  let index = Math.min(state.index, slides.length - 1);
  let elapsedMs = state.elapsedMs + deltaMs;

  while (elapsedMs >= slides[index]!.durationMs) {
    const currentDuration = slides[index]!.durationMs;
    if (index === slides.length - 1) {
      return { index, elapsedMs: currentDuration, playing: false, completed: true };
    }
    elapsedMs -= currentDuration;
    index += 1;
  }

  return { ...state, index, elapsedMs, completed: false };
}

/**
 * The final slide's actions show at its support beat, or at once while the story is paused (reduced
 * motion starts paused). Mobile counts the story as finished here: "Bitti" can close it before the
 * timer ends, and the server keeps one completion per week.
 */
export function weeklyRecapFinalActionsVisible(
  slide: { kind: WeeklyRecapSlideKind; durationMs: number },
  state: WeeklyRecapPlaybackState,
): boolean {
  return (
    slide.kind === "final" &&
    (!state.playing || getWeeklyRecapTextBeat(state.elapsedMs, slide.durationMs) === "support")
  );
}

/* ------------------------------ share card facts ------------------------------ */

export interface WeeklyRecapShareCardFacts {
  weeklyTitle: string | null;
  characterKey: WeeklyRecapCharacterKey | null;
  focusMinutes: number;
  activeDays: number;
  qualifyingSessionCount: number;
  completedTaskCount: number;
  longestSessionMinutes: number;
  longestActiveRun: number;
  topSubject: { subjectName: string; focusMinutes: number } | null;
}

/**
 * Share facts intentionally read only effort aggregates and the server-verified top focus subject.
 * Net, mood, task titles and free-form behavioral text cannot enter through this boundary.
 */
export function buildWeeklyRecapShareCardFacts(review: WeeklyReviewDto): WeeklyRecapShareCardFacts {
  const topSubject = review.rhythm.subjectBreakdown[0] ?? null;
  const title = review.recap.weeklyTitle;
  return {
    weeklyTitle: title?.label ?? null,
    characterKey: title ? WEEKLY_RECAP_CHARACTER_BY_TITLE[title.id] : null,
    focusMinutes: review.rhythm.focusMinutes,
    activeDays: review.recap.activeDays,
    qualifyingSessionCount: review.evidence.qualifyingSessionCount,
    completedTaskCount: review.plan.completedTaskCount,
    longestSessionMinutes: review.rhythm.longestSessionMinutes,
    longestActiveRun: review.rhythm.longestActiveRun,
    topSubject: topSubject
      ? { subjectName: topSubject.subjectName, focusMinutes: topSubject.focusMinutes }
      : null,
  };
}

export interface WeeklyRecapShareCardRowCopy {
  focus: string;
  activeDays: string;
  sessions: string;
  completedTasks: string;
  longestSession: string;
  longestRun: string;
  topSubject: string;
  minutes: (count: number) => string;
  days: (count: number) => string;
  count: (count: number) => string;
  subject: (name: string, minutes: number) => string;
}

export interface WeeklyRecapShareCardRow {
  label: string;
  value: string;
}

export function buildWeeklyRecapShareCardRows(
  model: Omit<WeeklyRecapShareCardFacts, "weeklyTitle" | "characterKey">,
  copy: WeeklyRecapShareCardRowCopy,
): WeeklyRecapShareCardRow[] {
  const rows: WeeklyRecapShareCardRow[] = [];
  if (model.focusMinutes > 0) rows.push({ label: copy.focus, value: copy.minutes(model.focusMinutes) });
  if (model.activeDays > 0) rows.push({ label: copy.activeDays, value: copy.count(model.activeDays) });
  if (model.qualifyingSessionCount > 0) {
    rows.push({ label: copy.sessions, value: copy.count(model.qualifyingSessionCount) });
  }
  if (model.completedTaskCount > 0) {
    rows.push({ label: copy.completedTasks, value: copy.count(model.completedTaskCount) });
  }
  if (model.longestSessionMinutes > 0) {
    rows.push({ label: copy.longestSession, value: copy.minutes(model.longestSessionMinutes) });
  }
  if (model.longestActiveRun > 0) rows.push({ label: copy.longestRun, value: copy.days(model.longestActiveRun) });
  if (model.topSubject) {
    rows.push({
      label: copy.topSubject,
      value: copy.subject(model.topSubject.subjectName, model.topSubject.focusMinutes),
    });
  }
  return rows;
}

/* ------------------------------ access card ------------------------------ */

/** Outages that pass on their own: nothing was spent, so the card offers a retry. */
const PASSING = new Set(["AI_BUDGET_EXCEEDED", "AI_DISABLED", "WEEKLY_RECAP_PROCESSING"]);
const COIN_STATE: Record<string, "short" | "limit" | null> = {
  INSUFFICIENT_COIN: "short",
  WEEKLY_RECAP_LIMIT_REACHED: "limit",
  PAYMENT_PREMIUM_REQUIRED: null,
};

export type RecapAccessView =
  | { kind: "gift" }
  | { kind: "member" }
  | { kind: "owned" }
  | { kind: "retry" }
  | { kind: "notice"; message: string }
  | {
      kind: "choice";
      lead: "coin" | "premium" | null;
      coin: "ready" | "short" | "limit" | null;
      premium: boolean;
      missing: number;
    };

/**
 * The locked card for one offer (docs/plans/2026-11-03-coin-unlock-choice-design.md § States):
 * affordable Coin leads, otherwise Premium leads when it can be bought, otherwise nothing does.
 */
export function recapAccessView(offer: WeeklyRecapOfferDto, purchases: boolean): RecapAccessView {
  if (offer.reason && PASSING.has(offer.reason)) return { kind: "retry" };
  const notice = { kind: "notice", message: offer.message ?? "" } as const;
  if (offer.mode !== "COIN") {
    if (!offer.canOpen) return notice;
    return offer.mode === "EARNED" ? { kind: "gift" } : offer.mode === "PREMIUM" ? { kind: "member" } : { kind: "owned" };
  }
  if (offer.reason && !(offer.reason in COIN_STATE)) return notice;
  const coin = offer.reason ? COIN_STATE[offer.reason]! : "ready";
  const premium = purchases && offer.premiumAvailable;
  if (!coin && !premium) return notice;
  return {
    kind: "choice",
    lead: coin === "ready" ? "coin" : premium ? "premium" : null,
    coin,
    premium,
    missing: Math.max(0, offer.cost - offer.coinConfirmed),
  };
}
