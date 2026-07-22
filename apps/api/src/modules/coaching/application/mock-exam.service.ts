import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { I18nContext, I18nService } from "nestjs-i18n";
import type {
  CoachingAnalysisDto,
  GhostComparisonDto,
  MockExamDto,
  Paginated,
} from "@mentor/types";
import type {
  CreateMockExamInput,
  ListMockExamsQuery,
  UpdateMockExamInput,
} from "@mentor/validation";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import {
  STORAGE_PORT,
  type StoragePort,
} from "../../../shared/ports/storage.port";
import {
  CONTENT_PORT,
  type ContentPort,
  type ExamRef,
  type ExamSubjectRef,
} from "../domain/content.port";
import { computeGhost } from "../domain/ghost";
import { computeSubjectNet, computeTotalNet, formatNet } from "../domain/net";
import { buildFocusTrend, selectAnalysisFocus } from "../domain/analysis-focus";
import {
  MockExamRepository,
  type MockExamRow,
  type MockExamSubjectRow,
} from "../infrastructure/mock-exam.repository";
import {
  MockExamPhotoRepository,
  type MockExamPhotoRow,
} from "../infrastructure/mock-exam-photo.repository";
import { toMockExamDto } from "./coaching.mappers";

/**
 * Deneme (mock exam) CRUD + personal analysis. Net is computed server-side from the
 * exam's editorial net_rule (guardrail: FE never recomputes business values).
 */
