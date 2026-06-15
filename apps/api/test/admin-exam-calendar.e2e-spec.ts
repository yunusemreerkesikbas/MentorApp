import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";

const RUN = Date.now();
const SLUG = `e2e-exam-${RUN}`;

/**
 * W6 admin exam-calendar editor (e2e): EDITOR/ADMIN manage editorial `exams` + `exam_events`
 * against a real Postgres (RLS active). Upsert exam → list → upsert event → public calendar
 * reflects EXAM_DATE → delete event → gone. Every write is audited.
 */
describe("admin exam-calendar editor (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let editorToken = "";
  let studentToken = "";

  const signup = async (label: string) => {
    const email = `ec-${label}-${RUN}@test.local`;
    const res = await request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send({ email, password: "Sifre1234", displayName: `EC ${label}`, kvkkAccepted: true });
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

  const auditCount = async (action: string, targetId: string): Promise<number> => {
    const c = await pool.connect();
    try {
      await c.query("select set_config('app.role','SERVICE',true)");
      const res = await c.query(
        "select count(*)::int as n from admin_audit_log where action=$1 and target_id=$2",
        [action, targetId],
      );
      return res.rows[0]?.n ?? 0;
    } finally {
      c.release();
    }
  };

  const exam = (over: Record<string, unknown> = {}) => ({
    slug: SLUG,
    name: "KPSS 2026 Lisans",
    family: "KPSS",
    variant: "LISANS",
    netRule: { kind: "PENALTY", divisor: 4 },
    isCurrent: true,
    ...over,
  });

  const examEvent = (over: Record<string, unknown> = {}) => ({
    type: "EXAM_DATE",
    eventAt: new Date("2026-09-13T07:00:00Z").toISOString(),
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
      .get("/v1/admin/content/exams")
      .set({ Authorization: `Bearer ${studentToken}` });
    expect(res.status).toBe(403);
  });

  it("rejects an exam without netRule (400)", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/admin/content/exams")
      .set(asEditor())
      .send(exam({ slug: `${SLUG}-bad`, netRule: undefined }));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid exam family (400)", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/admin/content/exams")
      .set(asEditor())
      .send(exam({ slug: `${SLUG}-bad2`, family: "ALES" }));
    expect(res.status).toBe(400);
  });

  it("EDITOR creates an exam; it is listed and audited", async () => {
    const create = await request(app.getHttpServer())
      .post("/v1/admin/content/exams")
      .set(asEditor())
      .send(exam());
    expect(create.status).toBe(201);
    expect(create.body.exam.slug).toBe(SLUG);
    expect(create.body.exam.isCurrent).toBe(true);

    const list = await request(app.getHttpServer())
      .get("/v1/admin/content/exams?family=KPSS")
      .set(asEditor());
    expect(list.body.items.some((e: { slug: string }) => e.slug === SLUG)).toBe(true);

    expect(await auditCount("content.exam.upsert", SLUG)).toBeGreaterThan(0);
  });

  it("rejects an event with an invalid type (400)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/admin/content/exams/${SLUG}/events`)
      .set(asEditor())
      .send(examEvent({ type: "BOGUS" }));
    expect(res.status).toBe(400);
  });

  it("rejects an event without trust metadata (400)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/admin/content/exams/${SLUG}/events`)
      .set(asEditor())
      .send(examEvent({ verifiedBy: "" }));
    expect(res.status).toBe(400);
  });

  it("EDITOR upserts an EXAM_DATE event; public calendar reflects it; audited", async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/admin/content/exams/${SLUG}/events`)
      .set(asEditor())
      .send(examEvent());
    expect(res.status).toBe(201);
    expect(res.body.events.some((e: { type: string }) => e.type === "EXAM_DATE")).toBe(true);

    const pub = await request(app.getHttpServer()).get(`/v1/content/exams/${SLUG}/calendar`);
    expect(pub.status).toBe(200);
    expect(pub.body.events.some((e: { type: string }) => e.type === "EXAM_DATE")).toBe(true);

    expect(await auditCount("content.exam-event.upsert", `${SLUG}:EXAM_DATE`)).toBeGreaterThan(0);
  });

  it("deletes the event; it disappears from the exam detail; audited", async () => {
    const del = await request(app.getHttpServer())
      .delete(`/v1/admin/content/exams/${SLUG}/events/EXAM_DATE`)
      .set(asEditor());
    expect(del.status).toBe(204);

    const detail = await request(app.getHttpServer())
      .get(`/v1/admin/content/exams/${SLUG}`)
      .set(asEditor());
    expect(detail.body.events.some((e: { type: string }) => e.type === "EXAM_DATE")).toBe(false);

    expect(await auditCount("content.exam-event.delete", `${SLUG}:EXAM_DATE`)).toBeGreaterThan(0);
  });

  it("returns 404 when deleting a missing event", async () => {
    const res = await request(app.getHttpServer())
      .delete(`/v1/admin/content/exams/${SLUG}/events/RESULT_DATE`)
      .set(asEditor());
    expect(res.status).toBe(404);
  });
});
