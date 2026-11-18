import type {
  CoachAccessMode,
  CoachPlanAdaptationSource,
  DailyNextActionKind,
  WeeklyRecapStatus,
  CoachIntent,
  CoachTone,
  CoachEvidenceType,
  CoachActionType,
  CoachActionStatus,
  StudyRoomTheme,
} from "@mentor/types";
import type { ForumCoachIntent } from "@mentor/types";
import type { WeeklyRecapSlideKind } from "./weekly-recap";

export const ANALYTICS_CONSENT_KEY = "mentor.analytics-consent.v1";

export type ArticleAnalyticsEvent =
  | "article_view"
  | "article_read_complete"
  | "article_source_click"
  | "article_coach_cta_click";

export interface ArticleAnalyticsParams {
  slug: string;
  exam_family: string;
  category: string;
  locale: string;
}

type WebVitalName = "CLS" | "FCP" | "INP" | "LCP" | "TTFB";
type WebVitalRating = "good" | "needs-improvement" | "poor";

export type SeoLpSlug = "pomodoro" | "yks" | "tyt" | "lgs" | "notebook" | "study_app";

export interface ProductAnalyticsParams {
  login: { method: "email" | "google" };
  /**
   * `intent` splits the coach funnel from the student one (APP-089). Coaches drop off at a
   * different step (their profile, not a study goal), so a single undifferentiated sign_up count
   * would average two funnels that fail for unrelated reasons.
   */
  sign_up: { method: "email" | "google"; intent?: "student" | "coach"; lp_source?: SeoLpSlug };
  /** Waitlist join: the acquisition conversion while signup is invite-only. Never carries the address. */
  generate_lead: { lead_source: "waitlist"; intent: "student" | "coach"; lp_source?: SeoLpSlug };
  tutorial_begin: Record<string, never>;
  tutorial_complete: Record<string, never>;
  begin_checkout: {
    currency: "TRY";
    value: number;
    items: Array<{
      item_id: string;
      item_name: string;
      item_category: "subscription";
      price: number;
      quantity: 1;
    }>;
  };
  purchase: {
    currency: "TRY";
    surface: "checkout_result";
  };
  web_vital: {
    metric_name: WebVitalName;
    metric_value: number;
    metric_rating: WebVitalRating;
    navigation_type: string;
  };
}
export type ProductAnalyticsEvent = keyof ProductAnalyticsParams;

export interface SeoLpAnalyticsParams {
  pomodoro_start: {
    preset: "25_5" | "50_10" | "custom" | "stopwatch";
    room: StudyRoomTheme;
  };
  pomodoro_complete: {
    preset: "25_5" | "50_10" | "custom" | "stopwatch";
    room: StudyRoomTheme;
  };
  signup_from_pomodoro_lp: {
    location: "hero" | "table" | "timer_done" | "closing";
  };
  plan_demo_view: {
    lp: "yks" | "tyt" | "lgs";
  };
  plan_cta_click: {
    lp: "yks" | "tyt" | "lgs";
    location: "hero" | "demo" | "table" | "closing" | "parent";
  };
  signup_from_yks_lp: {
    location: "hero" | "demo" | "table" | "closing";
  };
  signup_from_tyt_lp: {
    location: "hero" | "demo" | "table" | "closing";
  };
  signup_from_lgs_lp: {
    location: "hero" | "demo" | "table" | "closing" | "parent";
  };
  notebook_demo_view: {
    page_type: "mistake_notebook";
  };
  notebook_cta_click: {
    placement: "hero" | "demo" | "how" | "closing";
    page_type: "mistake_notebook";
  };
  category_cta_click: {
    placement: "hero" | "features" | "closing";
    page_type: "study_app";
  };
}
export type SeoLpAnalyticsEvent = keyof SeoLpAnalyticsParams;

const WEB_VITAL_NAMES = new Set<WebVitalName>([
  "CLS",
  "FCP",
  "INP",
  "LCP",
  "TTFB",
]);

