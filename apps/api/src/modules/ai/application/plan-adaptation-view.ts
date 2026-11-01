import { I18nContext, type I18nService } from "nestjs-i18n";
import {
  CoachEvidenceType,
  type CoachPlanAdaptationDto,
  type CoachPlanAdaptationStatus,
} from "@mentor/types";
import type { CoachEvidenceService } from "../../coaching/application/coach-evidence.service";
import type { PlanService } from "../../coaching/application/plan.service";
import type { PromptEvidence } from "../domain/plan-adaptation";
type AdaptationSnapshot = Awaited<
  ReturnType<PlanService["getAdaptationSnapshot"]>
>;

export function coachPlanNote(
  i18n: I18nService,
  pool: Awaited<ReturnType<CoachEvidenceService["build"]>>,
  minutes: number,
  changes: CoachPlanAdaptationDto["changes"],
): string {
  const lang = I18nContext.current()?.lang;
  const additions = changes.filter((change) => change.kind === "ADD");
  const days = new Set(additions.map((change) => change.taskDate)).size;
  const selectedSubjects = additions.flatMap((change) =>
    change.subject ? [change.subject] : [],
  );
  const weak = pool.weakSubjects.filter((subject) =>
    selectedSubjects.some(
      (selected) =>
        selected.toLocaleLowerCase("tr-TR") ===
        subject.toLocaleLowerCase("tr-TR"),
    ),
  );
  const priority = weak.length
    ? (i18n.translate("coaching.planAdaptation.coachNotePriority", {
        lang,
        args: { subjects: weak.join(", ") },
      }) as unknown as string)
    : "";
  const rhythm =
    pool.averageSessionMinutes28d != null && pool.averageSessionMinutes28d > 0
      ? (i18n.translate("coaching.planAdaptation.coachNoteRhythm", {
          lang,
          args: {
            average: Math.round(pool.averageSessionMinutes28d),
            minutes,
            days,
          },
        }) as unknown as string)
      : (i18n.translate("coaching.planAdaptation.coachNoteGoal", {
          lang,
          args: { minutes, days },
        }) as unknown as string);
  const goal = pool.evidence.find(
    (item) => item.type === CoachEvidenceType.GOAL,
  )?.summary;
  return [goal, priority, rhythm].filter(Boolean).join(" ");
}

export function planAdaptationToday(
  snapshot: AdaptationSnapshot,
): { total: number; done: number } | null {
  const today = snapshot.tasks.filter(
    (task) => task.taskDate === snapshot.window.from,
  );
  return today.length > 0
    ? {
        total: today.length,
        done: today.filter((task) => task.status === "DONE").length,
      }
    : null;
}

export function visiblePlanEvidence(evidence: PromptEvidence[]) {
  return evidence.map(({ ref: _ref, ...item }) => item);
}

export function planAdaptationResponse(
  i18n: I18nService,
  status: CoachPlanAdaptationStatus,
  snapshot: AdaptationSnapshot,
  changes: CoachPlanAdaptationDto["changes"],
  model: string,
  groundingLine: string | null,
  evidence: PromptEvidence[],
  messageKey: CoachPlanAdaptationStatus | "REST" = status,
  coachNote: string | null = null,
): CoachPlanAdaptationDto {
  return {
    status,
    message: i18n.translate(`coaching.planAdaptation.${messageKey}`, {
      lang: I18nContext.current()?.lang,
    }) as unknown as string,
    groundingLine,
    ...(coachNote ? { coachNote } : {}),
    window: snapshot.window,
    planRevision: snapshot.planRevision,
    changes,
    model,
    usedEvidence: visiblePlanEvidence(evidence),
  };
}
