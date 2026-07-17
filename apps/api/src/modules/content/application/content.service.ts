import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type {
  ExamCalendarDto,
  ExamSubjectDto,
  ExamSummaryDto,
  InfoArticleDto,
  InfoArticleSummaryDto,
  Paginated,
} from "@mentor/types";
import type {
  AdminListArticlesQuery,
  AdminListExamsQuery,
  ListInfoArticlesQuery,
  PaginationQuery,
} from "@mentor/validation";
import { infoArticleSlugParamSchema } from "@mentor/validation";
import { ExamType } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import {
  DomainError,
  ValidationFailedError,
} from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { formatZodIssues } from "../../../common/validation/zod-validation.pipe";
import {
  selectExamForCountdown,
  toExamCandidates,
} from "../domain/calendar.util";
import {
  ExamEventType,
  InfoArticleCategory,
} from "../domain/content.constants";
import {
  ExamEventRepository,
  type ExamEventRow,
} from "../infrastructure/exam-event.repository";
import {
  ExamRepository,
  type ExamRow,
} from "../infrastructure/exam.repository";
import {
  InfoArticleRepository,
  type InfoArticleRow,
} from "../infrastructure/info-article.repository";
import { SubjectRepository } from "../infrastructure/subject.repository";
import {
  TopicRepository,
  type ExamTopicRow,
} from "../infrastructure/topic.repository";
import { ArticlePublished, ContentEventTopic } from "../domain/content.events";
import {
  toExamCalendarDto,
  toExamSubjectDto,
  toInfoArticleDto,
  toPaginatedExams,
  toPaginatedInfoArticles,
} from "./content.mappers";

