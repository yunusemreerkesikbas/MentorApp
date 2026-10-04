"use client";

import { useTranslations } from "next-intl";

import { useAnalyticsConsent } from "@/lib/analytics-consent";

export function CookiePreferencesContent() {
  const translate = useTranslations("analyticsConsent");
  const { consent, accept, reject } = useAnalyticsConsent();

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 lg:px-8 lg:py-10">
      <h1 className="text-3xl font-bold" style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}>{translate("page_title")}</h1>
      <p className="mt-4 leading-relaxed" style={{ color: "var(--color-secondary)" }}>{translate("page_body")}</p>
      <section className="mt-7 space-y-5">
        <div><h2 className="text-lg font-bold text-[var(--color-main)]">{translate("essential_heading")}</h2><p className="mt-2 leading-relaxed text-[var(--color-secondary)]">{translate("essential_body")}</p></div>
        <div><h2 className="text-lg font-bold text-[var(--color-main)]">{translate("storage_heading")}</h2><p className="mt-2 leading-relaxed text-[var(--color-secondary)]">{translate("storage_body")}</p></div>
        <div><h2 className="text-lg font-bold text-[var(--color-main)]">{translate("analytics_heading")}</h2><p className="mt-2 leading-relaxed text-[var(--color-secondary)]">{translate("analytics_body")}</p></div>
      </section>
      <p className="mt-3 text-sm" style={{ color: "var(--color-secondary)" }}>{translate("current", { value: translate(consent === "accepted" ? "accepted" : consent === "rejected" ? "rejected" : "unset") })}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={reject} className="min-h-11 rounded-[var(--radius-card)] border border-[var(--color-border)] px-4 font-semibold text-[var(--color-main)]">{translate("reject")}</button>
        <button type="button" onClick={accept} className="min-h-11 rounded-[var(--radius-card)] px-4 font-bold text-[var(--color-btn-label)]" style={{ backgroundColor: "var(--color-btn)" }}>{translate("accept")}</button>
      </div>
    </main>
  );
}
