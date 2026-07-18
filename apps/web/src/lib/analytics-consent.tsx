"use client";

import Script from "next/script";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ANALYTICS_CONSENT_KEY } from "./analytics";

type Consent = "accepted" | "rejected" | null;

interface ConsentContextValue {
  consent: Consent;
  accept: () => void;
  reject: () => void;
  openPreferences: () => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);
const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

function setGaDisabled(disabled: boolean): void {
  if (!measurementId || typeof window === "undefined") return;
  (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = disabled;
}

function clearGaCookies(): void {
  if (typeof document === "undefined") return;
  const hostParts = window.location.hostname.split(".");
  const rootDomain = hostParts.length > 1 ? `.${hostParts.slice(-2).join(".")}` : null;
  for (const entry of document.cookie.split(";")) {
    const name = entry.split("=")[0]?.trim();
    if (!name || (name !== "_ga" && !name.startsWith("_ga_"))) continue;
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    document.cookie = `${name}=; Max-Age=0; Path=/; Domain=${window.location.hostname}; SameSite=Lax`;
    if (rootDomain) {
      document.cookie = `${name}=; Max-Age=0; Path=/; Domain=${rootDomain}; SameSite=Lax`;
    }
  }
}

export function AnalyticsConsentProvider({ children }: { children: ReactNode }) {
  const translate = useTranslations("analyticsConsent");
  const [consent, setConsent] = useState<Consent>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    if (saved !== "accepted" && saved !== "rejected") return;
    queueMicrotask(() => setConsent(saved));
  }, []);

  const accept = () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, "accepted");
    setGaDisabled(false);
    setConsent("accepted");
    setPreferencesOpen(false);
    window.dispatchEvent(new Event("mentor:analytics-consent"));
  };

  const reject = () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, "rejected");
    setGaDisabled(true);
    clearGaCookies();
    setConsent("rejected");
    setPreferencesOpen(false);
  };

  const initializeGa = () => {
    if (!measurementId || consent !== "accepted") return;
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = (...args: unknown[]) => window.dataLayer?.push(args);
    window.gtag("js", new Date());
    window.gtag("config", measurementId, { anonymize_ip: true });
  };

  return (
    <ConsentContext.Provider
      value={{ consent, accept, reject, openPreferences: () => setPreferencesOpen(true) }}
    >
      {children}
      {measurementId && consent === "accepted" && (
        <Script
          id="mentor-ga4"
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
          strategy="afterInteractive"
          onLoad={initializeGa}
        />
      )}
      {measurementId && (consent === null || preferencesOpen) && (
        <section
          role="dialog"
          aria-label={translate("title")}
          className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-2xl rounded-[var(--radius-card)] border bg-white p-4 shadow-lg"
          style={{ borderColor: "color-mix(in srgb, var(--color-secondary) 24%, transparent)" }}
        >
          <h2 className="font-bold" style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}>{translate("title")}</h2>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--color-secondary)" }}>{translate("body")} <Link className="underline" href="/cerez-tercihleri">{translate("details")}</Link></p>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={reject} className="min-h-11 rounded-[var(--radius-card)] border px-4 text-sm font-semibold" style={{ color: "var(--color-main)" }}>{translate("reject")}</button>
            <button type="button" onClick={accept} className="min-h-11 rounded-[var(--radius-card)] px-4 text-sm font-bold text-white" style={{ backgroundColor: "var(--color-btn)" }}>{translate("accept")}</button>
          </div>
        </section>
      )}
      {measurementId && consent !== null && !preferencesOpen && (
        <button
          type="button"
          onClick={() => setPreferencesOpen(true)}
          className="fixed bottom-3 left-3 z-[90] min-h-11 rounded-[var(--radius-card)] border bg-white px-3 text-xs font-semibold shadow-sm"
          style={{ color: "var(--color-secondary)" }}
        >
          {translate("reopen")}
        </button>
      )}
    </ConsentContext.Provider>
  );
}

export function useAnalyticsConsent(): ConsentContextValue {
  const value = useContext(ConsentContext);
  if (!value) throw new Error("AnalyticsConsentProvider is missing");
  return value;
}
