import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";

const RUN = Date.now();
const SLUG = `e2e-kpss-${RUN}`;

/**
 * W6 admin content editor (e2e): EDITOR/ADMIN manage knowledge-center articles against a real
 * Postgres (RLS active). Draft → publish → public-visible → unpublish → public-hidden.
 */
describe("admin content editor (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let editorToken = "";
  let studentToken = "";

  const signup = async (label: string) => {
    const email = `ce-${label}-${RUN}@test.local`;
    const res = await request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send({ email, password: "Sifre1234", displayName: `CE ${label}`, kvkkAccepted: true });
    return { email, ...(res.body as { accessToken: string; user: { id: string } }) };
  };

  const grantRole = async (userId: string, role: string) => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('app.role','SERVICE',true)");
      await c.query("update users set roles = array_append(roles,$1) where id=$2", [role, userId]);
      await c.query("commit");
    } finally {
      c.release();
    }
  };

  const article = (over: Record<string, unknown> = {}) => ({
    slug: SLUG,
    title: "KPSS Başvuru Rehberi",
    body: "# Başvuru\nDetaylar burada.",
    family: "KPSS",
    category: "APPLICATION",
    source: "ÖSYM",
    sourceUrl: "https://osym.gov.tr/kpss",
    verifiedBy: "editor@test",
    verifiedAt: new Date().toISOString(),
    ...over,
  });

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

    const editor = await signup("editor");
    const student = await signup("student");
    studentToken = student.accessToken;

    await grantRole(editor.user.id, UserRole.EDITOR);
    const login = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: editor.email, password: "Sifre1234" });
    editorToken = login.body.accessToken;
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  const asEditor = () => ({ Authorization: `Bearer ${editorToken}` });

  it("rejects non-editor/non-admin (403)", async () => {
    const res = await request(app.getHttpServer())
      .get("/v1/admin/content/articles")
      .set({ Authorization: `Bearer ${studentToken}` });
    expect(res.status).toBe(403);
  });

  it("rejects an article without trust metadata (400)", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/admin/content/articles")
      .set(asEditor())
      .send(article({ slug: `${SLUG}-bad`, verifiedBy: "" }));
    expect(res.status).toBe(400);
  });

  it("gates and validates article image upload URLs", async () => {
    const forbidden = await request(app.getHttpServer())
      .post("/v1/admin/content/articles/images/upload-url")
      .set({ Authorization: `Bearer ${studentToken}` })
      .send({ purpose: "BODY", contentType: "image/webp" });
    expect(forbidden.status).toBe(403);

    const invalid = await request(app.getHttpServer())
      .post("/v1/admin/content/articles/images/upload-url")
      .set(asEditor())
      .send({ purpose: "BODY", contentType: "image/gif" });
    expect(invalid.status).toBe(400);

    const valid = await request(app.getHttpServer())
      .post("/v1/admin/content/articles/images/upload-url")
      .set(asEditor())
      .send({ purpose: "COVER", contentType: "image/webp" });
    expect(valid.status).toBe(201);
    expect(valid.body).toMatchObject({
      key: expect.stringMatching(/^content\/articles\/cover\/.+\.webp$/),
      maxBytes: 5 * 1024 * 1024,
    });
  });

  it("EDITOR creates a draft; it is listed but NOT public", async () => {
    const create = await request(app.getHttpServer())
      .post("/v1/admin/content/articles")
      .set(asEditor())
      .send(article());
    expect(create.status).toBe(201);
    expect(create.body.isPublished).toBe(false);

    const list = await request(app.getHttpServer())
      .get("/v1/admin/content/articles?family=KPSS")
      .set(asEditor());
    expect(list.body.items.some((a: { slug: string }) => a.slug === SLUG)).toBe(true);

    const pub = await request(app.getHttpServer()).get(`/v1/content/info-articles/${SLUG}`);
    expect(pub.status).toBe(404); // draft not public
  });

  it("publish makes it public; unpublish hides it again (audited)", async () => {
    const publish = await request(app.getHttpServer())
      .post(`/v1/admin/content/articles/${SLUG}/publish`)
      .set(asEditor());
    expect(publish.status).toBe(201);
    expect(publish.body.isPublished).toBe(true);

    const pubVisible = await request(app.getHttpServer()).get(`/v1/content/info-articles/${SLUG}`);
    expect(pubVisible.status).toBe(200);

    const unpublish = await request(app.getHttpServer())
      .post(`/v1/admin/content/articles/${SLUG}/unpublish`)
      .set(asEditor());
    expect(unpublish.body.isPublished).toBe(false);

    const pubHidden = await request(app.getHttpServer()).get(`/v1/content/info-articles/${SLUG}`);
    expect(pubHidden.status).toBe(404);
  });

  it("sanitizes and publishes an HTML article with optional author metadata", async () => {
    const slug = `${SLUG}-html`;
    const create = await request(app.getHttpServer())
      .post("/v1/admin/content/articles")
      .set(asEditor())
      .send(
        article({
          slug,
          bodyFormat: "HTML",
          body: '<h2 onclick="alert(1)">Başvuru</h2><p>Kimliğini hazırla.</p>',
          authorName: "Ayşe Yılmaz",
          authorTitle: "Eğitim Editörü",
        }),
      );
    expect(create.status).toBe(201);
    expect(create.body.editorBodyHtml).toBe("<h2>Başvuru</h2><p>Kimliğini hazırla.</p>");

    await request(app.getHttpServer())
      .post(`/v1/admin/content/articles/${slug}/publish`)
      .set(asEditor())
      .expect(201);
    const published = await request(app.getHttpServer()).get(
      `/v1/content/info-articles/${slug}`,
    );
    expect(published.status).toBe(200);
    expect(published.body).toMatchObject({
      bodyFormat: "HTML",
      body: "<h2>Başvuru</h2><p>Kimliğini hazırla.</p>",
      author: { name: "Ayşe Yılmaz", title: "Eğitim Editörü", bio: null },
    });
  });
});
