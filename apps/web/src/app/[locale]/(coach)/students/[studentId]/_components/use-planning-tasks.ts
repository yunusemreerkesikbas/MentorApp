"use client";
import { useEffect, useState } from "react";
import type { MentorshipPlanningTaskDto } from "@mentor/types";
import { fetchPlanningTasks } from "@/lib/mentorship-plan";
import { shiftDate } from "./planning-state";

export function usePlanningTasks(studentId: string, week: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    rows: MentorshipPlanningTaskDto[] | null;
    error: boolean;
  }>({ key: "", rows: null, error: false });
  const key = `${studentId}:${week}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    fetchPlanningTasks(studentId, week, shiftDate(week, 6), controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setResult({ key, rows, error: false });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({ key, rows: null, error: true });
      });
    return () => controller.abort();
  }, [studentId, week, key]);
  return {
    rows: result.key === key ? result.rows : null,
    error: result.key === key && result.error,
    retry: () => setAttempt((n) => n + 1),
  };
}
