"use client";

import { useEffect, useRef, useState } from "react";
import { fetchDailyGreeting } from "@/lib/coach";

/**
 * The coach's proactive daily greeting (premium; cached per user+day on the backend).
 * Returns null until loaded AND for free users / any error — callers render their static
 * fallback copy in that case, so this can never break a page.
 * One request per mount (StrictMode-safe ref guard — the day's first call is billable).
 */
export function useDailyGreeting(): string | null {
  const [greeting, setGreeting] = useState<string | null>(null);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    fetchDailyGreeting()
      .then((res) => setGreeting(res.greeting))
      .catch(() => null); // free (403), budget, network — silently keep the fallback
  }, []);

  return greeting;
}
