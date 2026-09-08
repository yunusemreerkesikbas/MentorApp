import { I18nContext, type I18nService } from "nestjs-i18n";
import type { AnalysisImprovementCycleDto } from "@mentor/types";
import type { DatabaseTx } from "../../../database/drizzle";
import { analysisCycleSteps } from "../domain/analysis-improvement";
import type { MockExamRepository } from "../infrastructure/mock-exam.repository";
import type { MistakeNotebookRepository } from "../infrastructure/mistake-notebook.repository";
import type { PlanTaskRow } from "../infrastructure/plan-task.repository";

type AnalysisOriginMeta = {
  baselineMockExamId: string;
  subjectRef: string;
  topicRef?: string;
  source: "PHOTO_SIGNAL" | "LOWEST_AVERAGE";
  evidenceCount: number;
};

function analysisMeta(row: PlanTaskRow): AnalysisOriginMeta | null {
  const meta = row.originMeta;
  if (
    row.originType !== "ANALYSIS" ||
    !meta ||
    !("baselineMockExamId" in meta) ||
    !("subjectRef" in meta) ||
    !("source" in meta) ||
    !("evidenceCount" in meta) ||
    typeof meta.baselineMockExamId !== "string" ||
    typeof meta.subjectRef !== "string" ||
    (meta.source !== "PHOTO_SIGNAL" && meta.source !== "LOWEST_AVERAGE") ||
    typeof meta.evidenceCount !== "number"
  ) {
    return null;
  }
  return {
    baselineMockExamId: meta.baselineMockExamId,
    subjectRef: meta.subjectRef,
    ...(typeof meta.topicRef === "string" && { topicRef: meta.topicRef }),
    source: meta.source,
    evidenceCount: meta.evidenceCount,
  };
}

export class AnalysisCycleReader {
  constructor(
    private readonly mockExams: MockExamRepository,
    private readonly notebook: MistakeNotebookRepository,
    private readonly i18n: I18nService,
  ) {}

  async read(
    tx: DatabaseTx,
    userId: string,
    task: PlanTaskRow | undefined,
    subjectNames: Map<string, string>,
    topicByKey: Map<string, { name: string }>,
    now: Date,
  ): Promise<AnalysisImprovementCycleDto | null> {
    if (!task || !task.originRefId) return null;
    const meta = analysisMeta(task);
    if (!meta) return null;
    const baseline = await this.mockExams.findById(tx, userId, meta.baselineMockExamId);
    const baselineSubject = baseline?.subjects.find((row) => row.subjectRef === meta.subjectRef);
    const activity = await this.notebook.focusActivity(
      tx,
      userId,
      task.originRefId,
      meta.subjectRef,
      meta.topicRef,
      task.createdAt,
      now,
    );
    const followUp =
      baseline && baselineSubject
        ? await this.mockExams.findFirstComparableSubjectAttempt(
            tx,
            userId,
            task.originRefId,
            meta.subjectRef,
            task.createdAt,
            baseline.exam.takenAt,
          )
        : undefined;
    const steps = analysisCycleSteps({
      taskStatus: task.status === "DONE" ? "DONE" : "PENDING",
      reviewedAfterPlanCount: activity.reviewedAfterPlanCount,
      hasFollowUp: Boolean(followUp),
    });
    const subjectName = subjectNames.get(meta.subjectRef) ?? task.subject ?? meta.subjectRef;
    const topicName = meta.topicRef
      ? topicByKey.get(meta.subjectRef + ":" + meta.topicRef)?.name ?? task.topic ?? meta.topicRef
      : undefined;
    const delta =
      baselineSubject && followUp
        ? this.formatSigned(Number(followUp.net) - Number(baselineSubject.net))
        : null;
    const message = !baseline || !baselineSubject
      ? this.translate("coaching.improvement_cycle.BASELINE_MISSING")
      : followUp && delta != null
        ? this.translate("coaching.improvement_cycle.RESULT", {
            subject: subjectName,
            baseline: this.formatNet(Number(baselineSubject.net)),
            followUp: this.formatNet(Number(followUp.net)),
            delta: this.formatNet(Number(delta), true),
          })
        : steps.practiced
          ? this.translate("coaching.improvement_cycle.WAITING_MEASUREMENT")
          : this.translate("coaching.improvement_cycle.WAITING_PRACTICE");
    return {
      task: {
        id: task.id,
        title: task.title,
        status: task.status === "DONE" ? "DONE" : "PENDING",
        taskDate: task.taskDate,
        createdAt: task.createdAt.toISOString(),
      },
      focus: {
        subjectRef: meta.subjectRef,
        subjectName,
        ...(meta.topicRef && { topicRef: meta.topicRef }),
        ...(topicName && { topicName }),
        source: meta.source,
        evidenceCount: meta.evidenceCount,
      },
      baseline:
        baseline && baselineSubject
          ? {
              mockExamId: baseline.exam.id,
              takenAt: baseline.exam.takenAt.toISOString(),
              net: String(baselineSubject.net),
            }
          : null,
      notebook: activity,
      steps,
      followUp:
        followUp && delta != null
          ? {
              mockExamId: followUp.exam.id,
              takenAt: followUp.exam.takenAt.toISOString(),
              net: String(followUp.net),
              delta,
            }
          : null,
      message,
    };
  }

  private formatSigned(value: number): string {
    const rounded = value.toFixed(2);
    return value > 0 ? `+${rounded}` : rounded;
  }

  private formatNet(value: number, signed = false): string {
    return new Intl.NumberFormat(I18nContext.current()?.lang ?? "tr", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay: signed ? "exceptZero" : "auto",
    }).format(value);
  }

  private translate(key: string, args?: Record<string, unknown>): string {
    return this.i18n.translate(key, {
      lang: I18nContext.current()?.lang ?? "tr",
      args,
    }) as unknown as string;
  }
}
