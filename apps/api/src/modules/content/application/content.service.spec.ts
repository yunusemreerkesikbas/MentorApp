import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import type { ExamEventRow, ExamRow } from "../infrastructure/exam.repository";
import type { InfoArticleRow } from "../infrastructure/info-article.repository";
import { ContentEventTopic, ArticlePublished } from "../domain/content.events";
import { ContentService } from "./content.service";

const NOW = new Date("2026-06-11T12:00:00.000Z");

function makeExam(overrides: Partial<ExamRow> = {}): ExamRow {
  return {
    id: "exam-lisans",
    slug: "kpss-lisans-2026",
    name: "KPSS Lisans 2026",
    family: "KPSS",
    variant: "LISANS",
    netRule: { kind: "PENALTY", divisor: 4 },
    isCurrent: true,
    orgId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeEvent(examId: string, overrides: Partial<ExamEventRow> = {}): ExamEventRow {
  return {
    id: "evt-1",
    examId,
    type: "EXAM_DATE",
    eventAt: new Date("2026-07-12T06:00:00.000Z"),
    source: "ÖSYM",
    sourceUrl: "https://www.osym.gov.tr",
    verifiedAt: new Date("2026-06-01T10:00:00.000Z"),
    verifiedBy: "editorial-seed",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function buildService(overrides?: {
  candidates?: Array<{ exam: ExamRow; event: ExamEventRow }>;
  eventsByExamId?: Record<string, ExamEventRow[]>;
  findBySlug?: ExamRow | undefined;
}) {
  const lisans = makeExam();
  const onlisans = makeExam({
    id: "exam-onlisans",
    slug: "kpss-onlisans-2026",
    name: "KPSS Önlisans 2026",
    variant: "ONLISANS",
    isCurrent: false,
  });

  const defaultCandidates = [
    { exam: lisans, event: makeEvent(lisans.id) },
    {
      exam: onlisans,
      event: makeEvent(onlisans.id, { eventAt: new Date("2026-07-19T06:00:00.000Z") }),
    },
  ];

  const candidates = overrides?.candidates ?? defaultCandidates;
  const eventsByExamId =
    overrides?.eventsByExamId ??
    Object.fromEntries(candidates.map(({ exam, event }) => [exam.id, [event]]));

  const exams = {
    listPaged: vi.fn(async () => ({ items: candidates.map((c) => c.exam), total: candidates.length })),
    findBySlug: vi.fn(async (_db: unknown, slug: string) => {
      if (overrides?.findBySlug !== undefined) return overrides.findBySlug;
      return candidates.find((c) => c.exam.slug === slug)?.exam;
    }),
    listFamilyCandidates: vi.fn(async () => candidates),
    findNetRuleForFamily: vi.fn(async () => ({ kind: "PENALTY", divisor: 4 })),
    upsertBySlug: vi.fn(),
  };

  const events = {
    listByExamId: vi.fn(async (_tx: unknown, examId: string) => eventsByExamId[examId] ?? []),
    upsertByExamAndType: vi.fn(),
    findByExamAndType: vi.fn(),
  };

  const articles = {
    findBySlug: vi.fn(async (): Promise<InfoArticleRow | undefined> => undefined),
    listPublishedByFamily: vi.fn(
      async (): Promise<{ items: InfoArticleRow[]; total: number }> => ({ items: [], total: 0 }),
    ),
    upsertBySlug: vi.fn(),
    setPublishedAt: vi.fn(async (): Promise<InfoArticleRow | undefined> => undefined),
  };

  const eventEmitter = { emit: vi.fn() };

  const db = {
    transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> =>
      cb({ execute: async () => undefined }),
  } as never;
  const service = new ContentService(
    db,
    exams as never,
    events as never,
    articles as never,
    eventEmitter as never,
  );
  return { service, exams, events, articles, eventEmitter };
}

describe("ContentService — exam calendar resolution", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("getExamCalendarByFamily picks isCurrent KPSS row and maps data-card fields", async () => {
    const { service } = buildService();
    const dto = await service.getExamCalendarByFamily("KPSS");

    expect(dto).not.toBeNull();
    expect(dto?.exam.slug).toBe("kpss-lisans-2026");
    expect(dto?.examDateLabel).toBe("12 Temmuz 2026");
    expect(dto?.daysRemaining).toBe(31);
    expect(dto?.events[0]).toMatchObject({
      type: "EXAM_DATE",
      source: "ÖSYM",
      sourceUrl: "https://www.osym.gov.tr",
      verifiedBy: "editorial-seed",
    });
  });

  it("getExamCalendarForCoaching returns compact countdown shape", async () => {
    const { service } = buildService();
    const resolved = await service.getExamCalendarForCoaching("KPSS");

    expect(resolved).toEqual({
      examType: "KPSS",
      examName: "KPSS Lisans 2026",
      examDate: "2026-07-12",
      source: "ÖSYM",
      sourceUrl: "https://www.osym.gov.tr",
    });
  });

  it("returns null for unknown or missing family (no silent fallback)", async () => {
    const { service } = buildService({ candidates: [] });
    expect(await service.getExamCalendarByFamily(null)).toBeNull();
    expect(await service.getExamCalendarForCoaching(undefined)).toBeNull();
    expect(await service.getExamCalendarByFamily("YKS")).toBeNull();
  });

  it("rejects invalid exam family", async () => {
    const { service } = buildService();
    await expect(service.getExamCalendarByFamily("INVALID")).rejects.toMatchObject({
      code: ErrorCode.CONTENT_INVALID_EXAM_FAMILY,
    });
  });

  it("getCalendarBySlug throws when slug is missing", async () => {
    const { service } = buildService({ findBySlug: undefined });
    await expect(service.getCalendarBySlug("missing-slug")).rejects.toBeInstanceOf(DomainError);
  });
});

function makeArticle(overrides: Partial<InfoArticleRow> = {}): InfoArticleRow {
  return {
    id: "art-1",
    slug: "kpss-basvuru-sureci",
    title: "KPSS Başvuru Süreci",
    body: "Body",
    family: "KPSS",
    category: "APPLICATION",
    source: "ÖSYM",
    sourceUrl: "https://www.osym.gov.tr",
    verifiedAt: NOW,
    verifiedBy: "editorial-seed",
    metaTitle: null,
    metaDescription: null,
    embedding: null,
    publishedAt: new Date("2026-06-01T12:00:00.000Z"),
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("ContentService — info articles", () => {
  it("listInfoArticles returns published summaries only", async () => {
    const row = makeArticle();
    const { service, articles } = buildService();
    articles.listPublishedByFamily.mockResolvedValue({ items: [row], total: 1 });

    const page = await service.listInfoArticles({ family: "KPSS", page: 1, pageSize: 10 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.slug).toBe("kpss-basvuru-sureci");
    expect(Object.hasOwn(page.items[0] ?? {}, "body")).toBe(false);
  });

  it("getInfoArticleBySlug returns 404 when unpublished", async () => {
    const { service, articles } = buildService();
    articles.findBySlug.mockResolvedValue(makeArticle({ publishedAt: null }));

    await expect(service.getInfoArticleBySlug("kpss-basvuru-sureci")).rejects.toMatchObject({
      code: ErrorCode.CONTENT_ARTICLE_NOT_FOUND,
    });
  });

  it("publishArticle emits ArticlePublished once", async () => {
    const draft = makeArticle({ publishedAt: null });
    const published = makeArticle();
    const { service, articles, eventEmitter } = buildService();
    articles.findBySlug.mockResolvedValueOnce(draft).mockResolvedValueOnce(published);
    articles.setPublishedAt.mockResolvedValue(published);

    await service.publishArticle("kpss-basvuru-sureci", "2026-06-01T12:00:00.000Z");

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      ContentEventTopic.ARTICLE_PUBLISHED,
      expect.any(ArticlePublished),
    );
  });

  it("publishArticle does not re-emit when already published", async () => {
    const { service, articles, eventEmitter } = buildService();
    articles.findBySlug.mockResolvedValue(makeArticle());

    await service.publishArticle("kpss-basvuru-sureci");

    expect(eventEmitter.emit).not.toHaveBeenCalled();
    expect(articles.setPublishedAt).not.toHaveBeenCalled();
  });

  it("getInfoArticleBySlug rejects invalid slug", async () => {
    const { service } = buildService();
    await expect(service.getInfoArticleBySlug("")).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
    });
  });

  it("upsertArticle rejects invalid category", async () => {
    const { service } = buildService();
    await expect(
      service.upsertArticle({
        slug: "bad-cat",
        title: "T",
        body: "B",
        family: "KPSS",
        category: "INVALID",
        source: "ÖSYM",
        sourceUrl: "https://www.osym.gov.tr",
        verifiedAt: "2026-06-01T10:00:00.000Z",
        verifiedBy: "editorial-seed",
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.CONTENT_INVALID_ARTICLE_CATEGORY,
    });
  });
});