export function toWebVitalAnalyticsParams(metric: {
  name: string;
  value: number;
  rating: WebVitalRating;
  navigationType: string;
}): ProductAnalyticsParams["web_vital"] | null {
  if (!WEB_VITAL_NAMES.has(metric.name as WebVitalName)) return null;
  const name = metric.name as WebVitalName;
  return {
    metric_name: name,
    metric_value: Math.round(
      name === "CLS" ? metric.value * 1000 : metric.value,
    ),
    metric_rating: metric.rating,
    navigation_type: metric.navigationType,
  };
}

export interface CoachAnalyticsParams {
  coach_hub_view: {
    access_mode: CoachAccessMode;
    next_action_kind: DailyNextActionKind;
  };
  coach_next_action_impression: {
    surface: "dashboard" | "coach";
    next_action_kind: DailyNextActionKind;
  };
  coach_next_action_click: {
    surface: "dashboard" | "coach";
    next_action_kind: DailyNextActionKind;
  };
  coach_session_start: { source: "dashboard" | "coach" };
  coach_community_message_sent: {
    zone_type: "CHAT" | "QA";
    intent: ForumCoachIntent;
    access_mode: CoachAccessMode;
  };
  coach_community_task_added: {
    zone_type: "CHAT" | "QA";
    intent: ForumCoachIntent;
  };
  coach_community_return_click: {
    zone_type: "CHAT" | "QA";
    intent: ForumCoachIntent;
  };
  coach_community_task_completed: {
    zone_type: "CHAT" | "QA";
    intent: ForumCoachIntent;
  };
  coach_community_completion_return_click: {
    zone_type: "CHAT" | "QA";
    intent: ForumCoachIntent;
  };
  coach_community_return_reply_created: {
    zone_type: "CHAT" | "QA";
    intent: ForumCoachIntent;
  };
  coach_plan_adaptation_request: { source: CoachPlanAdaptationSource };
  coach_plan_adaptation_apply: {
    source: CoachPlanAdaptationSource;
    move_count: number;
    add_count: number;
  };
  coach_v2_reply: {
    intent: CoachIntent;
    tone: CoachTone;
    evidence_types: CoachEvidenceType[];
  };
  coach_v2_feedback: {
    intent: CoachIntent;
    tone: CoachTone;
    feedback: "UP" | "DOWN" | "CLEARED";
  };
  coach_v2_action: {
    action_type: CoachActionType;
    status: CoachActionStatus | "IMPRESSION";
  };
  coach_v2_memory_management: {
    operation: "ENABLE" | "PAUSE" | "EDIT" | "FORGET" | "CLEAR_ALL";
  };
}
export type CoachAnalyticsEvent = keyof CoachAnalyticsParams;

type CommunityZoneType = "CHAT" | "QA" | "ANNOUNCEMENT";

export interface CommunityAnalyticsParams {
  community_hub_view: { surface: "community" };
  forum_composer_open: { mode: "share" | "question" };
  forum_thread_created: {
    mode: "share" | "question";
    zone_type: CommunityZoneType;
    tag_count: number;
  };
  forum_reply_created: {
    target: "thread" | "post";
    zone_type: CommunityZoneType;
  };
  forum_thread_view: {
    zone_type: CommunityZoneType;
    answered: boolean;
  };
  forum_feed_tab_selected: {
    sort: "trending" | "recent" | "top";
    scope: "relevant" | "following";
  };
  forum_feed_kind_selected: {
    kind: "all" | "posts" | "questions" | "waiting";
  };
  forum_coach_bridge_impression: {
    zone_type: "CHAT" | "QA";
    intent: ForumCoachIntent;
  };
  forum_coach_bridge_click: {
    zone_type: "CHAT" | "QA";
    intent: ForumCoachIntent;
  };
}
export type CommunityAnalyticsEvent = keyof CommunityAnalyticsParams;

type WeeklyRecapAnalyticsStatus = WeeklyRecapStatus | "UNKNOWN";
type WeeklyRecapEntrySurface = "analysis" | "dashboard";

interface WeeklyRecapBaseParams {
  surface: WeeklyRecapEntrySurface | "recap";
  recap_status: WeeklyRecapAnalyticsStatus;
}

