"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useAdvertisingConsent } from "@/lib/advertising-consent";
import { isPublicConsentBannerPath } from "@/lib/consent-banner-path";
import type { ConsentContextValue } from "@/lib/analytics-consent";

export function CookieConsentBanner({ analytics, analyticsHydrated, analyticsEnabled }: {
  analytics: ConsentContextValue;
  analyticsHydrated: boolean;
  analyticsEnabled: boolean;
}) {
  const t = useTranslations("consentBanner");
  const ads = useAdvertisingConsent();
  const pathname = usePathname();
  const showAnalytics = analyticsEnabled && analyticsHydrated && analytics.consent === null && isPublicConsentBannerPath(pathname);
  const showAdvertising = ads.hydrated && ads.consent === null && pathname.startsWith("/knowledge/");
  if (!showAnalytics && !showAdvertising) return null;

  return (
    <section role="dialog" aria-label={t(showAdvertising ? "choices_title" : "title")} className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-2xl rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-lg">
      <h2 className="font-bold text-[var(--color-main)] font-[family-name:var(--font-heading)]">{t(showAdvertising ? "choices_title" : "title")}</h2>
      {showAnalytics && <Choice title={t("analytics_title")} body={t("body")} accept={analytics.accept} reject={analytics.reject} />}
      {showAdvertising && <Choice title={t("advertising_title")} body={t("advertising_body")} accept={ads.accept} reject={ads.reject} />}
      {ads.saveFailed && <p role="alert" className="mt-2 text-sm text-[var(--color-secondary)]">{t("save_failed")}</p>}
      <Link className="mt-3 inline-block text-sm text-[var(--color-main)] underline" href="/cookie-preferences">{t("details")}</Link>
    </section>
  );
}

function Choice({ title, body, accept, reject }: { title: string; body: string; accept: () => void; reject: () => void }) {
  const t = useTranslations("consentBanner");
  return <section aria-label={title} className="mt-3">
    <h3 className="text-sm font-semibold text-[var(--color-main)]">{title}</h3>
    <p className="mt-1 text-sm leading-relaxed text-[var(--color-secondary)]">{body}</p>
    <div className="mt-2 flex flex-wrap justify-end gap-2">
      <button type="button" onClick={reject} className="min-h-11 rounded-[var(--radius-card)] border px-4 text-sm font-semibold text-[var(--color-main)]">{t("reject")}</button>
      <button type="button" onClick={accept} className="min-h-11 rounded-[var(--radius-card)] bg-[var(--color-btn)] px-4 text-sm font-bold text-[var(--color-btn-label)]">{t("accept")}</button>
    </div>
  </section>;
}
