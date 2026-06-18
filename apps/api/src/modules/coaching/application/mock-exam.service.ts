import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { CoachingAnalysisDto, MockExamDto, Paginated } from "@mentor/types";
import type { CreateMockExamInput, ListMockExamsQuery } from "@mentor/validation";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { CONTENT_PORT, type ContentPort, type ExamRef } from "../domain/content.port";
import { computeSubjectNet, computeTotalNet, formatNet } from "../domain/net";
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
  ) {}

  async create(userId: string, input: CreateMockExamInput): Promise<MockExamDto> {
    const refs = input.subjects.map((s) => s.subjectRef);
    if (new Set(refs).size !== refs.length) {
      throw new DomainError(ErrorCode.COACHING_DUPLICATE_SUBJECT_REF, HttpStatus.BAD_REQUEST);
    }

    const exam = await this.content.getExamById(input.examId);
    if (!exam) {
      throw new DomainError(ErrorCode.CONTENT_EXAM_NOT_FOUND, HttpStatus.NOT_FOUND, {
        examId: input.examId,
      });
    }

    const taxonomy = await this.content.listExamSubjects(input.examId);
    const slugToName = new Map(taxonomy.map((s) => [s.slug, s.name]));
    const taxonomyBySlug = new Map(taxonomy.map((s) => [s.slug, s]));

    for (const s of input.subjects) {
      const meta = taxonomyBySlug.get(s.subjectRef);
      if (!meta) {
        throw new DomainError(ErrorCode.COACHING_INVALID_SUBJECT_REF, HttpStatus.BAD_REQUEST, {
          subjectRef: s.subjectRef,
        });
      }
      if (meta.questionCount != null) {
        const answered = s.correct + s.wrong + s.blank;
        if (answered > meta.questionCount) {
          throw new DomainError(ErrorCode.COACHING_INVALID_MOCK_EXAM_SCORES, HttpStatus.BAD_REQUEST, {
            subjectRef: s.subjectRef,
            questionCount: meta.questionCount,
          });
        }
      }
    }

    const takenAt = input.takenAt ? new Date(input.takenAt) : new Date();
    const subjectNets = input.subjects.map((s) => computeSubjectNet(s, exam.netRule));
    const totalNet = formatNet(computeTotalNet(subjectNets));

    const subjectRows = input.subjects.map((s, i) => ({
      subjectRef: s.subjectRef,
      correct: s.correct,
      wrong: s.wrong,
      blank: s.blank,
      net: formatNet(subjectNets[i]!),
    }));

    return withUserContext(this.db, { userId }, async (tx) => {
      const created = await this.mockExams.create(tx, {
        userId,
        examId: input.examId,
        takenAt,
        totalNet,
        subjects: subjectRows,
      });
      return toMockExamDto(created.exam, created.subjects, exam.name, slugToName);
    });
  }

  async getById(userId: string, id: string): Promise<MockExamDto> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.mockExams.findById(tx, userId, id);
      if (!row) {
        throw new DomainError(ErrorCode.COACHING_MOCK_EXAM_NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      const subjectsMap = await this.mockExams.listSubjectsByMockExamIds(tx, [row.exam.id]);
      const [dto] = await this.buildMockExamDtos(tx, [row.exam], subjectsMap);
      return dto!;
    });
  }

  async list(userId: string, query: ListMockExamsQuery): Promise<Paginated<MockExamDto>> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const { items, total } = await this.mockExams.listPaged(
        tx,
        userId,
        query.page,
        query.pageSize,
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

  async getAnalysis(userId: string): Promise<CoachingAnalysisDto> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const trendRows = await this.mockExams.listTrend(tx, userId);
      const breakdown = await this.mockExams.listSubjectBreakdown(tx, userId);

      const examIds = [...new Set(trendRows.map((r) => r.examId))];
      const [taxonomyEntries, examEntries] = await Promise.all([
        Promise.all(examIds.map((id) => this.content.listExamSubjects(id))),
        Promise.all(examIds.map((id) => this.content.getExamById(id))),
      ]);

      const slugToName = new Map<string, string>();
      for (const taxonomy of taxonomyEntries) {
        for (const s of taxonomy) slugToName.set(s.slug, s.name);
      }

      const examNameById = new Map(
        examIds.map((id, i) => [id, examEntries[i]?.name ?? "Deneme"]),
      );

      const trend = trendRows.map((row) => ({
        id: row.id,
        takenAt: row.takenAt.toISOString(),
        totalNet: String(row.totalNet),
        examName: examNameById.get(row.examId) ?? "Deneme",
      }));

      const subjects = breakdown.map((row) => ({
        subjectRef: row.subjectRef,
        subjectName: slugToName.get(row.subjectRef) ?? row.subjectRef,
        averageNet: row.avgNet,
        attemptCount: row.attemptCount,
      }));

      const photoSignals = await this.photoRows.listPhotoSubjectSignals(tx, userId);
      const photoSubjectSignals = photoSignals.map((row) => ({
        subjectRef: row.subjectRef,
        subjectName: slugToName.get(row.subjectRef) ?? row.subjectRef,
        count: row.count,
      }));

      return { trend, subjects, photoSubjectSignals };
    });
  }

  /** Count photo categorizations in the rolling window (premium rate-limit). */
  async countPhotoCategorizationsSince(userId: string, since: Date): Promise<number> {
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

  async getOwnedMockExam(userId: string, mockExamId: string): Promise<MockExamRow> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.mockExams.findById(tx, userId, mockExamId);
      if (!row) {
        throw new DomainError(ErrorCode.COACHING_MOCK_EXAM_NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      return row.exam;
    });
  }

  async recordPhotoCategorizations(
    userId: string,
    mockExamId: string,
    subjectSlugs: string[],
    storageKey: string,
    clientRequestId?: string,
  ): Promise<void> {
    await withUserContext(this.db, { userId }, async (tx) => {
      for (const slug of subjectSlugs) {
        await this.photoRows.insert(tx, {
          userId,
          mockExamId,
          subjectRef: slug,
          storageKey,
          clientRequestId,
        });
      }
    });
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
