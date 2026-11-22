import { useCallback, useEffect, useRef, useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import { ApiClientError } from "@mentor/api-client";
import type {
  MentorshipWeeklyReportListItemDto,
  MentorshipWeeklyReportPreviewDto,
} from "@mentor/types";
import { formatDisplayDate } from "../../../lib/display-date.js";
import { haptics } from "../../../lib/haptics.js";
import {
  extractMentorshipError,
  formatWeeklyReportShareText,
} from "../../../lib/mentorship-view.js";
import {
  fetchWeeklyReportArchive,
  fetchWeeklyReportPreview,
  fetchWeeklyReportShare,
  finalizeWeeklyReport,
  formatWeeklyMetric,
  readWeeklyReportBrief,
  requestWeeklyReportBrief,
  shiftWeekStart,
} from "../../../lib/mentorship-weekly-reports-api.js";
import { newRequestId } from "../../../lib/request-id.js";
import { useLocale, useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { useToast } from "../../../providers/toast-provider.js";
import { PanelCard, PanelCardTitle } from "../../panel/primitives.js";
import { AppText, Button, Chip, Skeleton, StateView, TextField } from "../../ui/index.js";
import { CoachStudentWeeklyBriefCard } from "./coach-student-weekly-brief.js";

export function CoachStudentWeeklyTab({ studentId }: { studentId: string }) {
  const t = useTranslations("students");
  const tCommon = useTranslations("common");
  const { locale } = useLocale();
  const toast = useToast();
  const { palette, radii, space } = useThemeTokens();

  const [preview, setPreview] = useState<MentorshipWeeklyReportPreviewDto | null>(null);
  const [archive, setArchive] = useState<MentorshipWeeklyReportListItemDto[]>([]);
  const [latestWeek, setLatestWeek] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "disabled" | "failed">("loading");
  const [busy, setBusy] = useState(false);
  const [coachContext, setCoachContext] = useState("");
  const [evaluation, setEvaluation] = useState("");
  const opRef = useRef<{ key: string; id: string } | null>(null);

  const loadInitial = useCallback(async () => {
    setStatus("loading");
    try {
      const [nextPreview, nextArchive] = await Promise.all([
        fetchWeeklyReportPreview(studentId),
        fetchWeeklyReportArchive(studentId),
      ]);
      setPreview(nextPreview);
      setArchive(nextArchive.items);
      setLatestWeek((cur) => cur ?? nextPreview.snapshot.period.startDate);
      setCoachContext(nextPreview.coachContext ?? "");
      setStatus("ready");
    } catch (err) {
      if (
        err instanceof ApiClientError &&
        err.body.code === "MENTORSHIP_WEEKLY_REPORT_DISABLED"
      ) {
        setStatus("disabled");
        return;
      }
      setStatus("failed");
    }
  }, [studentId]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!preview || preview.status !== "BRIEF_PENDING") return;
    let cancelled = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const next = await readWeeklyReportBrief(
          studentId,
          preview.snapshot.period.startDate,
        );
        if (cancelled) return;
        failures = 0;
        setPreview(next);
        if (next.status === "BRIEF_PENDING") {
          timer = setTimeout(() => void poll(), 2000);
        }
      } catch (err) {
        if (cancelled) return;
        if (failures === 0) toast.show(extractMentorshipError(err, tCommon("error_body")));
        failures += 1;
        timer = setTimeout(
          () => void poll(),
          2000 * 2 ** Math.min(failures, 4),
        );
      }
    };
    timer = setTimeout(() => void poll(), 2000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [preview, studentId, toast, tCommon]);

  async function moveWeek(offset: number) {
    if (!preview || busy) return;
    setBusy(true);
    setEvaluation("");
    try {
      const next = await fetchWeeklyReportPreview(
        studentId,
        shiftWeekStart(preview.snapshot.period.startDate, offset),
      );
      setPreview(next);
      setCoachContext(next.coachContext ?? "");
    } catch (err) {
      toast.show(extractMentorshipError(err, tCommon("error_body")));
    } finally {
      setBusy(false);
    }
  }

  async function reloadAfterConflict() {
    if (!preview) return;
    const next = await fetchWeeklyReportPreview(
      studentId,
      preview.snapshot.period.startDate,
    );
    setPreview(next);
    toast.show(t("weekly_report_preview_changed"));
  }

  async function handleGenerateBrief() {
    if (!preview || busy) return;
    setBusy(true);
    try {
      const next = await requestWeeklyReportBrief(
        studentId,
        preview.snapshot.period.startDate,
        preview.sourceFingerprint,
        coachContext.trim() || undefined,
      );
      setPreview(next);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        await reloadAfterConflict();
      } else {
        toast.show(extractMentorshipError(err, tCommon("error_body")));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleFinalize() {
    if (!preview || busy) return;
    const replaces = archive.find(
      (item) => item.period.startDate === preview.snapshot.period.startDate,
    );
    const key = JSON.stringify([
      preview.sourceFingerprint,
      evaluation.trim(),
      replaces?.id ?? null,
    ]);
    if (opRef.current?.key !== key) {
      opRef.current = { key, id: newRequestId() };
    }
    setBusy(true);
    try {
      await finalizeWeeklyReport(studentId, {
        weekStart: preview.snapshot.period.startDate,
        sourceFingerprint: preview.sourceFingerprint,
        operationId: opRef.current.id,
        coachEvaluation: evaluation.trim() || null,
        replacesId: replaces?.id ?? null,
      });
      void haptics.success();
      opRef.current = null;
      setArchive((await fetchWeeklyReportArchive(studentId)).items);
      toast.show(t("weekly_report_finalized"));
    } catch (err) {
      void haptics.error();
      if (err instanceof ApiClientError && err.status === 409) {
        await reloadAfterConflict();
      } else {
        toast.show(extractMentorshipError(err, tCommon("error_body")));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleShareReport(reportId: string) {
    try {
      const share = await fetchWeeklyReportShare(studentId, reportId);
      const message = formatWeeklyReportShareText(
        share,
        {
          header: (args) => t("weekly_share_header", args),
          focusLine: (args) => t("weekly_share_focus", args),
          activeDaysLine: (args) => t("weekly_share_active_days", args),
          tasksLine: (args) => t("weekly_share_tasks", args),
          mockLine: (args) => t("weekly_share_mock", args),
          evaluationHeading: t("weekly_report_share_title"),
        },
        locale,
      );
      await Share.share({ message });
    } catch (err) {
      toast.show(extractMentorshipError(err, tCommon("error_body")));
    }
  }

  if (status === "disabled") {
    return (
      <StateView
        title={t("weekly_report_disabled_title")}
        body={t("weekly_report_disabled_body")}
        tone="empty"
      />
    );
  }
  if (status === "loading" || !preview) return <Skeleton height={220} />;
  if (status === "failed") {
    return (
      <StateView
        title={tCommon("error_title")}
        body={tCommon("error_body")}
        actionLabel={tCommon("retry")}
        onAction={() => void loadInitial()}
        tone="error"
      />
    );
  }

  const { period, current, previous, mocks } = preview.snapshot;
  const previousFinalized = archive.find(
    (item) => item.period.startDate === period.startDate,
  );
  const periodLabel = `${formatDisplayDate(`${period.startDate}T12:00:00.000Z`, locale)} - ${formatDisplayDate(`${period.endDate}T12:00:00.000Z`, locale)}`;

  return (
    <View style={{ gap: space.md }}>
      <PanelCard style={{ gap: space.sm }}>
        <View style={{ alignItems: "center", gap: 4 }}>
          <AppText variant="cardTitle" style={{ textAlign: "center" }}>
            {periodLabel}
          </AppText>
          <Chip
            label={
              previousFinalized
                ? t("weekly_report_status_finalized")
                : t("weekly_report_status_draft")
            }
            tone={previousFinalized ? "coach" : "default"}
          />
        </View>
        <View style={styles.weekBar}>
          <Button
            label={t("pager_prev")}
            variant="secondary"
            disabled={busy}
            onPress={() => void moveWeek(-1)}
            style={{ flex: 1 }}
          />
          <Button
            label={t("pager_next")}
            variant="secondary"
            disabled={busy || period.startDate === latestWeek}
            onPress={() => void moveWeek(1)}
            style={{ flex: 1 }}
          />
        </View>

        <View style={styles.metricRow}>
          <AppText variant="body" style={{ flex: 1 }}>
            {t("weekly_report_focus")}
          </AppText>
          <AppText variant="cardTitle" tabularNums>
            {formatWeeklyMetric("FOCUS_MINUTES", current.focusMinutes, locale)} (
            {t("weekly_prev_inline", {
              value: formatWeeklyMetric("FOCUS_MINUTES", previous.focusMinutes, locale),
            })}
            )
          </AppText>
        </View>
        <View style={styles.metricRow}>
          <AppText variant="body" style={{ flex: 1 }}>
            {t("weekly_report_active_days")}
          </AppText>
          <AppText variant="cardTitle" tabularNums>
            {current.activeDays} / {previous.activeDays}
          </AppText>
        </View>
        <View style={styles.metricRow}>
          <AppText variant="body" style={{ flex: 1 }}>
            {t("weekly_panel_tasks_done")}
          </AppText>
          <AppText variant="cardTitle" tabularNums>
            {current.completedTasks}/{current.plannedTasks}
          </AppText>
        </View>
        {mocks.currentAttemptCount > 0 || mocks.previousAttemptCount > 0 ? (
          <View style={styles.metricRow}>
            <AppText variant="body" style={{ flex: 1 }}>
              {t("weekly_report_mock_average")}
            </AppText>
            <AppText variant="cardTitle" tabularNums>
              {formatWeeklyMetric("MOCK_AVERAGE", mocks.currentAverageNet, locale)}
            </AppText>
          </View>
        ) : null}
      </PanelCard>

      <CoachStudentWeeklyBriefCard
        preview={preview}
        coachContext={coachContext}
        onContextChange={setCoachContext}
        busy={busy}
        onGenerate={() => void handleGenerateBrief()}
      />

      <PanelCard style={{ gap: space.sm }}>
        <PanelCardTitle>{t("weekly_report_share_title")}</PanelCardTitle>
        <TextField
          label={t("my_note_hint", { count: evaluation.length, max: 1200 })}
          value={evaluation}
          onChangeText={setEvaluation}
          maxLength={1200}
          multiline
          style={{ minHeight: 96, paddingTop: 10, textAlignVertical: "top" }}
        />
        {previousFinalized ? (
          <AppText variant="caption" tone="secondary">
            {t("weekly_report_correction", { version: previousFinalized.version + 1 })}
          </AppText>
        ) : null}
        <Button
          label={t("weekly_report_finalize")}
          loading={busy}
          onPress={() => void handleFinalize()}
        />
      </PanelCard>

      {archive.length > 0 ? (
        <PanelCard style={{ gap: space.sm }}>
          <PanelCardTitle>
            {t("weekly_report_archive")} ({archive.length})
          </PanelCardTitle>
          {archive.map((item) => (
            <View
              key={item.id}
              style={[
                styles.archiveRow,
                { backgroundColor: palette.surfaceAlt, borderRadius: radii.inner },
              ]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="cardTitle">
                  {formatDisplayDate(`${item.period.startDate}T12:00:00.000Z`, locale)} -{" "}
                  {formatDisplayDate(`${item.period.endDate}T12:00:00.000Z`, locale)}
                </AppText>
                <AppText variant="micro" tone="secondary">
                  v{item.version} · {formatDisplayDate(item.finalizedAt, locale)}
                </AppText>
              </View>
              <Button
                label={t("weekly_share_cta")}
                variant="secondary"
                onPress={() => void handleShareReport(item.id)}
              />
            </View>
          ))}
        </PanelCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  weekBar: { flexDirection: "row", alignItems: "center", gap: 8 },
  metricRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 4 },
  archiveRow: {
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
