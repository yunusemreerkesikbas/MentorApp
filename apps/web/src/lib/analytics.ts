import type {
  CoachAccessMode,
  CoachPlanAdaptationSource,
  DailyNextActionKind,
  WeeklyRecapStatus,
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
  coach_plan_adaptation_request: { source: CoachPlanAdaptationSource };
  coach_plan_adaptation_apply: {
    source: CoachPlanAdaptationSource;
    move_count: number;
    add_count: number;
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

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function trackEvent(event: string, params: object): void {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(ANALYTICS_CONSENT_KEY) !== "accepted") return;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag =
    window.gtag ?? ((...args: unknown[]) => window.dataLayer?.push(args));
  window.gtag?.("event", event, params);
}

export function trackArticleEvent(
  event: ArticleAnalyticsEvent,
  params: ArticleAnalyticsParams,
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
