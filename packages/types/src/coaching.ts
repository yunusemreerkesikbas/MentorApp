/**
 * Coaching API contracts (W2 daily loop + mood) — shared by api (producer) and
 * web/mobile/panel (consumers). The composite `TodayPanelResponse` is the shape the
 * Panel screen renders in ONE server round-trip (no FE recomputation — §engineering-principles).
 *
 * All values are server-computed and ready to display: the countdown days come from the
 * verified content calendar (guardrail §4 #1), the streak from daily activity, and every
 * user-facing line is backend-localized (no AI on these surfaces — §4 #5).
 */

import type { ForumCoachIntent } from "./forum.js";

export type PlanTaskStatus = "PENDING" | "DONE";
export type StudySessionStatus = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
export type SessionPresetId = "25_5" | "50_10" | "custom";

export const PlanTaskOriginType = {
  COMMUNITY_COACH: "COMMUNITY_COACH",
  AI_COACH: "AI_COACH",
  /** Assigned by a HUMAN coach over an active mentorship link (W8). Not the AI. */
  MENTORSHIP: "MENTORSHIP",
} as const;
export type PlanTaskOriginType =
  (typeof PlanTaskOriginType)[keyof typeof PlanTaskOriginType];

/** Structural provenance for a user-confirmed task created from a community-origin coach chat. */
export interface CommunityCoachPlanTaskOriginDto {
  type: typeof PlanTaskOriginType.COMMUNITY_COACH;
  conversationId: string;
  threadId: string;
  intent: ForumCoachIntent;
  zoneType: "CHAT" | "QA";
}

/** User-confirmed task proposed by a persisted AI mentor message. */
export interface AiCoachPlanTaskOriginDto {
  type: typeof PlanTaskOriginType.AI_COACH;
  coachMessageId: string;
}

/**
 * Assigned by the student's human coach. Only the link id travels: the student has at most one
 * active coach, so the UI says "from your coach" and looks the name up once from
 * `GET /v1/mentorship/my-coach` if it wants to name them.
 */
export interface MentorshipPlanTaskOriginDto {
  type: typeof PlanTaskOriginType.MENTORSHIP;
  linkId: string;
}

export type PlanTaskOriginDto =
  | CommunityCoachPlanTaskOriginDto
  | AiCoachPlanTaskOriginDto
  | MentorshipPlanTaskOriginDto;

/** Projection of a `plan_tasks` row. */
export interface PlanTaskDto {
  id: string;
  title: string;
  /** Soft-ref to the content subject taxonomy (display name), nullable. */
  subject: string | null;
  status: PlanTaskStatus;
  sortOrder: number;
  taskDate: string; // yyyy-mm-dd
  /** Wall-clock "HH:MM" on `taskDate`; null = all-day item. */
  startTime: string | null;
  /** Wall-clock "HH:MM"; null when open-ended. Never set without `startTime`. */
  endTime: string | null;
  /** Free-text note shown in the calendar event preview. */
  description: string | null;
  /** Nullable additive provenance; legacy and manually-created tasks have no origin. */
  origin: PlanTaskOriginDto | null;
}

export type CoachPlanAdaptationSource = "PLAN" | "MOOD" | "SESSION";
export type CoachPlanAdaptationStatus = "READY" | "NO_CHANGE";

export type CoachPlanAdaptationChangeDto =
  | {
      kind: "MOVE";
      taskId: string;
      title: string;
      subject: string | null;
      fromDate: string;
      toDate: string;
    }
  | {
      kind: "ADD";
      title: string;
      subject: string | null;
      taskDate: string;
    };

/** Premium coach preview; no plan row is written until the user confirms selected changes. */
export interface CoachPlanAdaptationDto {
  status: CoachPlanAdaptationStatus;
  /** Backend-localized calm summary. */
  message: string;
  window: { from: string; to: string };
  /** Opaque snapshot hash used to reject stale confirmations. */
  planRevision: string;
  changes: CoachPlanAdaptationChangeDto[];
  model: string;
}

/** Result of atomically applying a user-selected adaptation preview. */
export interface ApplyPlanAdaptationResultDto {
  moved: PlanTaskDto[];
  added: PlanTaskDto[];
}

/** Distinct calendar dates that have ≥1 plan task (datepicker dots). */
export interface PlanTaskCalendarDto {
  dates: string[];
}

/** Projection of a `study_sessions` row. */
export interface StudySessionDto {
  id: string;
  preset: SessionPresetId;
  status: StudySessionStatus;
  subject: string | null;
  /** Plan task this session was started from; null when not linked. */
  planTaskId: string | null;
  /** Study room this session is seated at; null = solo. Fixed at start. */
  roomId: string | null;
  /** Resolved plan task title when listed with join; null when unlinked or on write responses. */
  planTaskTitle: string | null;
  startedAt: string; // ISO datetime
  endedAt: string | null; // ISO datetime
  actualFocusSeconds: number;
  /** Set when `preset === "custom"`; null for fixed Pomodoro presets. */
  plannedFocusMinutes: number | null;
  /** Post-session micro check-in effort/mood 1-3 (😩😐🙂); null until captured. */
  sessionMood: number | null;
  /** Optional post-session "what challenged you" note; null when blank. */
  struggleNote: string | null;
  /** Premium AI session reflection (null until generated / for free tier). */
  aiReflection: string | null;
  /**
   * Cached plan-task suggestion from session reflection ({title, subject}); null when none /
   * free / cleared. Used by W3 session-reflection cache; not shown on history list UI.
   */
  aiSuggestedTask: { title: string; subject: string | null } | null;
  /** True when this finalized session meets the platform min-focus threshold (streak/XP/quests). */
  countsAsFocusSession: boolean;
  /** True when finalize auto-marked the linked plan task DONE (this request only). */
  planTaskAutoCompleted: boolean;
}

