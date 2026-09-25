"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  MentorshipWeeklyReportDto,
  MentorshipWeeklyReportListItemDto,
  MentorshipWeeklyReportPreviewDto,
} from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { trackMentorshipWeeklyReportEvent } from "@/lib/analytics";
import { useMentorToast } from "@/lib/mentor-toast";
import {
  fetchWeeklyReportArchive,
  fetchWeeklyReportPreview,
  finalizeWeeklyReport,
  requestWeeklyReportBrief,
  shiftWeekStart,
} from "@/lib/mentorship-weekly-report";
import { useWeeklyBriefPolling } from "./use-weekly-brief-polling";

async function fetchInitialWeeklyReport(studentId: string) {
  const [preview, archive] = await Promise.all([
    fetchWeeklyReportPreview(studentId),
    fetchWeeklyReportArchive(studentId),
  ]);
  return { preview, archive };
}

export type WeeklyReportLoadState = "loading" | "ready" | "disabled" | "failed";

function isFeatureDisabled(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    error.body.code === "MENTORSHIP_WEEKLY_REPORT_DISABLED"
  );
}

export function useWeeklyReportCard(studentId: string) {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const {
    error: showToastError,
    success: showToastSuccess,
    warning: showToastWarning,
  } = useMentorToast();
  const [preview, setPreview] =
    useState<MentorshipWeeklyReportPreviewDto | null>(null);
  const [archive, setArchive] = useState<MentorshipWeeklyReportListItemDto[]>(
    [],
  );
  const [latestWeek, setLatestWeek] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState("");
  const [contextDraft, setContextDraft] = useState<{
    key: string;
    value: string;
  } | null>(null);
  const contextKey = `${studentId}:${preview?.snapshot.period.startDate ?? ""}`;
  const coachContext =
    contextDraft?.key === contextKey
      ? contextDraft.value
      : (preview?.coachContext ?? "");
  const setCoachContext = (value: string) =>
    setContextDraft({ key: contextKey, value });
  const [state, setState] = useState<WeeklyReportLoadState>("loading");
  const [busy, setBusy] = useState(false);
  const [finalized, setFinalized] = useState<MentorshipWeeklyReportDto | null>(
    null,
  );
  const finalizeOperation = useRef<{ key: string; id: string } | null>(null);
  const viewedWeeks = useRef(new Set<string>());

  const showError = useCallback(
    (error: unknown) => {
      showToastError({
        title: common("error_title"),
        message:
          error instanceof ApiClientError
            ? error.message
            : common("error_unknown"),
      });
    },
    [common, showToastError],
  );

  const acceptPreview = useCallback(
    (next: MentorshipWeeklyReportPreviewDto) => {
      setPreview(next);
      setLatestWeek((current) => current ?? next.snapshot.period.startDate);
      setState("ready");
      if (!viewedWeeks.current.has(next.snapshot.period.startDate)) {
        viewedWeeks.current.add(next.snapshot.period.startDate);
        trackMentorshipWeeklyReportEvent("mentorship_weekly_report_view", {
          surface: "student_report",
          has_previous_activity: next.snapshot.previous.hasRecordedActivity,
        });
      }
    },
    [],
  );

  const acceptInitial = useCallback(
    (result: Awaited<ReturnType<typeof fetchInitialWeeklyReport>>) => {
      setArchive(result.archive.items);
      acceptPreview(result.preview);
    },
    [acceptPreview],
  );

  // The rail card says a failed load in place, with its retry; a toast on top would say it twice.
  const rejectInitial = useCallback((error: unknown) => {
    setState(isFeatureDisabled(error) ? "disabled" : "failed");
  }, []);

  const loadInitial = useCallback(async () => {
    try {
      acceptInitial(await fetchInitialWeeklyReport(studentId));
    } catch (error) {
      rejectInitial(error);
    }
  }, [acceptInitial, rejectInitial, studentId]);

  useEffect(() => {
    let cancelled = false;
    void fetchInitialWeeklyReport(studentId)
      .then((result) => {
        if (!cancelled) acceptInitial(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) rejectInitial(error);
      });
    return () => {
      cancelled = true;
    };
  }, [acceptInitial, rejectInitial, studentId]);

  const retry = useCallback(async () => {
    setState("loading");
    await loadInitial();
  }, [loadInitial]);

  useWeeklyBriefPolling(studentId, preview, setPreview, showError);

  const reloadSelected = useCallback(async () => {
    if (!preview) return;
    acceptPreview(
      await fetchWeeklyReportPreview(
        studentId,
        preview.snapshot.period.startDate,
      ),
    );
  }, [acceptPreview, preview, studentId]);

  async function handleConflict() {
    try {
      await reloadSelected();
      showToastWarning({
        title: common("error_title"),
        message: t("weekly_report_preview_changed"),
      });
    } catch (error) {
      showError(error);
    }
  }

  async function moveWeek(offset: number) {
    if (!preview) return;
    setBusy(true);
    setFinalized(null);
    setEvaluation("");
    setContextDraft(null);
    try {
      acceptPreview(
        await fetchWeeklyReportPreview(
          studentId,
          shiftWeekStart(preview.snapshot.period.startDate, offset),
        ),
      );
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function generateBrief() {
    if (!preview) return;
    setBusy(true);
    try {
      setPreview(
        await requestWeeklyReportBrief(
          studentId,
          preview.snapshot.period.startDate,
          preview.sourceFingerprint,
          coachContext,
        ),
      );
      trackMentorshipWeeklyReportEvent("mentorship_weekly_brief_request", {
        surface: "student_report",
      });
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        await handleConflict();
        return;
      }
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function finalize() {
    if (!preview) return;
    const replaces = archive.find(
      (item) => item.period.startDate === preview.snapshot.period.startDate,
    );
    const operationKey = JSON.stringify([
      preview.sourceFingerprint,
      evaluation.trim(),
      replaces?.id ?? null,
    ]);
    if (finalizeOperation.current?.key !== operationKey) {
      finalizeOperation.current = {
        key: operationKey,
        id: crypto.randomUUID(),
      };
    }
    setBusy(true);
    try {
      const result = await finalizeWeeklyReport(studentId, {
        weekStart: preview.snapshot.period.startDate,
        sourceFingerprint: preview.sourceFingerprint,
        operationId: finalizeOperation.current.id,
        coachEvaluation: evaluation.trim() || null,
        replacesId: replaces?.id ?? null,
      });
      setArchive((await fetchWeeklyReportArchive(studentId)).items);
      setFinalized(result);
      finalizeOperation.current = null;
      trackMentorshipWeeklyReportEvent("mentorship_weekly_report_finalize", {
        surface: "student_report",
        has_brief: result.brief !== null,
        has_coach_evaluation: result.coachEvaluation !== null,
      });
      showToastSuccess({ title: t("weekly_report_finalized") });
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        await handleConflict();
      } else {
        showError(error);
      }
    } finally {
      setBusy(false);
    }
  }

  return {
    archive,
    busy,
    evaluation,
    coachContext,
    setCoachContext,
    finalized,
    latestWeek,
    preview,
    state,
    setEvaluation,
    retry,
    moveWeek,
    generateBrief,
    finalize,
  };
}
