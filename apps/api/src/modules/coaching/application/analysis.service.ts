import { Inject, Injectable } from "@nestjs/common";
import { I18nContext, I18nService } from "nestjs-i18n";
import type {
  CoachingAnalysisDto,
  GhostComparisonDto,
  NotebookErrorSignalDto,
} from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { CONTENT_PORT, type ContentPort } from "../domain/content.port";
import { buildFocusTrend, selectAnalysisFocus } from "../domain/analysis-focus";
import { toSharePercent } from "../domain/analysis-improvement";
import { computeGhost } from "../domain/ghost";
import { selectErrorPattern } from "../domain/notebook-error-pattern.policy";
import { MistakeNotebookRepository } from "../infrastructure/mistake-notebook.repository";
import {
  MockExamRepository,
} from "../infrastructure/mock-exam.repository";
import { PlanTaskRepository } from "../infrastructure/plan-task.repository";
import { AnalysisCycleReader } from "./analysis-cycle-reader";
import type { AnalysisCoachContext } from "../domain/analysis-coach-context";

export const ANALYSIS_NOTEBOOK_WINDOW_DAYS = 60;
const NOTEBOOK_SIGNAL_WINDOW_MS =
  ANALYSIS_NOTEBOOK_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/** Read model for deterministic analysis and the latest measurable improvement loop. */
