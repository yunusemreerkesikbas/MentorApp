"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ADVERTISING_CONSENT_KEY, blockAdvertisingForDocument, readAdvertisingConsent, type AdvertisingConsent } from "./advertising-consent-storage";

interface AdvertisingConsentContextValue {
  consent: AdvertisingConsent;
  hydrated: boolean;
  saveFailed: boolean;
  accept: () => void;
  reject: () => void;
}

const Context = createContext<AdvertisingConsentContextValue | null>(null);

export function AdvertisingConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<AdvertisingConsent>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const current = useRef<AdvertisingConsent>(null);
  const requiresReload = useRef(false);

  const apply = (next: AdvertisingConsent) => {
    const revoked = (current.current === "accepted" || requiresReload.current) && next !== "accepted";
    if (next === "accepted") requiresReload.current = false;
    current.current = next;
    setConsent(next);
    if (revoked) {
      // No loader import here: GPT remains outside the initial application bundle.
      try { window.googletag?.destroySlots?.(); }
      finally { window.location.reload(); }
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      current.current = readAdvertisingConsent();
      setConsent(current.current);
      setHydrated(true);
    });
    const onStorage = (event: StorageEvent) => {
      if (event.key === ADVERTISING_CONSENT_KEY || event.key === null) apply(readAdvertisingConsent());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const save = (next: "accepted" | "rejected") => {
    try {
      window.localStorage.setItem(ADVERTISING_CONSENT_KEY, next);
      blockAdvertisingForDocument(false);
      setSaveFailed(false);
      apply(next);
    } catch {
      // Never activate advertising on a choice that cannot be saved.
      setSaveFailed(true);
      if (next === "rejected") {
        requiresReload.current ||= current.current === "accepted";
        blockAdvertisingForDocument(true);
        current.current = "rejected";
        setConsent("rejected");
        window.googletag?.destroySlots?.();
        // Keep the error visible: reloading would restore the stale accepted storage value.
      }
    }
  };

  return <Context.Provider value={{ consent, hydrated, saveFailed, accept: () => save("accepted"), reject: () => save("rejected") }}>{children}</Context.Provider>;
}

export function useAdvertisingConsent(): AdvertisingConsentContextValue {
  const value = useContext(Context);
  if (!value) throw new Error("AdvertisingConsentProvider is missing");
  return value;
}