export interface WeeklyRecapAnalyticsParams {
  weekly_recap_teaser_impression: WeeklyRecapBaseParams & {
    surface: WeeklyRecapEntrySurface;
  };
  weekly_recap_open: WeeklyRecapBaseParams & {
    surface: WeeklyRecapEntrySurface;
  };
  weekly_recap_slide_view: WeeklyRecapBaseParams & {
    surface: "recap";
    slide_kind: WeeklyRecapSlideKind;
  };
  weekly_recap_complete: WeeklyRecapBaseParams & { surface: "recap" };
  weekly_recap_plan_click: WeeklyRecapBaseParams & { surface: "recap" };
  weekly_recap_ai_unlock: WeeklyRecapBaseParams & { surface: "recap" };
  weekly_recap_share: WeeklyRecapBaseParams & { surface: "recap" };
}
export type WeeklyRecapAnalyticsEvent = keyof WeeklyRecapAnalyticsParams;

export interface MentorshipWeeklyReportAnalyticsParams {
  mentorship_weekly_report_view: {
    surface: "student_report";
    has_previous_activity: boolean;
  };
  mentorship_weekly_brief_request: {
    surface: "student_report";
  };
  mentorship_weekly_report_finalize: {
    surface: "student_report";
    has_brief: boolean;
    has_coach_evaluation: boolean;
  };
  mentorship_weekly_report_print_open: {
    surface: "print_preview";
  };
  mentorship_weekly_report_pdf_download: {
    surface: "print_preview";
  };
}
export type MentorshipWeeklyReportAnalyticsEvent =
  keyof MentorshipWeeklyReportAnalyticsParams;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export const queueGoogleTagCommand: NonNullable<Window["gtag"]> = function () {
  // eslint-disable-next-line prefer-rest-params -- Google interprets arrays as method calls, not gtag commands.
  window.dataLayer?.push(arguments);
};

function trackEvent(event: string, params: object): void {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(ANALYTICS_CONSENT_KEY) !== "accepted") return;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = window.gtag ?? queueGoogleTagCommand;
  window.gtag?.("event", event, params);
}

export function trackAnalysisAction(params: {
  action: "plan" | "notebook" | "coach";
  focusSource: "PHOTO_SIGNAL" | "LOWEST_AVERAGE";
  cycleState: "signal" | "planned" | "practiced" | "measured" | "closed";
}): void {
  trackEvent("analysis_action", {
    action: params.action,
    focus_source: params.focusSource,
    cycle_state: params.cycleState,
  });
}

export function trackArticleEvent(
  event: ArticleAnalyticsEvent,
  params: ArticleAnalyticsParams,
): void {
  trackEvent(event, params);
}

/** Consent-gated acquisition, activation and real-user performance events. */
export function trackProductEvent<Event extends ProductAnalyticsEvent>(
  event: Event,
  params: ProductAnalyticsParams[Event],
): void {
  trackEvent(event, params);
}

/** Consent-gated product-led SEO landing page events (Pomodoro, YKS, TYT, LGS). */
export function trackSeoLpEvent<Event extends SeoLpAnalyticsEvent>(
  event: Event,
  params: SeoLpAnalyticsParams[Event],
): void {
  trackEvent(event, params);
}

/** Consent-gated coach events. Payload types intentionally exclude task/user content. */
export function trackCoachEvent<Event extends CoachAnalyticsEvent>(
  event: Event,
  params: CoachAnalyticsParams[Event],
): void {
  trackEvent(event, params);
}

/** Consent-gated community events. Payload types exclude content and user identifiers. */
export function trackCommunityEvent<Event extends CommunityAnalyticsEvent>(
  event: Event,
  params: CommunityAnalyticsParams[Event],
): void {
  trackEvent(event, params);
}

/** Consent-gated recap events. Types prohibit content, identifiers and numeric performance data. */
export function trackWeeklyRecapEvent<Event extends WeeklyRecapAnalyticsEvent>(
  event: Event,
  params: WeeklyRecapAnalyticsParams[Event],
): void {
  trackEvent(event, params);
}

/** Consent-gated weekly-report events. Types exclude identities, report content and metrics. */
export function trackMentorshipWeeklyReportEvent<
  Event extends MentorshipWeeklyReportAnalyticsEvent,
>(event: Event, params: MentorshipWeeklyReportAnalyticsParams[Event]): void {
  trackEvent(event, params);
}