/** Streak summary derived server-side from `daily_activity` / `streak_state`. */
export interface StreakSummaryDto {
  currentStreak: number;
  longestStreak: number;
  freezeTokens: number;
}

/**
 * Calm countdown — sourced from the verified exam calendar via the content port
 * (never `users.examDate`). `null` when the user has no exam type set or the
 * calendar has no authoritative date yet (no silent fallback — plan §6 #5).
 */
export interface CountdownDto {
  examType: string;
  examName: string;
  /** Computed server-side; the client only displays it. */
  daysRemaining: number;
  /** Pre-formatted authoritative date for display (Turkish). */
  examDateLabel: string;
  source: string;
  sourceUrl: string;
}

/* ------------------------------- study rooms ---------------------------------- */

export type StudyRoomTheme = "LIBRARY" | "CAFE" | "HOME";
export type StudyRoomRole = "OWNER" | "MEMBER";

/** Room card for the "Masalarım" list — cheap counts only, no seat detail. */
export interface StudyRoomDto {
  id: string;
  name: string;
  theme: StudyRoomTheme;
  capacity: number;
  /** Persistent members holding a seat (the "3" in 3/10). */
  memberCount: number;
  /** Members with an open session in THIS room right now (the "çalışan sayısı"). */
  activeCount: number;
  role: StudyRoomRole;
  /** False once nobody has sat down for `STUDY_ROOM_DORMANT_DAYS`; excluded from the quota. */
  isActive: boolean;
}

/**
 * One seat. `isSeated` is the member↔presence distinction: a member of three rooms shows as
 * seated in at most one. Effort only — focus minutes and subject, never exam results (§4).
 */
export interface StudyRoomSeatDto {
  userId: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  role: StudyRoomRole;
  isSeated: boolean;
  /** Minutes since this member sat down; null when not seated. */
  seatedMinutes: number | null;
  /** Subject of the open session; null when not seated or none chosen. */
  subject: string | null;
}

export interface StudyRoomDetailDto extends StudyRoomDto {
  /** Only sent to the owner — members share the room, not the ability to re-invite. */
  inviteCode: string | null;
  seats: StudyRoomSeatDto[];
}

/** Pomodoro presets (plan §3 Slice 2: "25_5" | "50_10"). */
export interface SessionPresetDto {
  id: SessionPresetId;
  label: string;
  focusMinutes: number;
  breakMinutes: number;
}

/** Today's mood check-in + its rule-based encouragement (mood is null if not set today). */
export interface MoodCheckinDto {
  checkinDate: string; // yyyy-mm-dd
  mood: number; // 1..5
  /** Stable machine code for the rule-based bucket (client branches on this, not copy). */
  code: string;
  /** Backend-localized encouraging line (display verbatim). */
  message: string;
  /** Optional user-typed subjective signal ("zorlandığın konu"); never AI-generated. */
  struggleNote: string | null;
  /** Cached premium AI-adaptive reflection for today (premium-only; null for free / not yet generated). */
  aiReflection: string | null;
}

/* ------------------------------- mock exams --------------------------------- */

export interface MockExamSubjectDto {
  subjectRef: string;
  subjectName: string;
  correct: number;
  wrong: number;
  blank: number;
  /** Server-computed net (string transport). */
  net: string;
}

export interface MockExamDto {
  id: string;
  examId: string;
  examName: string;
  takenAt: string;
  totalNet: string;
  /** Optional publisher label (e.g. Brans, Limit). */
  publisherName: string | null;
  subjects: MockExamSubjectDto[];
}

export interface MockExamTrendPointDto {
  id: string;
  takenAt: string;
  totalNet: string;
  examName: string;
}

export interface SubjectStrengthDto {
  subjectRef: string;
  subjectName: string;
  averageNet: string;
  attemptCount: number;
  questionCount: number | null;
  /** Server-computed averageNet / questionCount × 100. */
  normalizedAveragePercent: string | null;
  /** Average net across the last up to 4 attempts; null when no recent window applies. */
  recentAverageNet: string | null;
  /** recentAverageNet − averageNet — recent trend vs lifetime average. Null when recentAverageNet is null. */
  netDelta: string | null;
}

/** Foto analizinden gelen ders sinyalleri (zayıflık ipucu; net ortalamasından ayrı). */
export interface PhotoSubjectSignalDto {
  subjectRef: string;
  subjectName: string;
  count: number;
}

export interface PhotoTopicSignalDto {
  subjectRef: string;
  subjectName: string;
  topicRef: string;
  topicName: string;
  count: number;
}

/** Server-selected next study focus from personal analysis evidence. */
export type AnalysisFocusTrendDirection = "FIRST" | "UP" | "DOWN" | "STEADY";

export interface AnalysisFocusTrendPointDto {
  mockExamId: string;
  takenAt: string;
  net: string;
}

