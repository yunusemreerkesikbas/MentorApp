import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";
import { ConfigRegistryService } from "../src/common/config/config-registry.service";

/**
 * A finalized week reaches the student in the app (QA F5, 2026-09-27): the same safe projection the
 * coach prints (no coach brief, no evidence), each week once at its latest version, through the
 * student's own live link only, and the student is told when one arrives.
 */
describe("mentorship weekly report, the student's side (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  const token: Record<string, string> = {};
  const userId: Record<string, string> = {};
  let stamp = 0;

  const auth = (who: string) => ({ Authorization: `Bearer ${token[who]}` });
  const http = () => request(app.getHttpServer());

  const svc = async (fn: (c: import("pg").PoolClient) => Promise<void>) => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('app.role','SERVICE',true)");
      await fn(c);
      await c.query("commit");
    } catch (err) {
      await c.query("rollback").catch(() => undefined);
      throw err;
    } finally {
      c.release();
    }
  };

  const signup = async (label: string) => {
    const res = await http().post("/v1/auth/signup").send({
      email: `w8w-${label}-${stamp}@test.local`,
      password: "Sifre1234",
      displayName: `W8W ${label}`,
      kvkkAccepted: true,
      termsAccepted: true,
      ageEligibilityConfirmed: true,
    });
    expect(res.status).toBe(201);
    token[label] = res.body.accessToken;
    userId[label] = res.body.user.id;
  };

  /** Grant a role in the DB (a COACH with what self-service registration writes), then re-login. */
  const grantRoleAndRelogin = async (label: string, role: string) => {
    await svc(async (c) => {
      await c.query("update users set roles = array_append(roles,$1) where id=$2", [
        role,
        userId[label],
      ]);
      if (role === UserRole.COACH) {
        await c.query("update users set email_verified_at = now(), phone_number = '+905' || lpad((abs(hashtext(id::text)::bigint) % 1000000000)::text, 9, '0'), phone_verified_at = now() where id = $1", [userId[label]]);
        await c.query(
          "insert into mentorship_coach_applications (user_id, status, headline, bio) values ($1, $2, $3, $4) on conflict (user_id) do nothing",
          [userId[label], "ACTIVE", "Test kocu", "Test koc profili."],
        );
      }
    });
    const login = await http()
      .post("/v1/auth/login")
      .send({ email: `w8w-${label}-${stamp}@test.local`, password: "Sifre1234" });
    expect(login.status).toBe(200);
    token[label] = login.body.accessToken;
  };

  /** Preview the last completed week, then finalize it the way the coach's panel does. */
  const finalizeWeek = async (coachEvaluation: string, replacesId: string | null = null) => {
    const preview = await http()
      .get(`/v1/mentorship/students/${userId.student}/weekly-reports/preview`)
      .set(auth("coach"));
    expect(preview.status).toBe(200);
    const res = await http()
      .post(`/v1/mentorship/students/${userId.student}/weekly-reports/finalize`)
      .set(auth("coach"))
      .send({
        weekStart: preview.body.snapshot.period.startDate,
        sourceFingerprint: preview.body.sourceFingerprint,
        operationId: randomUUID(),
        coachEvaluation,
        replacesId,
      });
    expect([200, 201]).toContain(res.status);
    return res.body as { id: string; version: number };
  };

  const studentList = async (who = "student") =>
    http().get("/v1/mentorship/my-coach/weekly-reports").set(auth(who));

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    process.env.JWT_ACCESS_SECRET ??= "test-secret-test-secret-test-secret!!";

    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    await app.init();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    stamp = Date.now();
    for (const label of ["coach", "student", "outsider", "admin"]) await signup(label);
    await grantRoleAndRelogin("coach", UserRole.COACH);
    await grantRoleAndRelogin("admin", UserRole.SUPER_ADMIN);
    const config = app.get(ConfigRegistryService);
    await config.set(userId.admin!, "mentorship.enabled", true);
    await config.set(userId.admin!, "mentorship.weekly_reports.enabled", true);

    const code = (await http().post("/v1/mentorship/invite-code").set(auth("coach"))).body.code;
    const accept = await http()
      .post("/v1/mentorship/invitations/accept")
      .set(auth("student"))
      .send({ code });
    expect(accept.status).toBe(200);
  }, 120_000);

  afterAll(async () => {
    if (pool) {
      await svc(async (c) => {
        await c.query("delete from config_overrides where key like 'mentorship.%'");
      });
    }
    await app?.close();
    await pool?.end();
  });

  let first = { id: "", version: 0 };

  it("lets the student read the week their coach finalized, without the coach's own material", async () => {
    first = await finalizeWeek("Ritmi birlikte koruyalım.");

    const list = await studentList();
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].id).toBe(first.id);

    const report = await http()
      .get(`/v1/mentorship/my-coach/weekly-reports/${first.id}`)
      .set(auth("student"));
    expect(report.status).toBe(200);
    expect(report.body).toMatchObject({
      id: first.id,
      coachDisplayName: "W8W coach",
      coachEvaluation: "Ritmi birlikte koruyalım.",
    });
    expect(JSON.stringify(report.body)).not.toMatch(/"brief"|"evidence"|coachContext/);
  });

  it("tells the student, with a link to that week", async () => {
    let inbox: Array<{ title: string; linkUrl: string | null }> = [];
    for (let attempt = 0; attempt < 40; attempt++) {
      inbox = (await http().get("/v1/notifications").set(auth("student"))).body.items;
      if (inbox.some((n) => n.linkUrl === `/my-coach/weekly-reports/${first.id}`)) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(inbox.find((n) => n.linkUrl === `/my-coach/weekly-reports/${first.id}`)?.title).toBe(
      "Koçun haftanı değerlendirdi",
    );
  });

  it("shows a corrected week once, at its latest version", async () => {
    const correction = await finalizeWeek("Düzeltme: cumayı hafif tutalım.", first.id);
    expect(correction.version).toBe(2);

    const list = await studentList();
    expect(list.body.total).toBe(1);
    expect(list.body.items[0]).toMatchObject({ id: correction.id, version: 2 });
  });

  it("is nobody else's to read", async () => {
    expect((await studentList("outsider")).status).toBe(404);
    expect(
      (
        await http()
          .get(`/v1/mentorship/my-coach/weekly-reports/${first.id}`)
          .set(auth("outsider"))
      ).status,
    ).toBe(404);
    // The coach reads through their own routes; as a "student" they have no coach.
    expect((await studentList("coach")).status).toBe(404);
  });
});