@Injectable()
export class AnalysisService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(CONTENT_PORT) private readonly content: ContentPort,
    private readonly mockExams: MockExamRepository,
    private readonly notebook: MistakeNotebookRepository,
    private readonly planTasks: PlanTaskRepository,
    private readonly i18n: I18nService,
  ) {}

  async getAnalysis(userId: string, examId?: string): Promise<CoachingAnalysisDto> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const now = new Date();
      const notebookSince = new Date(now.getTime() - NOTEBOOK_SIGNAL_WINDOW_MS);
      const [trendRows, breakdown, notebookStats, latestAnalysisTask] = await Promise.all([
        this.mockExams.listTrend(tx, userId, 12, examId),
        this.mockExams.listSubjectBreakdown(tx, userId, examId),
        this.notebook.analysisStats(tx, userId, examId, notebookSince, now),
        this.planTasks.findLatestAnalysisTask(tx, userId, examId),
      ]);
      const recentRows = trendRows.slice(0, 4);
      const recentSubjectsByMockExamId = await this.mockExams.listSubjectsByMockExamIds(
        tx,
        recentRows.map((row) => row.id),
      );

      const examIds = [
        ...new Set([...(examId ? [examId] : []), ...trendRows.map((row) => row.examId)]),
      ];
      const [taxonomyEntries, topicTaxonomyEntries, examEntries] = await Promise.all([
        Promise.all(examIds.map((id) => this.content.listExamSubjects(id))),
        Promise.all(examIds.map((id) => this.content.listExamTopics(id))),
        Promise.all(examIds.map((id) => this.content.getExamById(id))),
      ]);

      const slugToName = new Map<string, string>();
      const questionCountsBySlug = new Map<string, Set<number | null>>();
      for (const taxonomy of taxonomyEntries) {
        for (const subject of taxonomy) {
          slugToName.set(subject.slug, subject.name);
          const counts = questionCountsBySlug.get(subject.slug) ?? new Set<number | null>();
          counts.add(subject.questionCount ?? null);
          questionCountsBySlug.set(subject.slug, counts);
        }
      }
      const topicByKey = new Map(
        topicTaxonomyEntries.flat().map((topic) => [topic.subjectSlug + ":" + topic.slug, topic]),
      );
      const examNameById = new Map(
        examIds.map((id, index) => [id, examEntries[index]?.name ?? "Deneme"]),
      );
      const trend = trendRows.map((row) => ({
        id: row.id,
        takenAt: row.takenAt.toISOString(),
        totalNet: String(row.totalNet),
        examName: examNameById.get(row.examId) ?? "Deneme",
      }));

      const recentTotals = new Map<string, { sum: number; count: number }>();
      for (const rows of recentSubjectsByMockExamId.values()) {
        for (const row of rows) {
          const current = recentTotals.get(row.subjectRef) ?? { sum: 0, count: 0 };
          current.sum += Number(row.net);
          current.count += 1;
          recentTotals.set(row.subjectRef, current);
        }
      }
      const recentAverageBySubject = new Map(
        [...recentTotals].map(([subjectRef, total]) => [
          subjectRef,
          (total.sum / total.count).toFixed(2),
        ]),
      );
      const toStrength = (
        subjectRef: string,
        averageNet: string,
        attemptCount: number,
        recentAverageNet: string | null = null,
      ) => {
        const counts = questionCountsBySlug.get(subjectRef);
        const questionCount = counts?.size === 1 ? ([...counts][0] ?? null) : null;
        return {
          subjectRef,
          subjectName: slugToName.get(subjectRef) ?? subjectRef,
          averageNet,
          attemptCount,
          questionCount,
          normalizedAveragePercent:
            questionCount != null && questionCount > 0
              ? ((Number(averageNet) / questionCount) * 100).toFixed(2)
              : null,
          recentAverageNet,
          netDelta:
            recentAverageNet != null
              ? (Number(recentAverageNet) - Number(averageNet)).toFixed(2)
              : null,
        };
      };
      const subjects = breakdown.map((row) =>
        toStrength(
          row.subjectRef,
          row.avgNet,
          row.attemptCount,
          recentAverageBySubject.get(row.subjectRef) ?? null,
        ),
      );
      const recentSubjects = [...recentTotals].map(([subjectRef, total]) =>
        toStrength(subjectRef, (total.sum / total.count).toFixed(2), total.count),
      );

      const [subjectSignals, topicSignalRows, errorSignals] = await Promise.all([
        this.notebook.listSubjectSignals(tx, userId, examId, notebookSince),
        this.notebook.listTopicSignals(tx, userId, examId, notebookSince),
        this.notebook.listErrorTypeSignals(tx, userId, examId, notebookSince),
      ]);
      const subjectSignalTotal = subjectSignals.reduce((sum, row) => sum + row.count, 0);
      const topicTotals = new Map<string, number>();
      for (const row of topicSignalRows) {
        topicTotals.set(row.subjectRef, (topicTotals.get(row.subjectRef) ?? 0) + row.count);
      }
      const errorSignalTotal = errorSignals.reduce((sum, row) => sum + row.count, 0);
      const photoSubjectSignals = subjectSignals.map((row) => ({
        subjectRef: row.subjectRef,
        subjectName: slugToName.get(row.subjectRef) ?? row.subjectRef,
        count: row.count,
        sharePercent: toSharePercent(row.count, subjectSignalTotal),
      }));
      const topicFocusSignals = topicSignalRows.flatMap((row) => {
        const topic = topicByKey.get(row.subjectRef + ":" + row.topicRef);
        return topic
          ? [{
              subjectRef: row.subjectRef,
              subjectName: topic.subjectName,
              topicRef: row.topicRef,
              topicName: topic.name,
              count: row.count,
              sharePercent: toSharePercent(row.count, topicTotals.get(row.subjectRef) ?? 0),
              latestAt: new Date(row.latestAt).toISOString(),
            }]
          : [];
      });
      const photoTopicSignals = topicFocusSignals.map(({ latestAt: _latestAt, ...signal }) => signal);
      const focus = selectAnalysisFocus(recentSubjects, photoSubjectSignals, topicFocusSignals);
      const focusTrend = focus
        ? buildFocusTrend(focus.subjectRef, recentRows, recentSubjectsByMockExamId)
        : null;
      const nextFocus =
        focus && focusTrend
          ? {
              ...focus,
              message: this.translateFocus(
                focus.topicName
                  ? "coaching.focus.PHOTO_TOPIC_REPEATED"
                  : `coaching.focus.${focus.source}_${focus.evidenceLevel}`,
                focus.subjectName,
                focus.topicName,
              ),
              suggestedTaskTitle: this.translateFocus(
                focus.topicName
                  ? "coaching.focus.TASK_TITLE_PHOTO_TOPIC"
                  : `coaching.focus.TASK_TITLE_${focus.source}`,
                focus.subjectName,
                focus.topicName,
              ),
              ...focusTrend,
              trendMessage: this.translateFocus(
                `coaching.focus.TREND_${focusTrend.trendDirection}`,
                focus.subjectName,
              ),
            }
          : null;

      const errorPattern = selectErrorPattern(errorSignals);
      const [ghost, personalRecordNet, improvementCycle] = await Promise.all([
        this.buildGhost(tx, userId, examId),
        this.mockExams.maxTotalNet(tx, userId, examId),
        new AnalysisCycleReader(this.mockExams, this.notebook, this.i18n).read(
          tx,
          userId,
          latestAnalysisTask,
          slugToName,
          topicByKey,
          now,
        ),
      ]);
      return {
        trend,
        subjects,
        photoSubjectSignals,
        photoTopicSignals,
        notebookErrorSignals: errorSignals.map((signal) => ({
          errorType: signal.errorType as NotebookErrorSignalDto["errorType"],
          count: signal.count,
          sharePercent: toSharePercent(signal.count, errorSignalTotal),
        })),
        notebookErrorMessage: errorPattern
          ? (this.i18n.translate(`coaching.notebook_pattern.${errorPattern}`, {
              lang: I18nContext.current()?.lang ?? "tr",
            }) as unknown as string)
          : null,
        notebookStats: { windowDays: ANALYSIS_NOTEBOOK_WINDOW_DAYS, ...notebookStats },
        improvementCycle,
        nextFocus,
        personalRecordNet,
        ghost,
      };
    });
  }

  async getCoachContext(userId: string, examId: string): Promise<AnalysisCoachContext> {
    const analysis = await this.getAnalysis(userId, examId);
    const focus = analysis.nextFocus;
    const error = analysis.notebookErrorSignals[0];
    return {
      focus: focus ? {
        subjectName: focus.subjectName,
        ...(focus.topicName && { topicName: focus.topicName }),
        source: focus.source,
        evidenceCount: focus.evidenceCount,
      } : null,
      dominantError: error ? {
        errorType: error.errorType, count: error.count, sharePercent: error.sharePercent,
      } : null,
      notebookStats: {
        savedCount: analysis.notebookStats.savedCount,
        reviewedCount: analysis.notebookStats.reviewedCount,
        dueCount: analysis.notebookStats.dueCount,
        healedCount: analysis.notebookStats.healedCount,
      },
    };
  }

  private async buildGhost(
    tx: DatabaseTx,
    userId: string,
    examId?: string,
  ): Promise<GhostComparisonDto | null> {
    const latest2 = await this.mockExams.listTrend(tx, userId, 2, examId);
    if (latest2.length < 2) return null;
    const latest = latest2[0]!;
    const previous = latest2[1]!;
    const [bestPrev, subjectMap, exam, taxonomy] = await Promise.all([
      this.mockExams.maxNetExcluding(tx, userId, latest.id, examId),
      this.mockExams.listSubjectsByMockExamIds(tx, [latest.id, previous.id]),
      this.content.getExamById(latest.examId),
      this.content.listExamSubjects(latest.examId),
    ]);
    const slugToName = new Map(taxonomy.map((subject) => [subject.slug, subject.name]));
    const subjectOrder = new Map(
      taxonomy.map((subject, index) => [subject.slug, subject.sortOrder ?? index]),
    );
    const { headlineKey, ...ghost } = computeGhost({
      latest: {
        id: latest.id,
        takenAt: latest.takenAt,
        totalNet: latest.totalNet,
        examName: exam?.name ?? "Deneme",
      },
      previousNet: previous.totalNet,
      bestPreviousNet: bestPrev ?? previous.totalNet,
      latestSubjects: [...(subjectMap.get(latest.id) ?? [])]
        .sort(
          (a, b) =>
            (subjectOrder.get(a.subjectRef) ?? Number.MAX_SAFE_INTEGER) -
            (subjectOrder.get(b.subjectRef) ?? Number.MAX_SAFE_INTEGER),
        )
        .map((row) => ({ subjectRef: row.subjectRef, net: row.net })),
      previousSubjects: (subjectMap.get(previous.id) ?? []).map((row) => ({
        subjectRef: row.subjectRef,
        net: row.net,
      })),
      subjectName: (ref) => slugToName.get(ref) ?? ref,
    });
    return {
      ...ghost,
      headline: this.translate(headlineKey),
      aiNarration: latest.aiGhostNarration,
    };
  }

  private translateFocus(key: string, subject: string, topic?: string): string {
    return this.translate(key, { subject, topic });
  }

  private translate(key: string, args?: Record<string, unknown>): string {
    return this.i18n.translate(key, {
      lang: I18nContext.current()?.lang ?? "tr",
      args,
    }) as unknown as string;
  }
}
