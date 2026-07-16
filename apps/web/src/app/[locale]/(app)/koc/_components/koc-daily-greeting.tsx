"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CoachAccessMode } from "@mentor/types";
import { PuhuCoachBubble } from "@/components/puhu-coach-bubble";
import { fetchDailyGreeting } from "@/lib/coach";
import { useKocAccess } from "./koc-access-shell";

/**
 * Premium proactive daily greeting on the /koc hub — Puhu says a personal, day-scoped hello
 * (cached per user+day on the backend). Free users see nothing (rule-based brief stays).
 * Any error (budget, network) renders nothing — the hub must never break because of this.
 */
export function KocDailyGreeting() {
  const t = useTranslations("coach.hub");
  const access = useKocAccess();
  const isPremium = access.mode === CoachAccessMode.PREMIUM;
  const [greeting, setGreeting] = useState<string | null>(null);
  // One request per mount — StrictMode re-runs the effect, which would double the day's
  // first (billable) LLM call. No cleanup flag: the resolved value must still land after
  // StrictMode's setup→cleanup→setup cycle, and a stray post-unmount setState is harmless.
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!isPremium || requestedRef.current) return;
    requestedRef.current = true;
    fetchDailyGreeting()
      .then((res) => setGreeting(res.greeting))
      .catch(() => null);
  }, [isPremium]);

  if (!greeting) return null;

  return (
    <PuhuCoachBubble
      message={greeting}
      puhuSize="sm"
      className="mb-3"
      dismissLabel={t("daily_greeting_dismiss")}
    />
  );
}