export interface AnalysisFocusDto {
  subjectRef: string;
  subjectName: string;
  topicRef?: string;
  topicName?: string;
  source: "PHOTO_SIGNAL" | "LOWEST_AVERAGE";
  evidenceCount: number;
  evidenceLevel: "EARLY" | "REPEATED";
  /** Backend-localized, encouraging explanation of the selected evidence. */
  message: string;
  /** Backend-localized Plan task title prefill. */
  suggestedTaskTitle: string;
  /** Selected subject's latest exam-scoped points, newest first (max 4). */
  recentTrend: AnalysisFocusTrendPointDto[];
  /** Latest minus previous subject net; null until two comparable points exist. */
  recentDelta: string | null;
  trendDirection: AnalysisFocusTrendDirection;
  /** Backend-localized interpretation; clients render it verbatim. */
  trendMessage: string;
}

/** Per-subject "geçmiş-ben" delta: this attempt's subject net vs the previous attempt's. */
export interface GhostSubjectDeltaDto {
  subjectRef: string;
  subjectName: string;
  latestNet: string;
  /** Same subject's net in the immediately prior attempt; `null` if it's a new subject. */
  previousNet: string | null;
  /** Signed delta (`latestNet − previousNet`, e.g. "+3.25"); `null` when there's no previous. */
  delta: string | null;
}

/**
 * "Geçmiş-ben" (ghost) — the latest attempt measured against the user's OWN past (§0 no ranking
 * vs others). `null` until there are ≥2 attempts. Free reads the rule-based comparison; the premium
 * AI narration arrives via `POST /v1/coach/ghost-narration` and is cached in `aiNarration`.
 */
export interface GhostComparisonDto {
  latest: { id: string; takenAt: string; totalNet: string; examName: string };
  /** Immediately prior attempt's total net + signed delta + did-you-beat-it flag. */
  previousNet: string;
  previousDelta: string;
  beatPrevious: boolean;
  /** All-time best total net BEFORE the latest attempt + signed delta + new-record flag. */
  bestPreviousNet: string;
  recordDelta: string;
  isNewRecord: boolean;
  /** Backend-localized encouraging headline (display verbatim). */
  headline: string;
  subjects: GhostSubjectDeltaDto[];
  /** Cached premium AI progress narration (premium-only; null for free / not generated). */
  aiNarration: string | null;
}

/** Personal deneme analysis — no ranking (guardrail §0). */
/**
 * How the user's recent mistakes break down by *why* they were missed.
 *
 * The one thing on this screen the student could not have worked out themselves: they know which
 * topics hurt, they do not know whether the cause is a gap or a habit — and the two call for
 * opposite responses.
 */
export interface NotebookErrorSignalDto {
  errorType: NotebookErrorType;
  count: number;
}

export interface CoachingAnalysisDto {
  trend: MockExamTrendPointDto[];
  subjects: SubjectStrengthDto[];
  /**
   * Named for the retired photo-categorize card, now fed by mistake-notebook entries — the shape
   * is identical and renaming would ripple through the focus engine, the weekly review and the
   * clients for no user-visible gain.
   */
  photoSubjectSignals: PhotoSubjectSignalDto[];
  photoTopicSignals: PhotoTopicSignalDto[];
  notebookErrorSignals: NotebookErrorSignalDto[];
  /** Backend-localized reading of the distribution above; `null` when there is too little to say. */
  notebookErrorMessage: string | null;
  /** `null` until a mock-exam or photo signal supplies personal evidence. */
  nextFocus: AnalysisFocusDto | null;
  /** All-time best total net across all attempts; null when no attempts. */
  personalRecordNet: string | null;
  /** Latest-vs-own-past comparison; `null` when fewer than 2 attempts. */
  ghost: GhostComparisonDto | null;
}

/** Daily focus goal progress for /study-session; `goalMinutes` null = no goal set. */
export interface FocusGoalDto {
  goalMinutes: number | null;
  /** Sum of today's COMPLETED session focus, rounded to minutes (no min-focus filter). */
  focusMinutesToday: number;
}
export type DailyNextActionKind = "START_TASK" | "ADD_TASK" | "DAY_COMPLETE";

export interface DailyNextActionDto {
  kind: DailyNextActionKind;
  title: string;
  message: string;
  taskId: string | null;
}

/** Composite panel payload — one request → whole daily hub. */
export interface TodayPanelResponse {
  greetingName: string;
  /** Rule-based, backend-localized motivational line (no AI on this surface). */
  motivationalLine: string;
  /** `null` when no exam type / no authoritative date (see CountdownDto). */
  countdown: CountdownDto | null;
  streak: StreakSummaryDto;
  tasks: PlanTaskDto[];
  /** Single rule-based step selected by the backend from today's ordered tasks. */
  nextAction: DailyNextActionDto;
  sessionPresets: SessionPresetDto[];
  /** Today's mood check-in if the user already checked in, else `null`. */
  mood: MoodCheckinDto | null;
  /** Daily focus goal progress (/study-session idle surface). */
  focusGoal: FocusGoalDto;
  /**
   * Anonymous count of users focusing right now (aggregate-only ambience);
   * null when below the server-side visibility threshold.
   */
  focusingNow: number | null;
  /** Last completed Europe/Istanbul Monday-Sunday period; null without an exam type. */
  weeklyRecapPeriod: {
    /** Backend-resolved exam context for this completed period. */
    examId: string;
    startDate: string;
    endDate: string;
    timeZone: "Europe/Istanbul";
    /** Server-computed evidence status; dashboard suppresses EMPTY without another request. */
    status: WeeklyRecapStatus;
  } | null;
}

