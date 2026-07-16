import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";
import { EmbedArticleHandler } from "../src/modules/ai/application/handlers/embed-article.handler";

const RUN = Date.now();
const SLUG = `e2e-rag-kpss-${RUN}`;
const RAG_ARTICLE_PATTERN = "e2e-rag-kpss-%";

/**
 * W3 RAG grounding (e2e, fake provider): a published article is embedded (via the reembed backfill +
 * job runner), then a premium user's related question retrieves it as a source; an unrelated question
 * returns no sources. SUPER_ADMIN-only reembed.
 */
describe("ai coach RAG grounding (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let premiumToken = "";
  let superToken = "";
  let articleId = "";

  const signup = async (label: string) => {
    const email = `rag-${label}-${RUN}@test.local`;
    const res = await request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send({ email, password: "Sifre1234", displayName: `RAG ${label}`, kvkkAccepted: true });
    return { email, ...(res.body as { accessToken: string; user: { id: string } }) };
  };

  const svc = async (fn: (c: import("pg").PoolClient) => Promise<void>) => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('app.role','SERVICE',true)");
      await fn(c);
      await c.query("commit");
    } finally {
      c.release();
    }
  };

  const grantRole = (userId: string, role: string) =>
    svc(async (c) => {
      await c.query("update users set roles = array_append(roles,$1) where id=$2", [role, userId]);
    });

  const login = async (email: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email, password: "Sifre1234" });
    return res.body.accessToken;
  };

  const cleanupArticles = () =>
    svc(async (c) => {
      await c.query(
        `delete from jobs
         where name = 'ai.embed-article'
           and payload->>'articleId' in (
             select id::text from info_articles where slug like $1
           )`,
        [RAG_ARTICLE_PATTERN],
      );
      await c.query("delete from info_articles where slug like $1", [RAG_ARTICLE_PATTERN]);
    });

  /** Seed a short, keyword-dense published KPSS article (no embedding yet); capture its id. */
  const seedArticle = () =>
    svc(async (c) => {
      const res = await c.query(
        `insert into info_articles (slug,title,body,family,category,source,source_url,verified_at,verified_by,published_at)
         values ($1,$2,$3,'KPSS','APPLICATION','ÖSYM','https://osym.gov.tr/kpss', now(), 'editor', now())
         returning id`,
        [
          SLUG,
          "KPSS başvuru rehberi",
          "KPSS başvuru nasıl yapılır adım adım. Başvuru süreci ve başvuru koşulları.",
        ],
      );
      articleId = res.rows[0].id as string;
    });

  const asBearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    await app.init();

    const premium = await signup("premium");
    await grantRole(premium.user.id, UserRole.STAFF); // premium entitlement
    premiumToken = await login(premium.email);
    // Set exam family so RAG retrieval (family-filtered) applies.
    await request(app.getHttpServer())
      .patch("/v1/users/me")
      .set(asBearer(premiumToken))
      .send({ examType: "KPSS" });

    const su = await signup("super");
    await grantRole(su.user.id, UserRole.SUPER_ADMIN);
    superToken = await login(su.email);

    await cleanupArticles();
    await seedArticle();
  }, 90_000);

  afterAll(async () => {
    if (pool) await cleanupArticles();
    await app?.close();
    await pool?.end();
  });

  const chat = (token: string, message: string) =>
    request(app.getHttpServer()).post("/v1/coach/chat").set(asBearer(token)).send({ message });

  it("reembed is SUPER_ADMIN-only and enqueues published articles missing an embedding", async () => {
    expect((await request(app.getHttpServer()).post("/v1/admin/ai/reembed").set(asBearer(premiumToken))).status).toBe(403);

    const res = await request(app.getHttpServer()).post("/v1/admin/ai/reembed").set(asBearer(superToken));
    expect(res.status).toBe(201);
    expect(res.body.enqueued).toBeGreaterThanOrEqual(1);

    // Embed our article deterministically via the handler (the queue/cron path is W5-tested; the shared
    // test DB's job backlog makes processBatch ordering nondeterministic).
    await app.get(EmbedArticleHandler).handle({ articleId });
  });

  it("a related question retrieves the article as a source", async () => {
    const res = await chat(premiumToken, "KPSS başvuru nasıl yapılır?");
    expect(res.status).toBe(201);
    expect(Array.isArray(res.body.sources)).toBe(true);
    expect(res.body.sources.some((s: { slug: string }) => s.slug === SLUG)).toBe(true);
  });

  it("an unrelated question returns no sources (no ungrounded fabrication)", async () => {
    const res = await chat(premiumToken, "Sabah mı akşam mı daha verimli çalışırım?");
    expect(res.status).toBe(201);
    expect(res.body.sources.some((s: { slug: string }) => s.slug === SLUG)).toBe(false);
  });
});