@Injectable()
export class MockExamService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(CONTENT_PORT) private readonly content: ContentPort,
    private readonly mockExams: MockExamRepository,
    private readonly photoRows: MockExamPhotoRepository,
    private readonly i18n: I18nService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async create(
    userId: string,
    input: CreateMockExamInput,
  ): Promise<MockExamDto> {
    const exam = await this.content.getExamById(input.examId);
    if (!exam) {
      throw new DomainError(
        ErrorCode.CONTENT_EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        {
          examId: input.examId,
        },
      );
    }

    const taxonomy = await this.content.listExamSubjects(input.examId);
    const prepared = this.prepareResult(exam, taxonomy, input.subjects);
    return withUserContext(this.db, { userId }, async (tx) => {
      const created = await this.mockExams.create(tx, {
        userId,
        examId: input.examId,
        takenAt: input.takenAt ? new Date(input.takenAt) : new Date(),
        totalNet: prepared.totalNet,
        publisherName: input.publisherName ?? null,
        subjects: prepared.subjectRows,
      });
      return toMockExamDto(
        created.exam,
        created.subjects,
        exam.name,
        prepared.slugToName,
      );
    });
  }

  async getById(userId: string, id: string): Promise<MockExamDto> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.mockExams.findById(tx, userId, id);
      if (!row) {
        throw new DomainError(
          ErrorCode.COACHING_MOCK_EXAM_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      const subjectsMap = await this.mockExams.listSubjectsByMockExamIds(tx, [
        row.exam.id,
      ]);
      const [dto] = await this.buildMockExamDtos(tx, [row.exam], subjectsMap);
      return dto!;
    });
  }

  async update(
    userId: string,
    id: string,
    input: UpdateMockExamInput,
  ): Promise<MockExamDto> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const existing = await this.mockExams.findById(tx, userId, id);
      if (!existing) {
        throw new DomainError(
          ErrorCode.COACHING_MOCK_EXAM_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }

      const exam = await this.content.getExamById(existing.exam.examId);
      if (!exam) {
        throw new DomainError(
          ErrorCode.CONTENT_EXAM_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          {
            examId: existing.exam.examId,
          },
        );
      }
      const taxonomy = await this.content.listExamSubjects(
        existing.exam.examId,
      );
      const prepared = this.prepareResult(exam, taxonomy, input.subjects);
      const updated = await this.mockExams.update(tx, userId, id, {
        takenAt: new Date(input.takenAt),
        totalNet: prepared.totalNet,
        publisherName: input.publisherName,
        subjects: prepared.subjectRows,
      });
      if (!updated) {
        throw new DomainError(
          ErrorCode.COACHING_MOCK_EXAM_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      await this.mockExams.clearGhostNarrations(
        tx,
        userId,
        existing.exam.examId,
      );
      return toMockExamDto(
        updated.exam,
        updated.subjects,
        exam.name,
        prepared.slugToName,
      );
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const storageKeys = await withUserContext(
      this.db,
      { userId },
      async (tx) => {
        const existing = await this.mockExams.findById(tx, userId, id);
        if (!existing) {
          throw new DomainError(
            ErrorCode.COACHING_MOCK_EXAM_NOT_FOUND,
            HttpStatus.NOT_FOUND,
          );
        }
        const keys = await this.photoRows.listStorageKeys(tx, userId, id);
        await this.mockExams.delete(tx, userId, id);
        await this.mockExams.clearGhostNarrations(
          tx,
          userId,
          existing.exam.examId,
        );
        return keys;
      },
    );

    await Promise.allSettled(
      storageKeys.map((storageKey) => this.storage.deleteObject(storageKey)),
    );
  }

  async list(
    userId: string,
    query: ListMockExamsQuery,
  ): Promise<Paginated<MockExamDto>> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const { items, total } = await this.mockExams.listPaged(
        tx,
        userId,
        query.page,
        query.pageSize,
        query.examId,
      );
      if (items.length === 0) {
        return { items: [], total, page: query.page, pageSize: query.pageSize };
      }
      const subjectsMap = await this.mockExams.listSubjectsByMockExamIds(
        tx,
        items.map((i) => i.id),
      );
      const dtos = await this.buildMockExamDtos(tx, items, subjectsMap);
      return { items: dtos, total, page: query.page, pageSize: query.pageSize };
    });
  }

  async getAnalysis(
    userId: string,
    examId?: string,
  ): Promise<CoachingAnalysisDto> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const trendRows = await this.mockExams.listTrend(tx, userId, 12, examId);
      const breakdown = await this.mockExams.listSubjectBreakdown(
        tx,
        userId,
        examId,
      );
      const recentRows = trendRows.slice(0, 4);
      const recentIds = recentRows.map((row) => row.id);
      const recentSubjectsByMockExamId =
        await this.mockExams.listSubjectsByMockExamIds(tx, recentIds);

      const examIds = [...new Set(trendRows.map((r) => r.examId))];
      const [taxonomyEntries, topicTaxonomyEntries, examEntries] =
        await Promise.all([
          Promise.all(examIds.map((id) => this.content.listExamSubjects(id))),
          Promise.all(examIds.map((id) => this.content.listExamTopics(id))),
          Promise.all(examIds.map((id) => this.content.getExamById(id))),
        ]);

      const slugToName = new Map<string, string>();
      const questionCountsBySlug = new Map<string, Set<number | null>>();
      for (const taxonomy of taxonomyEntries) {
        for (const subject of taxonomy) {
          slugToName.set(subject.slug, subject.name);
          const counts =
            questionCountsBySlug.get(subject.slug) ?? new Set<number | null>();
          counts.add(subject.questionCount ?? null);
          questionCountsBySlug.set(subject.slug, counts);
        }
      }

      const topicByKey = new Map(
        topicTaxonomyEntries
          .flat()
          .map((topic) => [topic.subjectSlug + ":" + topic.slug, topic]),
      );

      const examNameById = new Map(
        examIds.map((id, i) => [id, examEntries[i]?.name ?? "Deneme"]),
      );
      const trend = trendRows.map((row) => ({
        id: row.id,
        takenAt: row.takenAt.toISOString(),
        totalNet: String(row.totalNet),
        examName: examNameById.get(row.examId) ?? "Deneme",
      }));

      const toStrength = (
        subjectRef: string,
        averageNet: string,
        attemptCount: number,
      ) => {
        const counts = questionCountsBySlug.get(subjectRef);
        const questionCount =
          counts?.size === 1 ? ([...counts][0] ?? null) : null;
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
        };
      };
      const subjects = breakdown.map((row) =>
        toStrength(row.subjectRef, row.avgNet, row.attemptCount),
      );

      const recentTotals = new Map<string, { sum: number; count: number }>();
      for (const rows of recentSubjectsByMockExamId.values()) {
        for (const row of rows) {
          const current = recentTotals.get(row.subjectRef) ?? {
            sum: 0,
            count: 0,
          };
          current.sum += Number(row.net);
          current.count += 1;
          recentTotals.set(row.subjectRef, current);
        }
      }
      const recentSubjects = [...recentTotals].map(([subjectRef, total]) =>
        toStrength(
          subjectRef,
          (total.sum / total.count).toFixed(2),
          total.count,
        ),
      );

      const [photoSignals, topicSignalRows] = await Promise.all([
        this.photoRows.listPhotoSubjectSignals(tx, userId, examId, recentIds),
        this.photoRows.listPhotoTopicSignals(
          tx,
          userId,
          examId,
          trendRows.map((row) => row.id),
        ),
      ]);
      const photoSubjectSignals = photoSignals.map((row) => ({
        subjectRef: row.subjectRef,
        subjectName: slugToName.get(row.subjectRef) ?? row.subjectRef,
        count: row.count,
      }));
      const topicFocusSignals = topicSignalRows.flatMap((row) => {
        const topic = topicByKey.get(row.subjectRef + ":" + row.topicRef);
        return topic
          ? [
              {
                subjectRef: row.subjectRef,
                subjectName: topic.subjectName,
                topicRef: row.topicRef,
                topicName: topic.name,
                count: row.count,
                latestAt: new Date(row.latestAt).toISOString(),
              },
            ]
          : [];
      });
      const photoTopicSignals = topicFocusSignals.map(
        ({ latestAt: _latestAt, ...signal }) => signal,
      );
      const focus = selectAnalysisFocus(
        recentSubjects,
        photoSubjectSignals,
        topicFocusSignals,
      );
      const focusTrend = focus
        ? buildFocusTrend(
            focus.subjectRef,
            recentRows,
            recentSubjectsByMockExamId,
          )
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

      const ghost = await this.buildGhost(tx, userId, examId);
      const personalRecordNet = await this.mockExams.maxTotalNet(
        tx,
        userId,
        examId,
      );
      return {
        trend,
        subjects,
        photoSubjectSignals,
        photoTopicSignals,
        nextFocus,
        personalRecordNet,
        ghost,
      };
    });
  }

  /** Rule-based "geçmiş-ben" comparison (also exposed to W3 for the premium AI narration). */
  async getGhostComparison(
    userId: string,
    examId?: string,
  ): Promise<GhostComparisonDto | null> {
    return withUserContext(this.db, { userId }, (tx) =>
      this.buildGhost(tx, userId, examId),
    );
  }

  /**
   * Cache the premium ghost narration on the user's latest attempt (table write stays in coaching —
   * workstreams §2; the AI module calls this instead of touching `mock_exams`).
   */
  async setLatestGhostNarration(
    userId: string,
    narration: string,
    model: string,
    examId?: string,
    locale = "tr",
  ): Promise<void> {
    await withUserContext(this.db, { userId }, async (tx) => {
      const latest = await this.mockExams.listTrend(tx, userId, 1, examId);
      if (latest.length === 0) return;
      await this.mockExams.setGhostNarration(
        tx,
        latest[0]!.id,
        narration,
        model,
        locale,
      );
    });
  }

  async getLatestGhostNarrationLocale(
    userId: string,
    examId?: string,
  ): Promise<string | null> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const latest = await this.mockExams.listTrend(tx, userId, 1, examId);
      return latest[0]?.aiNarrationLocale ?? null;
    });
  }

  /** Build the latest-vs-own-past comparison (null when fewer than 2 attempts). */
  private async buildGhost(
    tx: DatabaseTx,
    userId: string,
    examId?: string,
  ): Promise<GhostComparisonDto | null> {
    const latest2 = await this.mockExams.listTrend(tx, userId, 2, examId);
    if (latest2.length < 2) return null;
    const latest = latest2[0]!;
    const previous = latest2[1]!;

    const [bestPrev, subjMap, exam, taxonomy] = await Promise.all([
      this.mockExams.maxNetExcluding(tx, userId, latest.id, examId),
      this.mockExams.listSubjectsByMockExamIds(tx, [latest.id, previous.id]),
      this.content.getExamById(latest.examId),
      this.content.listExamSubjects(latest.examId),
    ]);
    const slugToName = new Map(taxonomy.map((s) => [s.slug, s.name]));
    const subjectOrder = new Map(
      taxonomy.map((subject, index) => [
        subject.slug,
        subject.sortOrder ?? index,
      ]),
    );

    const { headlineKey, ...rest } = computeGhost({
      latest: {
        id: latest.id,
        takenAt: latest.takenAt,
        totalNet: latest.totalNet,
        examName: exam?.name ?? "Deneme",
      },
      previousNet: previous.totalNet,
      bestPreviousNet: bestPrev ?? previous.totalNet,
      latestSubjects: [...(subjMap.get(latest.id) ?? [])]
        .sort(
          (a, b) =>
            (subjectOrder.get(a.subjectRef) ?? Number.MAX_SAFE_INTEGER) -
            (subjectOrder.get(b.subjectRef) ?? Number.MAX_SAFE_INTEGER),
        )
        .map((row) => ({
          subjectRef: row.subjectRef,
          net: row.net,
        })),
      previousSubjects: (subjMap.get(previous.id) ?? []).map((r) => ({
        subjectRef: r.subjectRef,
        net: r.net,
      })),
      subjectName: (ref) => slugToName.get(ref) ?? ref,
    });

    const headline = this.i18n.translate(headlineKey, {
      lang: I18nContext.current()?.lang,
    }) as unknown as string;

    return { ...rest, headline, aiNarration: latest.aiGhostNarration };
  }

  /** Count photo categorizations in the rolling window (premium rate-limit). */
  async countPhotoCategorizationsSince(
    userId: string,
    since: Date,
  ): Promise<number> {
    return withUserContext(this.db, { userId }, async (tx) =>
      this.photoRows.countSince(tx, userId, since),
    );
  }

  async findPhotoCategorizationsByClientRequestId(
    userId: string,
    clientRequestId: string,
  ): Promise<MockExamPhotoRow[]> {
    return withUserContext(this.db, { userId }, async (tx) =>
      this.photoRows.findByClientRequestId(tx, userId, clientRequestId),
    );
  }

  async getOwnedMockExam(
    userId: string,
    mockExamId: string,
  ): Promise<MockExamRow> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.mockExams.findById(tx, userId, mockExamId);
      if (!row) {
        throw new DomainError(
          ErrorCode.COACHING_MOCK_EXAM_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      return row.exam;
    });
  }

  async recordPhotoCategorizations(
    userId: string,
    mockExamId: string,
    classifications: Array<{ subjectRef: string; topicRef: string | null }>,
    storageKey: string,
    clientRequestId?: string,
  ): Promise<void> {
    await withUserContext(this.db, { userId }, async (tx) => {
      for (const classification of classifications) {
        await this.photoRows.insert(tx, {
          userId,
          mockExamId,
          subjectRef: classification.subjectRef,
          topicRef: classification.topicRef,
          storageKey,
          clientRequestId,
        });
      }
    });
  }

  private prepareResult(
    exam: ExamRef,
    taxonomy: ExamSubjectRef[],
    subjects: CreateMockExamInput["subjects"],
  ): {
    totalNet: string;
    subjectRows: Array<{
      subjectRef: string;
      correct: number;
      wrong: number;
      blank: number;
      net: string;
    }>;
    slugToName: Map<string, string>;
  } {
    const refs = subjects.map((subject) => subject.subjectRef);
    if (new Set(refs).size !== refs.length) {
      throw new DomainError(
        ErrorCode.COACHING_DUPLICATE_SUBJECT_REF,
        HttpStatus.BAD_REQUEST,
      );
    }

    const taxonomyBySlug = new Map(
      taxonomy.map((subject) => [subject.slug, subject]),
    );
    for (const subject of subjects) {
      const meta = taxonomyBySlug.get(subject.subjectRef);
      if (!meta) {
        throw new DomainError(
          ErrorCode.COACHING_INVALID_SUBJECT_REF,
          HttpStatus.BAD_REQUEST,
          { subjectRef: subject.subjectRef },
        );
      }
      if (
        meta.questionCount != null &&
        subject.correct + subject.wrong + subject.blank > meta.questionCount
      ) {
        throw new DomainError(
          ErrorCode.COACHING_INVALID_MOCK_EXAM_SCORES,
          HttpStatus.BAD_REQUEST,
          {
            subjectRef: subject.subjectRef,
            questionCount: meta.questionCount,
          },
        );
      }
    }

    const subjectNets = subjects.map((subject) =>
      computeSubjectNet(subject, exam.netRule),
    );
    return {
      totalNet: formatNet(computeTotalNet(subjectNets)),
      subjectRows: subjects.map((subject, index) => ({
        ...subject,
        net: formatNet(subjectNets[index]!),
      })),
      slugToName: new Map(
        taxonomy.map((subject) => [subject.slug, subject.name]),
      ),
    };
  }

  private translateFocus(key: string, subject: string, topic?: string): string {
    return this.i18n.translate(key, {
      lang: I18nContext.current()?.lang,
      args: { subject, topic },
    }) as unknown as string;
  }

  private async buildMockExamDtos(
    _tx: DatabaseTx,
    rows: MockExamRow[],
    subjectsMap: Map<string, MockExamSubjectRow[]>,
  ): Promise<MockExamDto[]> {
    if (rows.length === 0) return [];

    const uniqueExamIds = [...new Set(rows.map((r) => r.examId))];
    const [examEntries, taxonomyEntries] = await Promise.all([
      Promise.all(uniqueExamIds.map((id) => this.content.getExamById(id))),
      Promise.all(uniqueExamIds.map((id) => this.content.listExamSubjects(id))),
    ]);

    const examById = new Map<string, ExamRef | null>(
      uniqueExamIds.map((id, i) => [id, examEntries[i] ?? null]),
    );
    const taxonomyByExamId = new Map(
      uniqueExamIds.map((id, i) => [id, taxonomyEntries[i] ?? []]),
    );

    return rows.map((item) => {
      const exam = examById.get(item.examId);
      const subjects = subjectsMap.get(item.id) ?? [];
      const taxonomy = taxonomyByExamId.get(item.examId) ?? [];
      const slugToName = new Map(taxonomy.map((s) => [s.slug, s.name]));
      return toMockExamDto(item, subjects, exam?.name ?? "Deneme", slugToName);
    });
  }
}
