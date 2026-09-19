"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@mentor/api-client";
import type { MentorshipPlanningTaskDto } from "@mentor/types";
import { fetchPlanningTasks } from "@/lib/mentorship-plan";
import { shiftDate } from "./planning-state";

export function usePlanningTasks(studentId: string, week: string) {
  const t = useTranslations("common");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    rows: MentorshipPlanningTaskDto[] | null;
    error: string | null;
  }>({ key: "", rows: null, error: null });
  const key = `${studentId}:${week}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    fetchPlanningTasks(studentId, week, shiftDate(week, 6), controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setResult({ key, rows, error: null });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            rows: null,
            error:
              error instanceof ApiClientError
                ? error.message
                : t("error_unknown"),
          });
      });
    return () => controller.abort();
  }, [studentId, week, key, t]);
  return {
    rows: result.key === key ? result.rows : null,
    error: result.key === key ? result.error : null,
    retry: () => setAttempt((n) => n + 1),
  };
}
