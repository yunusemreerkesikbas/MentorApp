"use client";

import { useEffect, useRef, useState } from "react";
import { fetchDailyGreeting } from "@/lib/coach";
import { isPremiumFeatureAvailable } from "@/lib/premium-feature";
import { fetchSubscriptionView } from "@/lib/subscription-view";

export function useDailyGreeting(): {
  greeting: string | null;
  locked: boolean;
} {
  const [greeting, setGreeting] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    void Promise.all([
      fetchDailyGreeting()
        .then((res) => res.greeting)
        .catch(() => null),
      fetchSubscriptionView(),
    ]).then(([text, view]) => {
      setGreeting(text);
      setLocked(!text && !isPremiumFeatureAvailable(view, "daily.greeting"));
    });
  }, []);

  return { greeting, locked };
}
