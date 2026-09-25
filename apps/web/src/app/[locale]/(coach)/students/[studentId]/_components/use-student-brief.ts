"use client";

import { useEffect, useState } from "react";
import { PremiumFeatureId } from "@mentor/types";
import { generateBrief } from "@/lib/mentorship";
import { usePremiumFeature } from "@/lib/subscription-context";

/**
 * The assistant's read of one student, written on arrival for a coach whose plan includes it
 * (today: Koç Pro). The roster's cohort brief does the same one level up (`useCohortBrief`).
 *
 * POST on mount: the server compares the report's fingerprint before anything that costs money and
 * answers with the stored brief when nothing moved, so a revisit is free. `wanted` holds the call
 * until there is something to read; a student with no trace yet gets the rule line, not a paid
 * sentence about an empty report.
 *
 * Keyed by student: a reply that lands after the coach moved on never shows under the next name.
 * Unavailable or failing, `brief` stays null. No toast and no nudge (the entitlement is decided
 * elsewhere; this screen reflects it).
 */
export function useStudentBrief(
  studentId: string,
  wanted: boolean,
): { brief: string | null; busy: boolean } {
  const available = usePremiumFeature(PremiumFeatureId.MENTORSHIP_BRIEF);
  const run = available && wanted;
  const [result, setResult] = useState<{ studentId: string; brief: string | null } | null>(null);

  useEffect(() => {
    if (!run) return;
    let active = true;
    generateBrief(studentId)
      .then((reply) => {
        if (active) setResult({ studentId, brief: reply.brief });
      })
      .catch(() => {
        if (active) setResult({ studentId, brief: null });
      });
    return () => {
      active = false;
    };
  }, [run, studentId]);

  const mine = result?.studentId === studentId ? result : null;
  return { brief: run ? (mine?.brief ?? null) : null, busy: run && mine === null };
}
