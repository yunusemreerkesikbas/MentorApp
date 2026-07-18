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

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackArticleEvent(
  event: ArticleAnalyticsEvent,
  params: ArticleAnalyticsParams,
): void {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(ANALYTICS_CONSENT_KEY) !== "accepted") return;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = window.gtag ?? ((...args: unknown[]) => window.dataLayer?.push(args));
  window.gtag?.("event", event, params);
}
