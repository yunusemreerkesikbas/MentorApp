"use client";

import { useEffect, useState } from "react";
import { PremiumFeatureId, type MentorshipCohortBriefDto } from "@mentor/types";
import { generateCohortBrief } from "@/lib/mentorship";
import { usePremiumFeature } from "@/lib/subscription-context";

/**
 * The assistant's read of the waiting students, written on arrival for a coach whose plan includes
 * it (today: Koç Pro).
 *
 * POST rather than GET, and on mount: the server compares the cohort's fingerprint before anything
 * that costs money and hands back the stored brief when nothing moved, so a revisit is free while a
 * new flag gets a fresh brief without the coach pressing anything.
 *
 * Unavailable or failing, `brief` stays null and the round keeps its rule line. No toast and no
 * nudge: the coach's AI entitlement is decided elsewhere, and this screen only reflects it.
 */
export function useCohortBrief(wanted: boolean): {
  brief: MentorshipCohortBriefDto | null;
  busy: boolean;
} {
  const available = usePremiumFeature(PremiumFeatureId.MENTORSHIP_COHORT_BRIEF);
  const run = available && wanted;
  const [result, setResult] = useState<{ brief: MentorshipCohortBriefDto | null } | null>(null);

  useEffect(() => {
    if (!run) return;
    let active = true;
    generateCohortBrief()
      .then((brief) => {
        if (active) setResult({ brief });
      })
      .catch(() => {
        if (active) setResult({ brief: null });
      });
    return () => {
      active = false;
    };
  }, [run]);

  return { brief: run ? (result?.brief ?? null) : null, busy: run && result === null };
}
