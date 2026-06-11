import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type {
  ExamCalendarDto,
  ExamSummaryDto,
  InfoArticleDto,
  InfoArticleSummaryDto,
  Paginated,
} from "@mentor/types";
import type { ListInfoArticlesQuery, PaginationQuery } from "@mentor/validation";
import { infoArticleSlugParamSchema } from "@mentor/validation";
import { ExamType } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { DomainError, ValidationFailedError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { formatZodIssues } from "../../../common/validation/zod-validation.pipe";
import {
  selectExamForCountdown,
  toExamCandidates,
} from "../domain/calendar.util";
import { ExamEventType, InfoArticleCategory } from "../domain/content.constants";
import { ExamEventRepository } from "../infrastructure/exam-event.repository";
import { ExamRepository } from "../infrastructure/exam.repository";
import { InfoArticleRepository } from "../infrastructure/info-article.repository";
import { ArticlePublished, ContentEventTopic } from "../domain/content.events";
import {
  toExamCalendarDto,
  toInfoArticleDto,
  toPaginatedExams,
  toPaginatedInfoArticles,
} from "./content.mappers";

/** Resolved calendar row used by the coaching ContentPort adapter. */
export interface ResolvedExamCalendar {
  examType: string;
  examName: string;
  examDate: string;
  source: string;
  sourceUrl: string;
}

/**
 * W1 content application service — editorial exam calendar (guardrail §4 #1).
 * Public reads hit reference tables (RLS: read open). Writes go through SERVICE context (seed/admin).
 */
@Injectable()
export class ContentService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly exams: ExamRepository,
    private readonly events: ExamEventRepository,
    private readonly articles: InfoArticleRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async listExams(query: PaginationQuery): Promise<Paginated<ExamSummaryDto>> {
    const { items, total } = await this.exams.listPaged(this.db, query.page, query.pageSize);
    return toPaginatedExams(items, total, query.page, query.pageSize);
  }

  async getCalendarBySlug(slug: string): Promise<ExamCalendarDto> {
    const exam = await this.exams.findBySlug(this.db, slug);
    if (!exam) {
      throw new DomainError(ErrorCode.CONTENT_EXAM_NOT_FOUND, HttpStatus.NOT_FOUND, { slug });
    }
    const eventRows = await this.events.listByExamId(this.db, exam.id);
    return toExamCalendarDto(exam, eventRows);
  }

  /** Authoritative countdown source: family = users.examType (KPSS | YKS | LGS). */
  async getExamCalendarByFamily(family: string | null | undefined): Promise<ExamCalendarDto | null> {
    if (!family) return null;
    this.assertValidFamily(family);

    const rows = await this.exams.listFamilyCandidates(this.db, family);
    const selected = selectExamForCountdown(toExamCandidates(rows));
    if (!selected) return null;

    const exam = rows.find((r) => r.exam.id === selected.examId)?.exam;
    if (!exam) return null;

    const eventRows = await this.events.listByExamId(this.db, exam.id);
    return toExamCalendarDto(exam, eventRows);
  }

  /** Coaching ContentPort seam — compact shape for countdown. */
  async getExamCalendarForCoaching(
    family: string | null | undefined,
  ): Promise<ResolvedExamCalendar | null> {
    const dto = await this.getExamCalendarByFamily(family);
    if (!dto || dto.daysRemaining === null || !dto.examDateLabel) return null;

    const examDateEvent = dto.events.find((e) => e.type === ExamEventType.EXAM_DATE);
    if (!examDateEvent) return null;

    const examDate = examDateEvent.eventAt.slice(0, 10);
    return {
      examType: dto.exam.family,
      examName: dto.exam.name,
      examDate,
      source: examDateEvent.source,
      sourceUrl: examDateEvent.sourceUrl,
    };
  }

  async getNetRuleByFamily(
    family: string | null | undefined,
  ): Promise<{ kind: string; divisor: number } | null> {
    if (!family) return null;
    this.assertValidFamily(family);
    return this.exams.findNetRuleForFamily(this.db, family);
  }

  /** Idempotent editorial upsert (seed + future W6 admin). */
  async upsertExam(data: {
    slug: string;
    name: string;
    family: string;
    variant?: string | null;
    netRule: { kind: string; divisor: number };
    isCurrent?: boolean;
    orgId?: string | null;
  }): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await this.exams.upsertBySlug(tx, {
        slug: data.slug,
        name: data.name,
        family: data.family,
        variant: data.variant ?? null,
        netRule: data.netRule,
        isCurrent: data.isCurrent ?? false,
        orgId: data.orgId ?? null,
      });
    });
  }

  async upsertEvent(
    examSlug: string,
    data: {
      type: string;
      eventAt: string;
      source: string;
      sourceUrl: string;
      verifiedAt: string;
      verifiedBy: string;
    },
  ): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      const exam = await this.exams.findBySlug(tx, examSlug);
      if (!exam) {
        throw new DomainError(ErrorCode.CONTENT_EXAM_NOT_FOUND, HttpStatus.NOT_FOUND, {
          slug: examSlug,
        });
      }
      await this.events.upsertByExamAndType(tx, {
        examId: exam.id,
        type: data.type,
        eventAt: new Date(data.eventAt),
        source: data.source,
        sourceUrl: data.sourceUrl,
        verifiedAt: new Date(data.verifiedAt),
        verifiedBy: data.verifiedBy,
      });
    });
  }

  async listInfoArticles(query: ListInfoArticlesQuery): Promise<Paginated<InfoArticleSummaryDto>> {
    this.assertValidFamily(query.family);
    const { items, total } = await this.articles.listPublishedByFamily(
      this.db,
      query.family,
      query.page,
      query.pageSize,
    );
    return toPaginatedInfoArticles(items, total, query.page, query.pageSize);
  }

  async getInfoArticleBySlug(slug: string): Promise<InfoArticleDto> {
    const validSlug = this.parseArticleSlug(slug);
    const row = await this.articles.findBySlug(this.db, validSlug);
    if (!row || !row.publishedAt) {
      throw new DomainError(ErrorCode.CONTENT_ARTICLE_NOT_FOUND, HttpStatus.NOT_FOUND, { slug });
    }
    return toInfoArticleDto(row);
  }

  /** Idempotent editorial upsert (seed + future W6 admin). */
  async upsertArticle(data: {
    slug: string;
    title: string;
    body: string;
    family: string;
    category: string;
    source: string;
    sourceUrl: string;
    verifiedAt: string;
    verifiedBy: string;
    metaTitle?: string | null;
    metaDescription?: string | null;
    publishedAt?: string | null;
  }): Promise<void> {
    this.assertValidFamily(data.family);
    this.assertValidCategory(data.category);
    await withServiceContext(this.db, async (tx) => {
      await this.articles.upsertBySlug(tx, {
        slug: data.slug,
        title: data.title,
        body: data.body,
        family: data.family,
        category: data.category,
        source: data.source,
        sourceUrl: data.sourceUrl,
        verifiedAt: new Date(data.verifiedAt),
        verifiedBy: data.verifiedBy,
        metaTitle: data.metaTitle ?? null,
        metaDescription: data.metaDescription ?? null,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
      });
    });
  }

  /** Publish an article and emit ArticlePublished once (W3 embedding seam). */
  async publishArticle(slug: string, publishedAt?: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      const existing = await this.articles.findBySlug(tx, slug);
      if (!existing) {
        throw new DomainError(ErrorCode.CONTENT_ARTICLE_NOT_FOUND, HttpStatus.NOT_FOUND, { slug });
      }
      if (existing.publishedAt) return;

      const at = publishedAt ? new Date(publishedAt) : new Date();
      const row = await this.articles.setPublishedAt(tx, slug, at);
      if (!row) return;

      this.eventEmitter.emit(
        ContentEventTopic.ARTICLE_PUBLISHED,
        new ArticlePublished(row.id, row.slug, row.family),
      );
    });
  }

  private assertValidFamily(family: string): void {
    const allowed = Object.values(ExamType) as string[];
    if (!allowed.includes(family)) {
      throw new DomainError(ErrorCode.CONTENT_INVALID_EXAM_FAMILY, HttpStatus.BAD_REQUEST, {
        family,
      });
    }
  }

  private assertValidCategory(category: string): void {
    const allowed = Object.values(InfoArticleCategory) as string[];
    if (!allowed.includes(category)) {
      throw new DomainError(ErrorCode.CONTENT_INVALID_ARTICLE_CATEGORY, HttpStatus.BAD_REQUEST, {
        category,
      });
    }
  }

  private parseArticleSlug(slug: string): string {
    const result = infoArticleSlugParamSchema.safeParse({ slug });
    if (!result.success) {
      throw new ValidationFailedError(formatZodIssues(result.error));
    }
    return result.data.slug;
  }
}
