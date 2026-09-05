import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ContentService } from "../src/modules/content/application/content.service";

/**
 * W1 content e2e — editorial exam calendar against real Postgres (RLS active).
 * Seed runs on module init; public reads need no auth.
 */
describe("content (e2e)", () => {
  let app: INestApplication;
  let userToken = "";

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-11T12:00:00.000Z"));
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    process.env.JWT_ACCESS_SECRET ??= "test-secret-test-secret-test-secret!!";

    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    await app.init();

    const signup = await request(app.getHttpServer()).post("/v1/auth/signup").send({
      email: `w1-${randomUUID()}@test.local`,
      password: "Sifre1234",
      displayName: "Content Test",
      kvkkAccepted: true,
    });
    expect(signup.status).toBe(201);
    userToken = signup.body.accessToken;

    const patchMe = await request(app.getHttpServer())
      .patch("/v1/users/me")
      .set({ Authorization: `Bearer ${userToken}` })
      .send({ examType: "KPSS" });
    expect(patchMe.status).toBe(200);
    expect(patchMe.body.examType).toBe("KPSS");
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    vi.useRealTimers();
  });

  const auth = () => ({ Authorization: `Bearer ${userToken}` });

  it("GET /v1/content/exams returns seeded KPSS rows (public, no auth)", async () => {
    const res = await request(app.getHttpServer()).get("/v1/content/exams?page=1&pageSize=100");
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(3);
    const kpss = res.body.items.filter((e: { family: string }) => e.family === "KPSS");
    expect(kpss.length).toBeGreaterThanOrEqual(3);
    expect(kpss.some((e: { slug: string; isCurrent: boolean }) => e.slug === "kpss-lisans-2026" && e.isCurrent)).toBe(
      true,
    );
  });

  it("GET /v1/content/exams/by-type/KPSS/calendar returns examDateLabel + trust metadata", async () => {
    const res = await request(app.getHttpServer()).get("/v1/content/exams/by-type/KPSS/calendar");
    expect(res.status).toBe(200);
    expect(res.body.exam.slug).toBe("kpss-lisans-2026");
    expect(res.body.examDateLabel).toBe("12 Temmuz 2026");
    expect(typeof res.body.daysRemaining).toBe("number");
    expect(res.body.daysRemaining).toBeGreaterThanOrEqual(0);

    const examDate = res.body.events.find((e: { type: string }) => e.type === "EXAM_DATE");
    expect(examDate).toBeTruthy();
    expect(examDate.source).toBe("ÖSYM");
    expect(examDate.sourceUrl).toBe("https://www.osym.gov.tr");
    expect(examDate.verifiedBy).toBe("editorial-seed");
  });

  it("GET /v1/coaching/today uses countdown from editorial seed", async () => {
    const res = await request(app.getHttpServer()).get("/v1/coaching/today").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.countdown).not.toBeNull();
    expect(res.body.countdown.examType).toBe("KPSS");
    expect(res.body.countdown.examName).toBe("KPSS Lisans 2026");
    expect(res.body.countdown.examDateLabel).toBe("12 Temmuz 2026");
    expect(res.body.countdown.source).toBe("ÖSYM");
    expect(res.body.countdown.sourceUrl).toBe("https://www.osym.gov.tr");
    expect(typeof res.body.countdown.daysRemaining).toBe("number");
  });

  it("GET /v1/content/exams/:slug/subjects returns KPSS Lisans taxonomy (public)", async () => {
    const res = await request(app.getHttpServer()).get("/v1/content/exams/kpss-lisans-2026/subjects");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body.some((s: { slug: string }) => s.slug === "turkce")).toBe(true);
    const turkce = res.body.find((s: { slug: string }) => s.slug === "turkce");
    expect(turkce.questionCount).toBe(30);
  });

  it("GET /v1/content/info-articles?family=KPSS returns seeded articles (public)", async () => {
    // pageSize=100: the seed's publishedAt is old (2026-06-01), so newer KPSS articles inserted by
    // other e2e specs sharing this local DB sort ahead of it — a default page of 20 can miss it.
    const res = await request(app.getHttpServer()).get(
      "/v1/content/info-articles?family=KPSS&pageSize=100",
    );
    expect(res.status).toBe(200);
    // Two, not three, and that is the contract: the list always EXCLUDES the featured article
    // (`ContentService.listInfoArticles` passes it as `excludeSlug`), and the featured lookup
    // falls back pinned -> trending -> newest-with-cover -> newest-published, so with nothing
    // pinned it still always claims one of the three seeded rows. Asking for >= 3 out of a
    // three-article corpus was arithmetically impossible.
    expect(res.body.total).toBeGreaterThanOrEqual(2);
    // Not a fixed slug: the three seeds share publishedAt to the second, so which one the
    // fallback promotes to hero is a Postgres tie-break — pinning the assertion to
    // "kpss-basvuru-sureci" meant the day it won that tie, this test failed for no reason.
    // What the test is actually for is the trust metadata on a public summary.
    const seeded = res.body.items.find(
      (a: { verifiedBy: string }) => a.verifiedBy === "editorial-seed",
    );
    expect(seeded).toBeDefined();
    expect(seeded.source).toBe("ÖSYM");
    expect(seeded.verifiedBy).toBe("editorial-seed");
    expect(seeded.body).toBeUndefined();
  });

  it("GET /v1/content/info-articles/:slug returns full article with trust metadata", async () => {
    const res = await request(app.getHttpServer()).get("/v1/content/info-articles/kpss-basvuru-sureci");
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("KPSS Başvuru Süreci");
    expect(res.body.body).toContain("ÖSYM Aday İşlemleri");
    expect(res.body.source).toBe("ÖSYM");
    expect(res.body.sourceUrl).toBe("https://www.osym.gov.tr");
    expect(res.body.embedding).toBeUndefined();
  });

  it("GET /v1/content/info-articles/missing-slug returns 404", async () => {
    const res = await request(app.getHttpServer()).get("/v1/content/info-articles/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("CONTENT_ARTICLE_NOT_FOUND");
  });

  it("GET /v1/content/info-articles rejects invalid family", async () => {
    const res = await request(app.getHttpServer()).get("/v1/content/info-articles?family=INVALID");
    expect(res.status).toBe(400);
  });

  it("GET /v1/content/info-articles without family returns 400", async () => {
    const res = await request(app.getHttpServer()).get("/v1/content/info-articles");
    expect(res.status).toBe(400);
  });

  it("GET /v1/content/info-articles/:slug rejects oversize slug", async () => {
    const res = await request(app.getHttpServer()).get(
      `/v1/content/info-articles/${"a".repeat(200)}`,
    );
    expect(res.status).toBe(400);
  });

  it("GET /v1/content/info-articles/:slug returns 404 for unpublished draft", async () => {
    const content = app.get(ContentService);
    const slug = `draft-e2e-${Date.now()}`;
    await content.upsertArticle({
      slug,
      title: "Draft only",
      body: "Unpublished body",
      family: "KPSS",
      category: "GENERAL",
      source: "ÖSYM",
      sourceUrl: "https://www.osym.gov.tr",
      verifiedAt: "2026-06-01T10:00:00.000Z",
      verifiedBy: "editorial-seed",
    });

    const res = await request(app.getHttpServer()).get(`/v1/content/info-articles/${slug}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("CONTENT_ARTICLE_NOT_FOUND");
  });
});
