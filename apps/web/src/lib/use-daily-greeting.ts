"use client";

import { useEffect, useRef, useState } from "react";
import { fetchDailyGreeting } from "@/lib/coach";
import { isPremiumFeatureAvailable } from "@/lib/premium-feature";
import { useSubscription } from "@/lib/subscription-context";

/**
 * The premium daily note behind the panel's Puhu bubble.
 *
 * The POST now waits for the entitlement instead of racing it: a free user used to send a request
 * the server was always going to refuse (`featureGate.assertAllowed`), which cost a round trip and
 * an error log per panel load for the majority of users.
 */
export function useDailyGreeting(): {
  greeting: string | null;
  locked: boolean;
} {
  const { view, loading } = useSubscription();
  const allowed = isPremiumFeatureAvailable(view, "daily.greeting");
  const [greeting, setGreeting] = useState<string | null>(null);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (loading || !allowed || requestedRef.current) return;
    requestedRef.current = true;
    void fetchDailyGreeting()
      .then((res) => setGreeting(res.greeting))
      .catch(() => setGreeting(null));
  }, [allowed, loading]);

  // Locked is the free user's state: no note, and no right to one. An allowed user whose call
  // failed keeps the plain fallback copy rather than an upsell.
  return { greeting, locked: !loading && !allowed && !greeting };
}
