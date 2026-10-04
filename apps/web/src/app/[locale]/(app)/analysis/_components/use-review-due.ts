"use client";

import { useEffect, useState } from "react";
import type { NotebookReviewSummary } from "@mentor/types";
import { http } from "@mentor/api-client";

/**
 * How many notebook questions are due now for this exam, optionally narrowed to a subject/topic:
 * the same summary the review itself opens on, so the number on a ledge is the set it starts.
 * `null` while loading, on failure, or when `enabled` is false; the ledge then starts the review
 * without promising a number.
 */
export function useReviewDue(
  examId: string,
  scope: { subjectRef: string; topicRef?: string } | null,
  enabled: boolean,
): number | null {
  const key = enabled
    ? [examId, scope?.subjectRef ?? "", scope?.topicRef ?? ""].join("|")
    : null;
  const [result, setResult] = useState<{ key: string; due: number | null } | null>(null);

  useEffect(() => {
    if (!key) return;
    const [, subjectRef, topicRef] = key.split("|");
    const query = new URLSearchParams({ examId, days: "7" });
    if (subjectRef) query.set("subjectRef", subjectRef);
    if (topicRef) query.set("topicRef", topicRef);
    let active = true;
    http<NotebookReviewSummary>(`/v1/coaching/notebook/review-summary?${query.toString()}`)
      .then((summary) => {
        if (active) setResult({ key, due: summary.dueCount });
      })
      .catch(() => {
        if (active) setResult({ key, due: null });
      });
    return () => {
      active = false;
    };
  }, [examId, key]);

  return result?.key === key ? result.due : null;
}
