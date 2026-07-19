"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAnalyticsConsent } from "@/lib/analytics-consent";

export default function CookiePreferencesPage() {
  const translate = useTranslations("analyticsConsent");
  const { consent, accept, reject } = useAnalyticsConsent();

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-10">
      <Link href="/" className="text-sm font-semibold underline" style={{ color: "var(--color-accent)" }}>{translate("back")}</Link>
      <h1 className="mt-5 text-3xl font-bold" style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}>{translate("page_title")}</h1>
      <p className="mt-4 leading-relaxed" style={{ color: "var(--color-secondary)" }}>{translate("page_body")}</p>
      <p className="mt-3 text-sm" style={{ color: "var(--color-secondary)" }}>{translate("current", { value: translate(consent === "accepted" ? "accepted" : consent === "rejected" ? "rejected" : "unset") })}</p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={reject} className="min-h-11 rounded-[var(--radius-card)] border px-4 font-semibold">{translate("reject")}</button>
        <button type="button" onClick={accept} className="min-h-11 rounded-[var(--radius-card)] px-4 font-bold text-white" style={{ backgroundColor: "var(--color-btn)" }}>{translate("accept")}</button>
      </div>
    </main>
  );
}