/**
 * Career field the user is aiming for — drives the mascot variant on the goal screen. Ten broad
 * fields, NOT individual professions: there are thousands of job titles and one illustration per
 * title is not a thing anyone can draw. A fixed union, never a DB table — these values do not
 * change at runtime, so a reference table + seed + repository would be pure ceremony.
 * Labels live in the web i18n messages, like the exam options.
 */
export const CAREER_GROUPS = [
  "SAGLIK",
  "MUHENDISLIK",
  "YAZILIM",
  "HUKUK_KAMU",
  "EGITIM",
  "ISLETME",
  "SOSYAL_ILETISIM",
  "SANAT_TASARIM",
  "FEN",
  "MIMARLIK",
] as const;
export type CareerGroup = (typeof CAREER_GROUPS)[number];

/**
 * Vision/goal board ("hayal/hedef panosu") — one goal anchor per user. `null` when the user hasn't
 * set a goal yet. `aiNote` is the cached premium AI motivation line (premium-only; null for free /
 * not yet generated).
 *
 * City is stored twice on purpose: `targetCityCode` is the normalized map selection, `targetCity`
 * the legacy/free-text fallback for rows written before the map existed and for goals the province
 * list can't express (abroad, "not listed"). Read rule: prefer the code, fall back to the text.
 */
