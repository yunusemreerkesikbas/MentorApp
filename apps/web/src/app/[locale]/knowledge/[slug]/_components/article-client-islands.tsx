"use client";

import { useEffect, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { LEDGE, LEDGE_FILLED } from "@/components/panel/panel-styles";
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
      className="inline-flex items-center gap-0.5 font-extrabold text-[var(--play-selected-ink)] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
    >
      {source}
      <ArrowUpRight className="size-3.5" aria-hidden />
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
      className={`${LEDGE} ${LEDGE_FILLED} w-full shrink-0 sm:w-auto`}
      onClick={() => trackArticleEvent("article_coach_cta_click", analyticsParams)}
    >
      {authenticated ? authenticatedLabel : anonymousLabel}
    </Link>
  );
}
