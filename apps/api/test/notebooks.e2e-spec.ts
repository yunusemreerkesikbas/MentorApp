import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const RUN = Date.now();
const PASSWORD = "Sifre1234";

describe("notebook collection (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let tokenA = "";
  let tokenB = "";
  let userA = "";
  let systemA = "";
  let customA = "";

  const authA = () => ({ Authorization: `Bearer ${tokenA}` });
  const authB = () => ({ Authorization: `Bearer ${tokenB}` });

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ??
      "postgres://mentor:mentor@localhost:5433/mentor_test";
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    await app.init();

    const signup = async (label: string) => {
      const response = await request(app.getHttpServer())
        .post("/v1/auth/signup")
        .send({
          email: `notebooks-${label}-${RUN}@test.local`,
          password: PASSWORD,
          displayName: `Notebooks ${label}`,
          kvkkAccepted: true,
        });
      expect(response.status).toBe(201);
      return response.body as {
        accessToken: string;
        user: { id: string };
      };
    };

    const a = await signup("a");
    const b = await signup("b");
    tokenA = a.accessToken;
    tokenB = b.accessToken;
    userA = a.user.id;
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  it("creates one idempotent system notebook and always lists it first", async () => {
    const first = await request(app.getHttpServer())
      .get("/v1/coaching/notebooks?page=1&pageSize=12")
      .set(authA());
    expect(first.status).toBe(200);
    expect(first.body.items).toHaveLength(1);
    expect(first.body.items[0]).toMatchObject({ kind: "MISTAKE", title: null });
    systemA = first.body.items[0].id;

    const second = await request(app.getHttpServer())
      .get("/v1/coaching/notebooks?page=1&pageSize=12")
      .set(authA());
    expect(second.status).toBe(200);
    expect(second.body.items.filter((item: { kind: string }) => item.kind === "MISTAKE")).toHaveLength(
      1,
    );

    const stored = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM notebooks WHERE user_id = $1 AND kind = 'MISTAKE'",
      [userA],
    );
    expect(stored.rows[0]?.count).toBe(1);
  });

  it("creates general and taxonomy-bound custom notebooks and paginates system-first", async () => {
    const calendar = await request(app.getHttpServer()).get(
      "/v1/content/exams/kpss-lisans-2026/calendar",
    );
    expect(calendar.status).toBe(200);
    const examId = calendar.body.exam.id as string;

    const general = await request(app.getHttpServer())
      .post("/v1/coaching/notebooks")
      .set(authA())
      .send({
        title: "Genel Notlar",
        examId: null,
        subjectRef: null,
        cover: { color: "navy", material: "cloth" },
      });
    expect(general.status).toBe(201);
    customA = general.body.id;

    const subject = await request(app.getHttpServer())
      .post("/v1/coaching/notebooks")
      .set(authA())
      .send({
        title: "Türkçe Notları",
        examId,
        subjectRef: "turkce",
        cover: { color: "plum", material: "leather" },
      });
    expect(subject.status).toBe(201);
    expect(subject.body).toMatchObject({ subjectRef: "turkce", subjectName: "Türkçe" });

    const invalid = await request(app.getHttpServer())
      .post("/v1/coaching/notebooks")
      .set(authA())
      .send({
        title: "Geçersiz",
        examId,
        subjectRef: "olmayan-ders",
        cover: { color: "navy", material: "cloth" },
      });
    expect(invalid.status).toBe(400);

    const list = await request(app.getHttpServer())
      .get("/v1/coaching/notebooks?page=1&pageSize=2")
      .set(authA());
    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({ page: 1, pageSize: 2, total: 3 });
    expect(list.body.items[0].id).toBe(systemA);
    expect(list.body.items[0].kind).toBe("MISTAKE");

    const pageTwo = await request(app.getHttpServer())
      .get("/v1/coaching/notebooks?page=2&pageSize=2")
      .set(authA());
    expect(pageTwo.status).toBe(200);
    expect(pageTwo.body.items).toHaveLength(1);
  });

  it("updates owned metadata while hiding foreign notebooks and protecting the system book", async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/v1/coaching/notebooks/${customA}`)
      .set(authA())
      .send({ title: "Güncel Genel Notlar", cover: { color: "forest", material: "kraft" } });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      title: "Güncel Genel Notlar",
      cover: { color: "forest", material: "kraft" },
    });

    const foreign = await request(app.getHttpServer())
      .get(`/v1/coaching/notebooks/${customA}`)
      .set(authB());
    expect(foreign.status).toBe(404);

    const protectedDelete = await request(app.getHttpServer())
      .delete(`/v1/coaching/notebooks/${systemA}`)
      .set(authA());
    expect(protectedDelete.status).toBe(403);
  });

  it("keeps custom pages free-form and legacy overview scoped to the system notebook", async () => {
    const emptyDoc = { version: 1, paper: "ruled", items: [], ink: [] };
    const customPage = await request(app.getHttpServer())
      .put(`/v1/coaching/notebooks/${customA}/pages/0`)
      .set(authA())
      .send({ doc: emptyDoc });
    expect(customPage.status).toBe(200);

    const forbiddenEntry = await request(app.getHttpServer())
      .put(`/v1/coaching/notebooks/${customA}/pages/1`)
      .set(authA())
      .send({
        doc: {
          ...emptyDoc,
          items: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              kind: "entry",
              entryId: "22222222-2222-4222-8222-222222222222",
              x: 0,
              y: 0,
              width: 100,
              height: 100,
              rotation: 0,
              opacity: 1,
              z: 0,
            },
          ],
        },
      });
    expect(forbiddenEntry.status).toBe(400);

    const legacyPage = await request(app.getHttpServer())
      .put("/v1/coaching/notebook/pages/0")
      .set(authA())
      .send({ doc: emptyDoc });
    expect(legacyPage.status).toBe(200);

    const overview = await request(app.getHttpServer())
      .get("/v1/coaching/notebook")
      .set(authA());
    expect(overview.status).toBe(200);
    expect(overview.body.notebook.id).toBe(systemA);
    expect(overview.body.pageCount).toBe(1);
    expect(overview.body.notebook.pageCount).toBe(1);

    const collection = await request(app.getHttpServer())
      .get("/v1/coaching/notebooks?page=1&pageSize=12")
      .set(authA());
    expect(collection.status).toBe(200);
    expect(collection.body.items[0]).toMatchObject({
      id: systemA,
      kind: "MISTAKE",
      pageCount: 1,
    });
  });

  it("deletes custom pages by cascade", async () => {
    const deleted = await request(app.getHttpServer())
      .delete(`/v1/coaching/notebooks/${customA}`)
      .set(authA());
    expect(deleted.status).toBe(204);

    const pages = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM notebook_pages WHERE notebook_id = $1",
      [customA],
    );
    expect(pages.rows[0]?.count).toBe(0);
  });
});
