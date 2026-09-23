"use client";

import { useEffect, useRef, useState } from "react";
import type { CoachingAnalysisDto } from "@mentor/types";
import { fetchGhostNarration } from "@/lib/coach";
import { isPremiumFeatureAvailable } from "@/lib/premium-feature";
import { useSubscription } from "@/lib/subscription-context";

export interface GhostNarration {
  /** The AI line for the latest exam: cached on the server, or just written. */
  text: string | null;
  /** Being written right now (premium, latest exam, nothing cached yet). */
  pending: boolean;
  /** A free student: the rule-based headline stays and the lock nudge shows. */
  locked: boolean;
}

/**
 * The premium narration of the latest exam against the student's own past, labelled "Koçundan" in
 * Puhu's bubble (DESIGN.md §1 rule 4). Mounted once on the page, so a save and the Gelişim hero share
 * one request per attempt. It waits for the entitlement: a free student never sends a call the server
 * would refuse (the `useDailyGreeting` pattern). An older exam saved later does not move `latest`,
 * so it never asks for a narration.
 */
export function useGhostNarration(
  analysis: CoachingAnalysisDto | null,
  examId: string | null,
): GhostNarration {
  const { view, loading } = useSubscription();
  const allowed = isPremiumFeatureAvailable(view, "ghost.narration");
  const ghost = analysis?.ghost ?? null;
  const latestId = ghost?.latest.id ?? null;
  const cached = ghost?.aiNarration ?? null;
  const [written, setWritten] = useState<{ id: string; text: string } | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const requested = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !allowed || !examId || !latestId || cached) return;
    if (requested.current === latestId) return;
    requested.current = latestId;
    fetchGhostNarration(examId)
      .then((result) => setWritten({ id: latestId, text: result.narration }))
      .catch(() => setFailedId(latestId));
  }, [allowed, cached, examId, latestId, loading]);

  const text = cached ?? (written?.id === latestId ? written.text : null);
  return {
    text,
    pending: !loading && allowed && Boolean(latestId) && !text && failedId !== latestId,
    locked: !loading && !allowed && Boolean(ghost),
  };
}
