"use client";

import Script from "next/script";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ANALYTICS_CONSENT_KEY } from "./analytics";
import { AdvertisingConsentProvider } from "./advertising-consent";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";

type Consent = "accepted" | "rejected" | null;

export interface ConsentContextValue {
  consent: Consent;
  accept: () => void;
  reject: () => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);
const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

function readStoredConsent(): Consent {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    if (saved === "accepted" || saved === "rejected") return saved;
  } catch { /* Unavailable storage leaves optional analytics disabled. */ }
  return null;
}

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

export function AnalyticsConsentProvider({ children, nonce }: { children: ReactNode; nonce: string }) {
  const [consent, setConsent] = useState<Consent>(null);
  /** False until localStorage is read — avoids flashing the banner on every load. */
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = readStoredConsent();
    queueMicrotask(() => {
      setConsent(saved);
      setHydrated(true);
      if (saved === "rejected") {
        setGaDisabled(true);
        clearGaCookies();
      } else if (saved === "accepted") {
        setGaDisabled(false);
      }
    });
  }, []);

  const accept = () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, "accepted");
    setGaDisabled(false);
    setConsent("accepted");
    window.dispatchEvent(new Event("mentor:analytics-consent"));
  };

  const reject = () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, "rejected");
    setGaDisabled(true);
    clearGaCookies();
    setConsent("rejected");
    window.dispatchEvent(new Event("mentor:analytics-rejected"));
  };

  const initializeGa = () => {
    if (!measurementId || consent !== "accepted") return;
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = (...args: unknown[]) => window.dataLayer?.push(args);
    window.gtag("js", new Date());
    window.gtag("config", measurementId, { anonymize_ip: true });
    window.dispatchEvent(new Event("mentor:analytics-ready"));
  };

  return (
    <ConsentContext.Provider value={{ consent, accept, reject }}>
      <AdvertisingConsentProvider>
      {children}
      {measurementId && consent === "accepted" && (
        <Script
          id="mentor-ga4"
          nonce={nonce}
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
          strategy="afterInteractive"
          onLoad={initializeGa}
        />
      )}
      <CookieConsentBanner analytics={{ consent, accept, reject }} analyticsHydrated={hydrated} analyticsEnabled={Boolean(measurementId)} />
      </AdvertisingConsentProvider>
    </ConsentContext.Provider>
  );
}

export function useAnalyticsConsent(): ConsentContextValue {
  const value = useContext(ConsentContext);
  if (!value) throw new Error("AnalyticsConsentProvider is missing");
  return value;
}
