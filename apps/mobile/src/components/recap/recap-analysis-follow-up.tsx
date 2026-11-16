import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { parseNet, todayIso } from "@mentor/core";
import type { PlanTaskDto, WeeklyRecapReportDto, WeeklyReportFollowUpDto } from "@mentor/types";
import { haptics } from "../../lib/haptics.js";
import { useCelebrations } from "../../providers/celebration-provider.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { PanelCard, PanelCardTitle } from "../panel/primitives.js";
import { PlanTaskFormSheet, type PlanFormMode } from "../plan/plan-task-form-sheet.js";
import { Button } from "../ui/button.js";
import { AppText } from "../ui/text.js";
import { RecapDelta } from "./recap-analysis-evidence.js";
import { formatRecapDay } from "./recap-format.js";

type PlanLink = (date: string) => void;

export function RecapNextStep({ report, followUp, onPlan }: {
  report: WeeklyRecapReportDto;
  followUp: UseQueryResult<WeeklyReportFollowUpDto>;
  onPlan: PlanLink;
}) {
  const t = useTranslations("recapReport");
  const { palette } = useThemeTokens();
  const queryClient = useQueryClient();
  const celebrations = useCelebrations();
  const [mode, setMode] = useState<PlanFormMode | null>(null);
  const suggestion = report.review.suggestedTask;
  const tracked = followUp.data?.task;
  const title = tracked?.title ?? suggestion?.title;
  const openForm = () => {
    if (!suggestion) return;
    setMode({
      kind: "add", date: todayIso(), weeklyReportId: report.id,
      prefill: { title: suggestion.title, subject: suggestion.subject ?? "" },
    });
  };
  const saved = (task: PlanTaskDto) => {
    setMode(null);
    haptics.success();
    celebrations.refresh();
    queryClient.setQueryData<WeeklyReportFollowUpDto>(["weekly-report-follow-up", report.id],
      (previous) => ({ task, previous: previous?.previous ?? null }));
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["weekly-report-follow-up"] }),
      queryClient.invalidateQueries({ queryKey: ["plan-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["coaching", "today"] }),
      queryClient.invalidateQueries({ queryKey: ["economy", "quests"] }),
    ]);
  };

  return (
    <PanelCard style={styles.section}>
      <PanelCardTitle>{t("next_step")}</PanelCardTitle>
      {followUp.isPending ? (
        <ActivityIndicator accessibilityLabel={t("step_loading")} color={palette.progress} />
      ) : !followUp.data ? (
        <>
          <AppText tone="secondary">{t("step_error")}</AppText>
          <Button variant="secondary" label={t("retry")} onPress={() => void followUp.refetch()} />
        </>
      ) : !title ? (
        <AppText tone="secondary">{t("no_task")}</AppText>
      ) : (
        <>
          <AppText variant="title">{title}</AppText>
          {report.review.focus ? <AppText>{report.review.focus.message}</AppText> : null}
          {tracked ? <TrackedTask task={tracked} onPlan={onPlan} /> : (
            <>
              <Button label={t("add")} onPress={openForm} />
              <AppText variant="caption" tone="secondary">{t("add_hint")}</AppText>
            </>
          )}
        </>
      )}
      <PlanTaskFormSheet mode={mode} onClose={() => setMode(null)} onSaved={saved} />
    </PanelCard>
  );
}

export function RecapPreviousStep({ previous, onPlan }: {
  previous?: WeeklyReportFollowUpDto["previous"];
  onPlan: PlanLink;
}) {
  const t = useTranslations("recapReport");
  const { locale } = useLocale();
  if (!previous) return null;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const net = (value: number) => t("net", { net: number.format(value) });
  const baseline = parseNet(previous.baselineNet);
  const measured = parseNet(previous.measurement?.net ?? null);
  const delta = parseNet(previous.measurement?.delta ?? null);

  return (
    <PanelCard style={styles.section}>
      <PanelCardTitle>{t("previous_step")}</PanelCardTitle>
      <AppText variant="cardTitle">{previous.task.title}</AppText>
      {baseline !== null ? (
        <View style={styles.comparison}>
          <View style={styles.measurement}>
            <AppText variant="caption" tone="secondary">{t("baseline_label")}</AppText>
            <AppText tabularNums variant="cardTitle">{net(baseline)}</AppText>
          </View>
          <View style={styles.measurement}>
            <AppText variant="caption" tone="secondary">{t("measurement_label")}</AppText>
            <AppText tabularNums variant="cardTitle">{measured === null ? t("measurement_pending") : net(measured)}</AppText>
          </View>
          {delta ? <RecapDelta delta={delta} value={number.format(Math.abs(delta))} /> : null}
        </View>
      ) : null}
      <AppText variant="caption" tone="secondary">{previous.message}</AppText>
      <TrackedTask task={previous.task} onPlan={onPlan} />
    </PanelCard>
  );
}

function TrackedTask({ task, onPlan }: { task: PlanTaskDto; onPlan: PlanLink }) {
  const t = useTranslations("recapReport");
  const { locale } = useLocale();
  const { palette } = useThemeTokens();
  const done = task.status === "DONE";
  return (
    <>
      <AppText variant="caption" style={{ color: done ? palette.success : palette.playSelectedInk, fontWeight: "800" }}>
        {done ? t("done") : t("planned", { date: formatRecapDay(task.taskDate, locale) })}
      </AppText>
      <Button variant="secondary" label={t("go_plan")} onPress={() => onPlan(task.taskDate)} />
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  comparison: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  measurement: { flexGrow: 1, flexBasis: 120, gap: 4 },
});
