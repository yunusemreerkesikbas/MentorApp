"use client";

import { useLayoutEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import { Link, usePathname } from "@/i18n/navigation";
import { isPublicConsentBannerPath } from "@/lib/consent-banner-path";
import type { ConsentContextValue } from "@/lib/analytics-consent";
import { useAuth } from "@/lib/auth-context";

/**
 * Compact analytics card: title, one sentence, then Kabul et · Reddet · Ayrıntılar on one row.
 * Both choices are the same size so refusing is as easy as accepting. The landing restyles the
 * card as a taped paper note (`city-stage.css`).
 */
export function CookieConsentBanner({ analytics, analyticsHydrated, analyticsEnabled }: {
  analytics: ConsentContextValue;
  analyticsHydrated: boolean;
  analyticsEnabled: boolean;
}) {
  const t = useTranslations("consentBanner");
  const pathname = usePathname();
  const { status } = useAuth();
  const showAnalytics = status === "anonymous" && analyticsEnabled && analyticsHydrated && analytics.consent === null && isPublicConsentBannerPath(pathname);
  const ref = useRef<HTMLElement>(null);

  // `--consent-banner-height` on <html> while the card is open, so a page's own bottom UI (the
  // landing's bottom sheet) can sit above it instead of under it.
  useLayoutEffect(() => {
    const card = ref.current;
    if (!showAnalytics || !card) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty("--consent-banner-height", `${card.offsetHeight}px`));
    observer.observe(card);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--consent-banner-height");
    };
  }, [showAnalytics]);

  if (!showAnalytics) return null;

  return (
    <section
      ref={ref}
      role="dialog"
      aria-label={t("title")}
      className="cookie-consent-banner fixed inset-x-4 bottom-4 z-[100] rounded-[var(--play-radius)] bg-[var(--color-surface)] px-4 py-3.5 text-caption text-[var(--color-secondary)] shadow-[var(--shadow-overlay)] sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-md sm:px-5"
    >
      <h2 className="text-body-sm font-extrabold text-[var(--color-main)]">{t("title")}</h2>
      <p className="mt-0.5 text-pretty">{t("body")}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={analytics.accept}>{t("accept")}</Button>
        <Button size="sm" variant="secondary" onClick={analytics.reject}>{t("reject")}</Button>
        <Link
          className="cookie-consent-link ml-1 inline-flex min-h-11 items-center text-sm font-bold text-[var(--play-selected-ink)] underline underline-offset-4"
          href="/cookie-preferences"
        >
          {t("details")}
        </Link>
      </div>
    </section>
  );
}