/** Admin-facing article view (incl. drafts + trust metadata; no embedding/secrets). */
export interface AdminArticleView {
  id: string;
  slug: string;
  title: string;
  body: string;
  family: string;
  category: string;
  source: string;
  sourceUrl: string;
  verifiedAt: string;
  verifiedBy: string;
  metaTitle: string | null;
  metaDescription: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toAdminArticleView(row: InfoArticleRow): AdminArticleView {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    body: row.body,
    family: row.family,
    category: row.category,
    source: row.source,
    sourceUrl: row.sourceUrl,
    verifiedAt: row.verifiedAt.toISOString(),
    verifiedBy: row.verifiedBy,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    isPublished: row.publishedAt !== null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Admin-facing exam view (editorial metadata; no embedding/secrets). */
export interface AdminExamView {
  id: string;
  slug: string;
  name: string;
  family: string;
  variant: string | null;
  netRule: { kind: string; divisor: number };
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Admin-facing exam event view (raw editorial entry, incl. trust metadata). */
export interface AdminExamEventView {
  id: string;
  type: string;
  eventAt: string;
  source: string;
  sourceUrl: string;
  verifiedAt: string;
  verifiedBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Exam + its calendar events for the admin editor. */
export interface AdminExamDetailView {
  exam: AdminExamView;
  events: AdminExamEventView[];
}

function toAdminExamView(row: ExamRow): AdminExamView {
  const rule = (row.netRule ?? {}) as { kind?: unknown; divisor?: unknown };
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    family: row.family,
    variant: row.variant,
    netRule: {
      kind: typeof rule.kind === "string" ? rule.kind : "",
      divisor: typeof rule.divisor === "number" ? rule.divisor : 0,
    },
    isCurrent: row.isCurrent,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toAdminExamEventView(row: ExamEventRow): AdminExamEventView {
  return {
    id: row.id,
    type: row.type,
    eventAt: row.eventAt.toISOString(),
    source: row.source,
    sourceUrl: row.sourceUrl,
    verifiedAt: row.verifiedAt.toISOString(),
    verifiedBy: row.verifiedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

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
    private readonly subjects: SubjectRepository,
    private readonly topics: TopicRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async listExams(query: PaginationQuery): Promise<Paginated<ExamSummaryDto>> {
    const { items, total } = await this.exams.listPaged(
      this.db,
      undefined,
      query.page,
      query.pageSize,
    );
    return toPaginatedExams(items, total, query.page, query.pageSize);
  }

  async getCalendarBySlug(slug: string): Promise<ExamCalendarDto> {
    const exam = await this.exams.findBySlug(this.db, slug);
    if (!exam) {
      throw new DomainError(
        ErrorCode.CONTENT_EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { slug },
      );
    }
    const eventRows = await this.events.listByExamId(this.db, exam.id);
    return toExamCalendarDto(exam, eventRows);
  }

  async listExamSubjectsBySlug(slug: string): Promise<ExamSubjectDto[]> {
    const exam = await this.exams.findBySlug(this.db, slug);
    if (!exam) {
      throw new DomainError(
        ErrorCode.CONTENT_EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { slug },
      );
    }
    const rows = await this.subjects.listByExamId(this.db, exam.id);
    return rows.map(toExamSubjectDto);
  }

  async getExamById(examId: string): Promise<{
    id: string;
    slug: string;
    name: string;
    netRule: { kind: string; divisor: number };
  } | null> {
    const exam = await this.exams.findById(this.db, examId);
    if (!exam) return null;
    return {
      id: exam.id,
      slug: exam.slug,
      name: exam.name,
      netRule: this.parseNetRule(exam.id, exam.netRule),
    };
  }

  /** Validates editorial net_rule JSON — throws when malformed (not a missing exam). */
  private parseNetRule(
    examId: string,
    raw: unknown,
  ): { kind: string; divisor: number } {
    const rule = raw as { kind?: string; divisor?: number };
    if (typeof rule?.kind !== "string" || typeof rule?.divisor !== "number") {
      throw new DomainError(
        ErrorCode.CONTENT_INVALID_NET_RULE,
        HttpStatus.INTERNAL_SERVER_ERROR,
        {
          examId,
        },
      );
    }
    if (rule.kind !== "PENALTY") {
      throw new DomainError(
        ErrorCode.CONTENT_INVALID_NET_RULE,
        HttpStatus.INTERNAL_SERVER_ERROR,
        {
          examId,
          kind: rule.kind,
        },
      );
    }
    return { kind: rule.kind, divisor: rule.divisor };
  }

  async listExamSubjectsByExamId(examId: string): Promise<ExamSubjectDto[]> {
    const rows = await this.subjects.listByExamId(this.db, examId);
    return rows.map(toExamSubjectDto);
  }

  async listExamTopicsByExamId(examId: string): Promise<ExamTopicRow[]> {
    return this.topics.listByExamId(this.db, examId);
  }

  async getValidSubjectSlugsForExam(examId: string): Promise<Set<string>> {
    return this.subjects.findSlugsForExam(this.db, examId);
  }

  async upsertTopic(data: {
    subjectSlug: string;
    slug: string;
    name: string;
  }): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      const subject = await this.subjects.findBySlug(tx, data.subjectSlug);
      if (!subject)
        throw new DomainError(
          ErrorCode.CONTENT_SUBJECT_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          { slug: data.subjectSlug },
        );
      await this.topics.upsert(tx, {
        subjectId: subject.id,
        slug: data.slug,
        name: data.name,
      });
    });
  }

  async linkExamTopic(data: {
    examSlug: string;
    subjectSlug: string;
    topicSlug: string;
    sortOrder: number;
  }): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      const exam = await this.exams.findBySlug(tx, data.examSlug);
      if (!exam)
        throw new DomainError(
          ErrorCode.CONTENT_EXAM_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          { slug: data.examSlug },
        );
      const subject = await this.subjects.findBySlug(tx, data.subjectSlug);
      if (!subject)
        throw new DomainError(
          ErrorCode.CONTENT_SUBJECT_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          { slug: data.subjectSlug },
        );
      const topic = await this.topics.findByParentAndSlug(
        tx,
        subject.id,
        data.topicSlug,
      );
      if (!topic)
        throw new DomainError(
          ErrorCode.CONTENT_SUBJECT_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          { slug: data.topicSlug },
        );
      await this.topics.linkExam(tx, {
        examId: exam.id,
        topicId: topic.id,
        sortOrder: data.sortOrder,
      });
    });
  }

