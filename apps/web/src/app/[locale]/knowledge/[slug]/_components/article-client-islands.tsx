"use client";

import { useEffect, useRef } from "react";
import { Link } from "@/i18n/navigation";
import { trackArticleEvent, type ArticleAnalyticsParams } from "@/lib/analytics";
import { useAuth } from "@/lib/auth-context";
import { recordArticleView } from "@/lib/content-api";

export function ArticleViewTracker({
  articleSlug,
  analyticsParams,
}: {
  articleSlug: string;
  analyticsParams: ArticleAnalyticsParams;
}) {
  const readSentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trackView = () => trackArticleEvent("article_view", analyticsParams);
    trackView();
    void recordArticleView(articleSlug);
    window.addEventListener("mentor:analytics-consent", trackView);
    return () => window.removeEventListener("mentor:analytics-consent", trackView);
  }, [analyticsParams, articleSlug]);

  useEffect(() => {
    const sentinel = readSentinel.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      trackArticleEvent("article_read_complete", analyticsParams);
      observer.disconnect();
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [analyticsParams]);

  return <div ref={readSentinel} aria-hidden />;
}

export function ArticleSourceLink({
  source,
  sourceUrl,
  analyticsParams,
}: {
  source: string;
  sourceUrl: string;
  analyticsParams: ArticleAnalyticsParams;
}) {
  return (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackArticleEvent("article_source_click", analyticsParams)}
      className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2"
      style={{ color: "var(--color-secondary)" }}
    >
      {source} ↗
    </a>
  );
}

export function ArticleCoachCta({
  articleSlug,
  coachSeed,
  authenticatedLabel,
  anonymousLabel,
  analyticsParams,
}: {
  articleSlug: string;
  coachSeed: string;
  authenticatedLabel: string;
  anonymousLabel: string;
  analyticsParams: ArticleAnalyticsParams;
}) {
  const { status } = useAuth();
  const authenticated = status === "authenticated";

  return (
    <Link
      href={
        authenticated
          ? {
              pathname: "/coach/chat",
              query: { seed: coachSeed, contextArticleSlug: articleSlug },
            }
          : "/login"
      }
      className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[var(--radius-card)] px-5 py-2 text-sm font-bold text-[var(--color-btn-label)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
      style={{
        backgroundColor: "var(--color-btn)",
        fontFamily: "var(--font-heading)",
      }}
      onClick={() => trackArticleEvent("article_coach_cta_click", analyticsParams)}
    >
      {authenticated ? authenticatedLabel : anonymousLabel}
    </Link>
  );
}
