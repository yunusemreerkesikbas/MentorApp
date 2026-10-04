"use client";

import { useEffect } from "react";
import type { MentorshipWeeklyReportPreviewDto } from "@mentor/types";
import { readWeeklyReportBrief } from "@/lib/mentorship-weekly-report";

const BRIEF_POLL_INTERVAL_MS = 2_000;

/**
 * While a preparation is being written (`BRIEF_PENDING`), asks for it every two seconds and hands
 * each answer back. A blip must not strand the panel on "pending": it keeps polling, backing off,
 * and reports only the first failure.
 */
export function useWeeklyBriefPolling(
  studentId: string,
  preview: MentorshipWeeklyReportPreviewDto | null,
  onPreview: (next: MentorshipWeeklyReportPreviewDto) => void,
  onError: (error: unknown) => void,
) {
  useEffect(() => {
    if (!preview || preview.status !== "BRIEF_PENDING") return;
    let cancelled = false;
    let failures = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const next = await readWeeklyReportBrief(studentId, preview.snapshot.period.startDate);
        if (cancelled) return;
        failures = 0;
        onPreview(next);
        if (next.status === "BRIEF_PENDING") {
          timeout = setTimeout(() => void poll(), BRIEF_POLL_INTERVAL_MS);
        }
      } catch (error) {
        if (cancelled) return;
        if (failures === 0) onError(error);
        failures += 1;
        timeout = setTimeout(() => void poll(), BRIEF_POLL_INTERVAL_MS * 2 ** Math.min(failures, 4));
      }
    };
    timeout = setTimeout(() => void poll(), BRIEF_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [preview, onError, onPreview, studentId]);
}