  /** Idempotent editorial upsert (seed + future W6 admin). */
  async upsertSubject(data: { slug: string; name: string }): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await this.subjects.upsertBySlug(tx, {
        slug: data.slug,
        name: data.name,
      });
    });
  }

  async linkExamSubject(data: {
    examSlug: string;
    subjectSlug: string;
    questionCount?: number | null;
    sortOrder: number;
  }): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      const exam = await this.exams.findBySlug(tx, data.examSlug);
      if (!exam) {
        throw new DomainError(
          ErrorCode.CONTENT_EXAM_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          {
            slug: data.examSlug,
          },
        );
      }
      const subject = await this.subjects.findBySlug(tx, data.subjectSlug);
      if (!subject) {
        throw new DomainError(
          ErrorCode.CONTENT_SUBJECT_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          {
            slug: data.subjectSlug,
          },
        );
      }
      await this.subjects.upsertExamSubject(tx, {
        examId: exam.id,
        subjectId: subject.id,
        questionCount: data.questionCount ?? null,
        sortOrder: data.sortOrder,
      });
    });
  }

  /** Authoritative countdown source: family = users.examType (KPSS | YKS | LGS). */
  async getExamCalendarByFamily(
    family: string | null | undefined,
  ): Promise<ExamCalendarDto | null> {
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

    const examDateEvent = dto.events.find(
      (e) => e.type === ExamEventType.EXAM_DATE,
    );
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
    this.assertValidFamily(data.family);
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
    this.assertValidEventType(data.type);
    await withServiceContext(this.db, async (tx) => {
      const exam = await this.exams.findBySlug(tx, examSlug);
      if (!exam) {
        throw new DomainError(
          ErrorCode.CONTENT_EXAM_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          {
            slug: examSlug,
          },
        );
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

  /**
   * Admin exam list. Runs in SERVICE context for parity with the article editor (exams are
   * public-read today, but writes/reads stay on the same trusted path).
   */
  async listExamsForAdmin(
    query: AdminListExamsQuery,
  ): Promise<Paginated<AdminExamView>> {
    if (query.family) this.assertValidFamily(query.family);
    const { items, total } = await withServiceContext(this.db, (tx) =>
      this.exams.listPaged(tx, query.family, query.page, query.pageSize),
    );
    return {
      items: items.map(toAdminExamView),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Admin exam detail + its raw calendar events (all types, not countdown-resolved). */
  async getExamForAdminWithEvents(slug: string): Promise<AdminExamDetailView> {
    return withServiceContext(this.db, async (tx) => {
      const exam = await this.exams.findBySlug(tx, slug);
      if (!exam) {
        throw new DomainError(
          ErrorCode.CONTENT_EXAM_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          { slug },
        );
      }
      const events = await this.events.listByExamId(tx, exam.id);
      return {
        exam: toAdminExamView(exam),
        events: events.map(toAdminExamEventView),
      };
    });
  }

  /** Delete one calendar event (admin). Throws when the exam or event is missing. */
  async deleteExamEvent(slug: string, type: string): Promise<void> {
    this.assertValidEventType(type);
    await withServiceContext(this.db, async (tx) => {
      const exam = await this.exams.findBySlug(tx, slug);
      if (!exam) {
        throw new DomainError(
          ErrorCode.CONTENT_EXAM_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          { slug },
        );
      }
      const removed = await this.events.deleteByExamAndType(tx, exam.id, type);
      if (!removed) {
        throw new DomainError(
          ErrorCode.CONTENT_EXAM_EVENT_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          {
            slug,
            type,
          },
        );
      }
    });
  }

  async listInfoArticles(
    query: ListInfoArticlesQuery,
  ): Promise<Paginated<InfoArticleSummaryDto>> {
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
      throw new DomainError(
        ErrorCode.CONTENT_ARTICLE_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { slug },
      );
    }
    return toInfoArticleDto(row);
  }

  /**
   * Admin article list — includes drafts. MUST run in SERVICE context: the info_articles RLS
   * `public_read` policy only exposes published rows to anon/pool reads; SERVICE/ADMIN sees drafts.
   */
  async listArticlesForAdmin(
    query: AdminListArticlesQuery,
  ): Promise<Paginated<AdminArticleView>> {
    if (query.family) this.assertValidFamily(query.family);
    const { items, total } = await withServiceContext(this.db, (tx) =>
      this.articles.listAll(tx, query.family, query.page, query.pageSize),
    );
    return {
      items: items.map(toAdminArticleView),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Admin article detail — includes drafts (SERVICE context; see listArticlesForAdmin). */
  async getArticleForAdmin(slug: string): Promise<AdminArticleView> {
    const validSlug = this.parseArticleSlug(slug);
    const row = await withServiceContext(this.db, (tx) =>
      this.articles.findBySlug(tx, validSlug),
    );
    if (!row) {
      throw new DomainError(
        ErrorCode.CONTENT_ARTICLE_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { slug },
      );
    }
    return toAdminArticleView(row);
  }

  /** Unpublish (back to draft). Hides it from the public knowledge center. */
  async unpublishArticle(slug: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      const existing = await this.articles.findBySlug(tx, slug);
      if (!existing) {
        throw new DomainError(
          ErrorCode.CONTENT_ARTICLE_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          { slug },
        );
      }
      await this.articles.setPublishedAt(tx, slug, null);
    });
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
        throw new DomainError(
          ErrorCode.CONTENT_ARTICLE_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          { slug },
        );
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

  /* ----------------------- RAG embedding seam (W3) ----------------------- */

  /** Fetch an article's embeddable text (title+body) by id — for the embed job. */
  async getArticleForEmbedding(
    id: string,
  ): Promise<{
    id: string;
    title: string;
    body: string;
    family: string;
  } | null> {
    const row = await withServiceContext(this.db, (tx) =>
      this.articles.findById(tx, id),
    );
    if (!row) return null;
    return { id: row.id, title: row.title, body: row.body, family: row.family };
  }

  /** Store the RAG embedding (content owns the column; AI computes the vector). */
  async setArticleEmbedding(id: string, embedding: number[]): Promise<void> {
    await withServiceContext(this.db, (tx) =>
      this.articles.setEmbedding(tx, id, embedding),
    );
  }

  /** Ids of published articles still missing an embedding (backfill). */
  async listPublishedNeedingEmbedding(): Promise<string[]> {
    const rows = await withServiceContext(this.db, (tx) =>
      this.articles.listPublishedWithoutEmbedding(tx),
    );
    return rows.map((r) => r.id);
  }

  /**
   * RAG retrieval: top-K published articles in `family` similar to `vector`, within `maxDistance`
   * (cosine). Returns a short snippet + source for grounding/citation (no embedding leaked).
   */
  async searchSimilarArticles(
    family: string,
    vector: number[],
    topK: number,
    maxDistance: number,
  ): Promise<
    { title: string; slug: string; sourceUrl: string; snippet: string }[]
  > {
    this.assertValidFamily(family);
    const rows = await withServiceContext(this.db, (tx) =>
      this.articles.searchSimilar(tx, family, vector, topK),
    );
    return rows
      .filter((r) => r.distance <= maxDistance)
      .map((r) => ({
        title: r.title,
        slug: r.slug,
        sourceUrl: r.sourceUrl,
        snippet: r.body.slice(0, 400),
      }));
  }

  private assertValidFamily(family: string): void {
    const allowed = Object.values(ExamType) as string[];
    if (!allowed.includes(family)) {
      throw new DomainError(
        ErrorCode.CONTENT_INVALID_EXAM_FAMILY,
        HttpStatus.BAD_REQUEST,
        {
          family,
        },
      );
    }
  }

  private assertValidCategory(category: string): void {
    const allowed = Object.values(InfoArticleCategory) as string[];
    if (!allowed.includes(category)) {
      throw new DomainError(
        ErrorCode.CONTENT_INVALID_ARTICLE_CATEGORY,
        HttpStatus.BAD_REQUEST,
        {
          category,
        },
      );
    }
  }

  private assertValidEventType(type: string): void {
    const allowed = Object.values(ExamEventType) as string[];
    if (!allowed.includes(type)) {
      throw new DomainError(
        ErrorCode.CONTENT_INVALID_EXAM_EVENT_TYPE,
        HttpStatus.BAD_REQUEST,
        {
          type,
        },
      );
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