export interface VisionDto {
  goalTitle: string;
  /** Plate code "01".."81" — set when the user picked a province on the map. */
  targetCityCode: string | null;
  targetCity: string | null;
  /** Always accompanied by `targetCityCode`; the server rejects a mismatched pair. */
  targetUniversityId: string | null;
  /**
   * KPSS side of the goal. The title is the anchor (a permanent civil-service job name); the
   * institution is an optional narrower whose list only covers whoever advertised in the imported
   * round, so it is never required. Which of these three targets applies follows the exam type.
   */
  targetTitleId: string | null;
  targetInstitutionId: string | null;
  careerGroup: CareerGroup | null;
  motivation: string | null;
  aiNote: string | null;
  /**
   * The collage the user designed on `/hedef/pano`; `null` until they open the editor. Carried on
   * this DTO rather than behind its own GET so the panel card and the editor both get it in the
   * single `/coaching/vision` round-trip they already make (no waterfall). Writing it is a
   * separate endpoint — see `PUT /coaching/vision/board`.
   */
  board: VisionBoardDoc | null;
  /**
   * The reference ids above, resolved to display names — derived on read, never stored.
   *
   * Without this every consumer has to fall back to `targetCity`, the legacy free-text column the
   * map never writes, and the goal silently renders without its city. That is the exact bug the AI
   * note already hit; the panel card and the board's seed text read the same field.
   */
  targetNames: {
    cityName: string | null;
    universityName: string | null;
    titleName: string | null;
    institutionName: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------ vision board collage ------------------------------ */

/**
 * The fixed design space every board coordinate lives in. Items store absolute px here and the
 * stage is CSS-scaled to whatever width it gets, so one document renders identically in the
 * editor, in the panel card and in the exported PNG. 3:2 — the wall-pano proportion.
 */
export const VISION_BOARD_CANVAS = { width: 1620, height: 1080 } as const;

/** Outer frame around the whole board. Pure CSS in the DOM, four rects in the canvas export. */
export const VISION_BOARD_FRAMES = ["wood", "gallery", "none"] as const;
export type VisionBoardFrame = (typeof VISION_BOARD_FRAMES)[number];

/** Board backgrounds; textures are procedural (gradients/dots), so canvas can redraw them. */
export const VISION_BOARD_TEXTURES = [
  "cork",
  "paper",
  "grid",
  "linen",
  "dots",
  "stripes",
] as const;
export type VisionBoardTexture = (typeof VISION_BOARD_TEXTURES)[number];

/** Per-image chrome. A preset enum, not free-form borders — every value must be canvas-drawable. */
export const VISION_IMAGE_FRAMES = [
  "none",
  "polaroid",
  "white",
  "rounded",
  "tape",
] as const;
export type VisionImageFrame = (typeof VISION_IMAGE_FRAMES)[number];

/** Text families. Resolved to concrete `next/font` faces on the client; the document stays abstract. */
export const VISION_TEXT_FONTS = [
  "body",
  "heading",
  "script",
  "serif",
  "rounded",
  "condensed",
  "classic",
  "impact",
  "elegant",
  "slab",
  "mono",
] as const;
export type VisionTextFont = (typeof VISION_TEXT_FONTS)[number];

export const VISION_TEXT_ALIGNS = ["left", "center", "right"] as const;
export type VisionTextAlign = (typeof VISION_TEXT_ALIGNS)[number];

/**
 * Built-in sticker art. A closed enum, never a URL or a storage key: the board document is
 * rendered as-is, so an arbitrary src field would be an image-injection hole. Ten career Puhus +
 * five Puhu expressions (mascot art shipped under `public/mascot/career/` and `public/mascot/puhu/`),
 * thirteen shapes, plus forty-nine stickers cut from four Illustrator collages under
 * `public/img/sticker*.svg` (22 stationery/paper + 11 + 8 vision-board scene stickers + 8 aesthetic
 * stickers, several with their own baked-in text) — see docs/features/coaching.md for how.
 * Append-only — removing a value orphans it inside somebody's saved board.
 */
export const VISION_STICKERS = [
  "MASCOT_SAGLIK",
  "MASCOT_MUHENDISLIK",
  "MASCOT_YAZILIM",
  "MASCOT_HUKUK_KAMU",
  "MASCOT_EGITIM",
  "MASCOT_ISLETME",
  "MASCOT_SOSYAL_ILETISIM",
  "MASCOT_SANAT_TASARIM",
  "MASCOT_FEN",
  "MASCOT_MIMARLIK",
  "STAR",
  "HEART",
  "SPARKLE",
  "ARROW",
  "PIN",
  "PUHU_HAPPY",
  "PUHU_PROUD",
  "PUHU_ENCOURAGING",
  "PUHU_SURPRISED",
  "PUHU_SLEEPY",
  "TARGET",
  "FLAG",
  "CHECK",
  "TROPHY",
  "ROCKET",
  "GRADCAP",
  "CROWN",
  "LIGHTNING",
  "CARD_STACKED_RED",
  "PAPER_LINED_TAN",
  "PAPER_GRID",
  "CARD_PLAIN_BROWN",
  "PAPER_LINED_VERTICAL",
  "NOTEPAD_SPIRAL",
  "CARD_BLANK_PINK",
  "CARD_BLANK_LARGE",
  "TAPE_HATCHED",
  "TAPE_DIAGONAL",
  "TAPE_STRIP_CREAM",
  "TAPE_STRIP_PLAIN",
  "TAPE_STRIP_TAN",
  "NOTEPAD_HOLES_FOLD",
  "FABRIC_PLAID_PEACH",
  "NOTEPAD_LINED_RED",
  "FRAME_POLAROID",
  "PAPER_DOTGRID_DARK",
  "TAPE_CORAL",
  "NOTEPAD_SPIRAL_SMALL",
  "TAPE_CHECKERED",
  "CARD_ROUNDED_OLIVE",
  "STAR_OUTLINE_1",
  "STAR_OUTLINE_2",
  "SPARKLE_CROSS",
  "SPARKLE_DASH",
  "RAINBOW_SQUIGGLE",
  "SCENE_DREAM_BIG",
  "CARD_TRAVEL",
  "CARD_INSPIRATION",
  "CARD_GOALS",
  "CARD_VISION_BOARD",
  "HEART_LOVE",
  "FLOWER_FRAME_TODO",
  "FRAME_IMPORTANT",
  "NOTEPAD_NOTES",
  "CLOUD_TODAY",
  "BADGE_VISION_BOARD",
  "OVAL_ACTIVITY",
  "CORNER_DOODLES",
  "ACCENT_SCATTER",
  "CAP_FLAT",
  "STATUE_TORSO_ROSES",
  "TV_RETRO",
  "PHOTO_VINTAGE_REDACTED",
  "LIGHTBULB_VINTAGE",
  "SUNGLASSES_HEART",
  "DIAMOND_GEM",
  "COTTON_CANDY_HAND",
] as const;
export type VisionSticker = (typeof VISION_STICKERS)[number];

/** Geometry shared by every item. `z` is the paint order; ties break on array index. */
export interface VisionBoardItemBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, -180..180. The slight tilt is what makes a grid of photos read as a collage. */
  rotation: number;
  opacity: number;
  z: number;
}

export interface VisionBoardImageItem extends VisionBoardItemBase {
  kind: "image";
  /** R2 key under `vision-board/{userId}/`; the server rejects anyone else's prefix. */
  storageKey: string;
  frame: VisionImageFrame;
  /**
   * Read-only, added by the server on every read and stripped by the write schema — never stored.
   *
   * The client cannot build this itself: R2 returns an absolute CDN URL while the dev fake storage
   * returns an API-relative path, so there is no base a `NEXT_PUBLIC_` var could carry. Round-trip
   * it back on save if you like; `visionBoardDocSchema` drops it.
   */
  url?: string;
}

/**
 * Styling is per block, not per character. That constraint is load-bearing: it is why the canvas
 * exporter can stay a plain measure-and-fill loop and still match the DOM exactly. Adding inline
 * runs means writing a text engine twice.
 */
export interface VisionBoardTextItem extends VisionBoardItemBase {
  kind: "text";
  text: string;
  font: VisionTextFont;
  /** px in canvas space. */
  size: number;
  color: string;
  bold: boolean;
  italic: boolean;
  align: VisionTextAlign;
  lineHeight: number;
  letterSpacing: number;
  /** The dark label plate behind quotes/tags. `null` = transparent text. */
  background: {
    color: string;
    opacity: number;
    padding: number;
    radius: number;
  } | null;
  /**
   * Set on the block seeded from the goal itself. Cleared the moment the user edits it, which is
   * how a later goal change knows it may refresh this text without overwriting their words.
   */
  source?: "goal";
}

export interface VisionBoardStickerItem extends VisionBoardItemBase {
  kind: "sticker";
  asset: VisionSticker;
}

export type VisionBoardItem =
  | VisionBoardImageItem
  | VisionBoardTextItem
  | VisionBoardStickerItem;

export type VisionBoardStatus = "DRAFT" | "PUBLISHED";

/**
 * The whole collage. `status` lives inside the document rather than in its own column because no
 * query filters on it yet; `version` is the migration handle for when the item shape changes.
 */
export interface VisionBoardDoc {
  version: 1;
  status: VisionBoardStatus;
  frame: VisionBoardFrame;
  background:
    | { kind: "color"; value: string }
    | { kind: "texture"; value: VisionBoardTexture };
  items: VisionBoardItem[];
}

/** Presigned direct-to-R2 upload for one board photo. */
export interface VisionBoardImageUploadUrlDto {
  uploadUrl: string;
  key: string;
  expiresAt: string;
  maxBytes: number;
}

/** Completed-week rule-based review (Europe/Istanbul, active exam scoped). */
export type WeeklyReviewStatus = "READY" | "INSUFFICIENT";
export type WeeklyRecapStatus = "EMPTY" | "PARTIAL" | "READY";
export type WeeklyEnergySignal = "LOW" | "MIXED" | "STEADY";
export type WeeklyFocusTimeBandId =
  | "MORNING"
  | "AFTERNOON"
  | "EVENING"
  | "NIGHT";
export type WeeklyRecapTitleId =
  | "BALANCE_MASTER"
  | "RHYTHM_GUARDIAN"
  | "FOCUS_DIVER"
  | "PLAN_ARCHITECT"
  | "SUBJECT_EXPLORER"
  | "MOCK_BRAVE"
  | "FOCUS_TRAVELER";
export type WeeklyRecapComparisonMetric =
  | "ACTIVE_DAYS"
  | "FOCUS_MINUTES"
  | "COMPLETED_TASKS"
  | "LONGEST_SESSION";
export type WeeklyRecapNextStorySignalKind =
  | "FOCUS_SESSION"
  | "PLAN_TASK"
  | "MOCK_EXAM";
export interface WeeklyRecapNextStorySignalDto {
  kind: WeeklyRecapNextStorySignalKind;
  /** Backend-localized, non-shaming curiosity heading. */
  title: string;
  /** Backend-localized explanation of what can appear in a future recap. */
  message: string;
}
export interface WeeklyRecapTitleDto {
  id: WeeklyRecapTitleId;
  /** Backend-localized adventure title. */
  label: string;
  /** Backend-localized evidence explanation. */
  message: string;
}
export type WeeklyRecapHighlightDto =
  | {
      kind: "POSITIVE_COMPARISON";
      metric: WeeklyRecapComparisonMetric;
      current: number;
      previous: number;
      delta: number;
      message: string;
    }
  | { kind: "LONGEST_SESSION"; minutes: number; message: string }
  | {
      kind: "TOP_FOCUS_SUBJECT";
      subjectRef: string;
      subjectName: string;
      focusMinutes: number;
      message: string;
    }
  | {
      kind: "TOP_PLAN_SUBJECT";
      subjectRef: string;
      subjectName: string;
      completedTaskCount: number;
      message: string;
    }
  | {
      kind: "PEAK_FOCUS_DAY";
      date: string;
      focusMinutes: number;
      message: string;
    }
  | {
      kind: "COMPLETED_TASKS";
      completedTaskCount: number;
      message: string;
    }
  | { kind: "MOCK_EXAMS"; mockExamCount: number; message: string };
export type WeeklyFocusSource =
  | "REPEATED_PHOTO_SIGNAL"
  | "WEEKLY_DECLINE"
  | "LOWEST_NORMALIZED"
  | "SESSION_RHYTHM";

export interface WeeklyReviewDto {
  period: { startDate: string; endDate: string; timeZone: "Europe/Istanbul" };
  status: WeeklyReviewStatus;
  recap: {
    status: WeeklyRecapStatus;
    activeDays: number;
    /** Deterministic, ephemeral title for READY recaps; never persisted as inventory. */
    weeklyTitle: WeeklyRecapTitleDto | null;
    /** Backward-compatible first future story signal for PARTIAL recaps; null otherwise. */
    nextStorySignal: WeeklyRecapNextStorySignalDto | null;
    /** Every server-selected future story signal for PARTIAL recaps, in display order. */
    nextStorySignals: WeeklyRecapNextStorySignalDto[];
    /** Backend-localized deterministic Puhu closing line. */
    closingMessage: string;
  };
  evidence: {
    mockExamCount: number;
    /** Retained for backward compatibility; equals qualifyingSessionCount. */
    completedSessionCount: number;
    qualifyingSessionCount: number;
    completedPlanTaskCount: number;
  };
  rhythm: {
    completedSessionCount: number;
    focusMinutes: number;
    activeDays: number;
    longestSessionMinutes: number;
    longestActiveRun: number;
    /** Strongest Istanbul time band among qualifying sessions. */
    focusTimeBand: {
      id: WeeklyFocusTimeBandId;
      label: string;
      focusMinutes: number;
      qualifyingSessionCount: number;
      message: string;
    } | null;
    /** Strongest qualifying-focus day, independent of highlight selection. */
    peakFocusDay: {
      date: string;
      focusMinutes: number;
      message: string;
    } | null;
    days: Array<{ date: string; active: boolean }>;
    /** Only content-taxonomy matched aggregate session subjects. */
    subjectBreakdown: Array<{
      subjectRef: string;
      subjectName: string;
      focusMinutes: number;
      qualifyingSessionCount: number;
    }>;
    moodCheckinCount: number;
    energySignal: WeeklyEnergySignal | null;
    message: string;
  };
  plan: {
    completedTaskCount: number;
    /** Only content-taxonomy matched aggregate subjects; never task titles. */
    subjectBreakdown: Array<{
      subjectRef: string;
      subjectName: string;
      completedTaskCount: number;
    }>;
    /** Backend-localized aggregate summary. */
    message: string;
  };
  /** Server-selected, localized best-of-week facts in display order (max 2). */
  highlights: WeeklyRecapHighlightDto[];
  performance: {
    mockExamCount: number;
    averageNet: string;
    previousWeekAverageNet: string | null;
    delta: string | null;
    evidenceLevel: "EARLY" | "COMPARABLE";
    message: string;
  } | null;
  focus: {
    source: WeeklyFocusSource;
    subjectRef: string | null;
    subjectName: string | null;
    message: string;
  } | null;
  suggestedTask: { title: string; subject: string | null } | null;
}

export interface WeeklyReviewCompletionDto {
  examId: string;
  weekStart: string;
  completedAt: string;
}

/* ------------------------------ mistake notebook ------------------------------ */

/**
 * Why the answer was wrong — the one thing a student does *not* already know about their own
 * mistakes. They know the subject and the topic; they do not track whether they keep losing points
 * to carelessness or to a real gap, and that difference is the whole study decision.
 *
 * A closed enum picked with one tap, never an AI output: classifying *why* is the student's own
 * reflection, and §4 #2 keeps the model out of the answer entirely.
 * Append-only — removing a value orphans it inside somebody's saved entry.
 */
export const NOTEBOOK_ERROR_TYPES = [
  "UNKNOWN_TOPIC",
  "CARELESS",
  "MISREAD",
  "DISTRACTOR",
  "TIME",
  "CHANGED_ANSWER",
] as const;
export type NotebookErrorType = (typeof NOTEBOOK_ERROR_TYPES)[number];

/**
 * `ACTIVE` = still in the review rotation · `HEALED` = survived the full interval ladder ·
 * `ARCHIVED` = the student put it away without solving it. Nothing is ever deleted on review —
 * the wall is a healing map, and a healed card staying visible is the point.
 */
export const NOTEBOOK_ENTRY_STATUSES = [
  "ACTIVE",
  "HEALED",
  "ARCHIVED",
] as const;
export type NotebookEntryStatus = (typeof NOTEBOOK_ENTRY_STATUSES)[number];

/**
 * Where the question came from — never what the entry *means*.
 *
 * A community question only enters the book with the user's own "I could not do this either", so a
 * `COMMUNITY` entry counts toward the weakness map exactly like an `OWN` one. Anything they merely
 * found interesting belongs in the forum's bookmarks; letting it in here would make the map
 * describe other people's gaps.
 */
export const NOTEBOOK_SOURCES = ["OWN", "COMMUNITY"] as const;
export type NotebookSource = (typeof NOTEBOOK_SOURCES)[number];

/**
 * A page, not a wall: ISO A4 portrait (210∶297) against the vision board's 3:2. Width stays 1080
 * so existing item X coordinates do not shift; height grew from the old 3:4 (1440) to 1527.
 * Same absolute-px-in-a-fixed-design-space trick as `VISION_BOARD_CANVAS`.
 */
export const NOTEBOOK_PAGE_CANVAS = { width: 1080, height: 1527 } as const;

/** Paper under the items. Procedural like the board textures — CSS gradients, no raster asset. */
export const NOTEBOOK_PAPERS = ["ruled", "grid", "dotted", "plain"] as const;
export type NotebookPaper = (typeof NOTEBOOK_PAPERS)[number];

/**
 * One wrong answer placed on a page. Geometry only — everything the student *said* about the
 * mistake lives on the entry row, because `nextReviewAt` is a cron query and `errorType` is an
 * analysis aggregate. The document holds placement, the table holds meaning.
 */
export interface NotebookEntryItem extends VisionBoardItemBase {
  kind: "entry";
  entryId: string;
}

/** Stickers and text are the vision board's, verbatim — same shapes, same editor hooks. */
export type NotebookPageItem =
  | NotebookEntryItem
  | VisionBoardTextItem
  | VisionBoardStickerItem;

/**
 * The pens. Append-only, same rule as every other enum here — dropping a value orphans it inside
 * somebody's saved page.
 *
 * `fountain` is the odd one out: the other six are velocity/pressure profiles fed to the same
 * outline algorithm, while a fountain nib's width comes from the angle between the stroke and a
 * fixed nib direction. It gets its own maths in `notebook-ink.ts`.
 */
export const NOTEBOOK_INK_TOOLS = [
  "pencil",
  "pen",
  "fineliner",
  "marker",
  "highlighter",
  "brush",
  "fountain",
] as const;
export type NotebookInkTool = (typeof NOTEBOOK_INK_TOOLS)[number];

/**
 * One drawn line, in the page's own 1080×1527 design space — so ink lands where it was drawn at
 * any container width, exactly like every item.
 *
 * The eraser is not a tool that gets stored: it removes whole strokes, so what it leaves behind is
 * a shorter array, not an "erased" record.
 */
export interface NotebookInkStroke {
  id: string;
  tool: NotebookInkTool;
  /** `#rrggbb`. The eraser never reaches here, so there is no "no colour" case. */
  color: string;
  /** Nib width in design-space px, before the tool's own thinning. */
  size: number;
  opacity: number;
  /**
   * Flat `[x, y, pressure, x, y, pressure, …]`.
   *
   * A flat array rather than `{x, y, pressure}[]`: the keys repeat once per sample and a page can
   * hold thousands of them, so objects roughly triple the jsonb this document costs to store, read
   * and re-validate on every autosave.
   */
  points: number[];
}

/**
 * The book's cover, as the student chose it.
 *
 * Colours and materials are named rather than free-form. A colour picker on a bound notebook is a
 * way to end up with a lime green book you regret; a short list is a set of covers that all look
 * like they came off the same shelf.
 */
export const NOTEBOOK_COVER_COLORS = [
  "navy",
  "plum",
  "forest",
  "sand",
  "slate",
  "ink",
] as const;
export type NotebookCoverColor = (typeof NOTEBOOK_COVER_COLORS)[number];

/** How the cover is finished. Each is a CSS recipe, not an image — see `notebook-surface`. */
export const NOTEBOOK_COVER_MATERIALS = [
  "cloth",
  "kraft",
  "leather",
  "matte",
] as const;
export type NotebookCoverMaterial = (typeof NOTEBOOK_COVER_MATERIALS)[number];

/** Title cap: it is printed across a cover, not a field anybody should paste an essay into. */
export const NOTEBOOK_COVER_TITLE_MAX_LENGTH = 40;

export interface NotebookCoverStyle {
  color: NotebookCoverColor;
  material: NotebookCoverMaterial;
}

/** @deprecated Book metadata now carries title separately. */
export type NotebookCoverDoc = NotebookCoverStyle & { title?: string | null };

export const NOTEBOOK_KINDS = ["MISTAKE", "CUSTOM"] as const;
export type NotebookKind = (typeof NOTEBOOK_KINDS)[number];

export interface NotebookSummaryDto {
  id: string;
  kind: NotebookKind;
  examId: string | null;
  subjectRef: string | null;
  subjectName: string | null;
  /** Null only for the system notebook; clients render their translated default title. */
  title: string | null;
  cover: NotebookCoverStyle;
  pageCount: number;
  /** Populated for the system notebook and zero for custom notebooks. */
  dueCount: number;
  updatedAt: string;
}

export interface NotebookDto extends NotebookSummaryDto {
  createdAt: string;
}

export interface CreateNotebookInput {
  title: string;
  examId?: string | null;
  subjectRef?: string | null;
  cover: NotebookCoverStyle;
}

export interface UpdateNotebookInput {
  title?: string | null;
  examId?: string | null;
  subjectRef?: string | null;
  cover?: NotebookCoverStyle;
}

export interface NotebookPageDoc {
  version: 1;
  paper: NotebookPaper;
  items: NotebookPageItem[];
  /**
   * Freehand ink, a sibling of `items` rather than another item kind.
   *
   * As an item it would burn one of the page's forty slots per stroke, carry a
   * `VisionBoardItemBase` geometry it never uses, and — because the stage hands every item to the
   * gesture layer — become draggable, which ink on paper is not. As its own field it is one flat
   * list rendered as one SVG layer.
   *
   * The cost of that choice: a single layer has a single depth, and it sits above every item. You
   * cannot slide a sticker over ink you already drew. Neither can you on paper.
   */
  ink: NotebookInkStroke[];
}

export interface NotebookEntryDto {
  id: string;
  /** Null for a mistake caught outside a mock exam — most of them are. */
  mockExamId: string | null;
  storageKey: string | null;
  /** Read-only, server-added on every read and dropped by the write schema — never stored. */
  url: string | null;
  subjectRef: string | null;
  subjectName: string | null;
  topicRef: string | null;
  topicName: string | null;
  errorType: NotebookErrorType;
  note: string | null;
  /**
   * The answer the student recorded for this mistake — the back of the flashcard. Both halves are
   * optional and independent: a photographed answer key with no words, a one-line "should have used
   * the other formula" with no photo, or neither.
   */
  solutionStorageKey: string | null;
  /** Read-only, server-added on every read and dropped by the write schema — never stored. */
  solutionUrl: string | null;
  solutionNote: string | null;
  status: NotebookEntryStatus;
  reviewCount: number;
  lastReviewedAt: string | null;
  /** Null once `HEALED`/`ARCHIVED` — the row leaves the due query by having no due date. */
  nextReviewAt: string | null;
  source: NotebookSource;
  /** Soft ref to the forum thread this mistake was asked in; null until the user asks. */
  communityThreadId: string | null;
  /** Set when the asker accepted an answer — the card has a verified solution waiting. */
  communityAnsweredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Cover screen payload: enough to render the cover and the "bugün tekrar" strip, nothing more. */
export interface NotebookOverviewDto {
  notebook: NotebookSummaryDto;
  pageCount: number;
  entryCount: number;
  dueCount: number;
  healedCount: number;
}

export interface NotebookPageDto {
  pageIndex: number;
  doc: NotebookPageDoc;
  /** Only the entries this page's items reference, hydrated for rendering. */
  entries: NotebookEntryDto[];
}

/**
 * Premium vision pre-labelling. Classification only, same whitelist-bounded prompt as the retired
 * standalone card (§4 #2) — the student confirms or corrects it with one tap.
 */
export interface NotebookPrelabelDto {
  subjectRef: string | null;
  subjectName: string | null;
  topicRef: string | null;
  topicName: string | null;
}

/** Presigned direct-to-R2 upload for one notebook photo. */
export interface NotebookImageUploadUrlDto {
  uploadUrl: string;
  key: string;
  expiresAt: string;
  maxBytes: number;
}
