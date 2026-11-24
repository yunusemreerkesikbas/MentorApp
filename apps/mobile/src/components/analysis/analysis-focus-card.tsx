import { useMutation } from "@tanstack/react-query";
import { View } from "react-native";
import { AddIcon } from "@solar-icons/react-native/linear/add";
import { Pen2Icon } from "@solar-icons/react-native/bold/pen-2";
import { PlayIcon } from "@solar-icons/react-native/bold/play";
import { buildFocusPath, formatShortDate } from "@mentor/core";
import type { CoachingAnalysisDto } from "@mentor/types";
import { createAnalysisFocusPlanTask, type MistakeScope } from "../../lib/analysis-api.js";
import { haptics } from "../../lib/haptics.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { CompanionBubble } from "../panel/companion-bubble.js";
import { LedgeButton, PanelCard } from "../panel/primitives.js";
import { AppText, Button } from "../ui/index.js";
import { AnalysisLink } from "./analysis-link.js";
import { AnalysisFocusSteps } from "./analysis-focus-steps.js";

export function AnalysisFocusCard({
  examId, analysis, dueCount, onEntry, onReview, onCoach, onRefresh,
}: {
  examId: string;
  analysis: CoachingAnalysisDto;
  dueCount: number | null;
  onEntry: () => void;
  onReview: (scope: MistakeScope, start: boolean) => void;
  onCoach: (id: string, seed: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const { locale } = useLocale();
  const t = useTranslations("analysisFocus");
  const tCommon = useTranslations("common");
  const { space } = useThemeTokens();
  const view = buildFocusPath(analysis, examId, dueCount);
  const added = useMutation({
    mutationFn: createAnalysisFocusPlanTask,
    onSuccess: async () => {
      haptics.success();
      await onRefresh();
    },
  });

  if (!view) return null;
  const ghost = analysis.ghost;
  const narration = ghost?.aiNarration;
  const bubble = (
    <CompanionBubble
      mood={ghost?.beatPrevious ? "winking" : ghost || view.kind === "empty" ? "encouraging" : "default"}
      text={narration || ghost?.headline || t(view.kind === "empty" ? "bubble_empty" : "bubble_first")}
      aiLabel={narration ? t("ai_label") : null}
    />
  );

  if (view.kind === "empty") {
    const label = t("cta_first_exam");
    return (
      <PanelCard style={{ gap: space.lg }}>
        {bubble}
        <View style={{ gap: space.xs }}>
          <AppText variant="title" accessibilityRole="header">{t("title_empty")}</AppText>
          <AppText tone="secondary">{t("reason_empty")}</AppText>
        </View>
        <AnalysisFocusSteps />
        <LedgeButton accessibilityLabel={label} onPress={onEntry}>
          {(ink) => <><AddIcon size={20} color={ink} /><AppText variant="cardTitle" tone="ctaInk">{label}</AppText></>}
        </LedgeButton>
      </PanelCard>
    );
  }

  const { cta, cycleState, subjectName, topicName, proposal } = view;
  const name = topicName ?? subjectName;
  const newFocus = cta.kind === "ADD_TO_PLAN" && cta.newFocus;
  const title = newFocus
    ? t(cycleState === "closed" ? "title_closed" : "title_new_focus", { name })
    : cta.kind === "ADD_TO_PLAN"
      ? t(view.source === "PHOTO_SIGNAL" ? "title_signal_notebook" : "title_signal_average", { name })
      : cta.kind === "NEW_EXAM"
        ? t(cycleState === "practiced" ? "title_practiced" : "title_measure")
        : t("title_review", { name });
  const label = cta.kind === "ADD_TO_PLAN" ? t(cta.newFocus ? "add_new_focus" : "add_to_plan")
    : cta.kind === "REVIEW" ? (cta.count == null ? t("cta_review") : t(cta.count === 1 ? "cta_review_one" : "cta_review_count", { count: cta.count }))
      : t(cta.kind === "OPEN_NOTEBOOK" ? "review" : "cta_new_exam");
  const Icon = cta.kind === "ADD_TO_PLAN" ? AddIcon : cta.kind === "REVIEW" ? PlayIcon : Pen2Icon;
  const sameWrite = cta.kind === "ADD_TO_PLAN" &&
    added.variables?.baselineMockExamId === cta.query.baselineMockExamId &&
    added.variables?.expectedSubjectRef === cta.query.subjectRef &&
    added.variables?.expectedTopicRef === (cta.query.topicRef ?? null);
  const next = () => {
    if (cta.kind === "NEW_EXAM") return onEntry();
    if (cta.kind !== "ADD_TO_PLAN") return onReview({ subjectRef: cta.query.subjectRef, topicRef: cta.query.topicRef }, cta.kind === "REVIEW");
    if (added.isPending || (sameWrite && added.isSuccess)) return;
    const { baselineMockExamId, subjectRef, topicRef, title } = cta.query;
    if (baselineMockExamId && subjectRef && title) {
      added.mutate({ examId, baselineMockExamId, expectedSubjectRef: subjectRef, expectedTopicRef: topicRef ?? null, title });
    }
  };

  return (
    <PanelCard style={{ gap: space.lg }}>
      {bubble}
      <View style={{ gap: space.xs }}>
        {topicName || !title.includes(subjectName) ? (
          <AppText variant="caption" tone="secondary">{[subjectName, topicName].filter(Boolean).join(" · ")}</AppText>
        ) : null}
        <AppText variant="title" accessibilityRole="header">{title}</AppText>
        {view.message ? <AppText tone="secondary">{view.message}</AppText> : null}
      </View>
      <AnalysisFocusSteps steps={view.steps} meta={{
        signal: view.source === "PHOTO_SIGNAL"
          ? t(view.evidenceCount === 1 ? "meta_signal_one" : "meta_signal_notebook", { count: view.evidenceCount })
          : t("meta_signal_average"),
        planned: view.plannedAt ? formatShortDate(view.plannedAt, locale)
          : cta.kind === "ADD_TO_PLAN" && !newFocus ? t("meta_planned_next") : null,
        practiced: view.reviewed ? t("meta_reviewed", view.reviewed) : null,
        measured: view.followUpDelta ? t("meta_delta", { delta: view.followUpDelta }) : t("meta_next_exam"),
      }} />
      <View style={{ gap: space.sm }}>
        {proposal ? <AppText variant="caption">{t("proposal")} {[proposal.subjectName, proposal.topicName].filter(Boolean).join(" · ")}</AppText> : null}
        {sameWrite && added.isError ? (
          <AppText variant="caption" tone="danger">{added.error instanceof Error ? added.error.message : tCommon("error_body")}</AppText>
        ) : null}
        {sameWrite && added.isSuccess ? (
          <AppText accessibilityLiveRegion="polite" tone="success">{t("focus_added")}</AppText>
        ) : added.isPending ? <Button label={tCommon("loading")} onPress={next} disabled /> : (
          <LedgeButton accessibilityLabel={label} onPress={next} variant={cta.kind === "OPEN_NOTEBOOK" ? "outline" : "filled"}>
            {(ink) => <>
              {cta.kind !== "OPEN_NOTEBOOK" ? <Icon size={20} color={ink} /> : null}
              <AppText variant="cardTitle" style={{ color: ink, flexShrink: 1 }}>{label}</AppText>
            </>}
          </LedgeButton>
        )}
        {view.coachMockExamId ? (
          <AnalysisLink label={t("coach")} onPress={() => {
            if (view.coachMockExamId) onCoach(view.coachMockExamId, topicName
              ? t("coach_seed", { subject: subjectName, topic: topicName })
              : t("coach_seed_subject", { subject: subjectName }));
          }} />
        ) : null}
      </View>
    </PanelCard>
  );
}
