import { disableAuthRateLimits } from "./app-harness";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "./browser-request";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";
import { ConfigRegistryService } from "../src/common/config/config-registry.service";

/**
 * What a coach's work in the student's plan becomes when their link ends (QA F1, 2026-09-27): the
 * PENDING tasks are the student's own from then on (no coach mark, no coach note, editable), the
 * DONE ones stay the coach's record. The note goes with the mark because only a coach-origin task
 * may carry one (`plan_tasks_coach_note_origin_chk`), as when a coach's account is erased.
 *
 * Its own file because completing a task writes today's activity, and `mentorship.e2e-spec.ts`
 * builds its INACTIVE blocks on a student with no activity at all.
 */
describe("mentorship link end (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  const token: Record<string, string> = {};
  const userId: Record<string, string> = {};
  let stamp = 0;

  const auth = (who: string) => ({ Authorization: `Bearer ${token[who]}` });
  const http = () => request(app.getHttpServer());
  const isoDaysFromNow = (days: number) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(
      new Date(Date.now() + days * 86_400_000),
    );

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
      email: `w8e-${label}-${stamp}@test.local`,
      password: "Sifre1234",
      displayName: `W8E ${label}`,
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
      .send({ email: `w8e-${label}-${stamp}@test.local`, password: "Sifre1234" });
    expect(login.status).toBe(200);
    token[label] = login.body.accessToken;
  };

  const link = async () => {
    const code = (await http().post("/v1/mentorship/invite-code").set(auth("coach"))).body.code;
    const accept = await http()
      .post("/v1/mentorship/invitations/accept")
      .set(auth("student"))
      .send({ code });
    expect(accept.status).toBe(200);
  };

  const assign = async (tasks: Array<{ title: string; taskDate: string; coachNote?: string }>) => {
    const res = await http()
      .post(`/v1/mentorship/students/${userId.student}/assignments`)
      .set(auth("coach"))
      .send({ tasks });
    expect(res.status).toBe(201);
  };

  const studentTask = async (title: string) => {
    const res = await http()
      .get("/v1/plan-tasks")
      .query({ from: isoDaysFromNow(0), to: isoDaysFromNow(3) })
      .set(auth("student"));
    expect(res.status).toBe(200);
    return (res.body.items as Array<{
      id: string;
      title: string;
      coachNote: string | null;
      origin: { type: string } | null;
    }>)
      .find((task) => task.title === title)!;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    process.env.JWT_ACCESS_SECRET ??= "test-secret-test-secret-test-secret!!";

    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    disableAuthRateLimits(moduleRef);
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    await app.init();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    stamp = Date.now();
    for (const label of ["coach", "student", "admin"]) await signup(label);
    await grantRoleAndRelogin("coach", UserRole.COACH);
    await grantRoleAndRelogin("admin", UserRole.SUPER_ADMIN);
    await app.get(ConfigRegistryService).set(userId.admin!, "mentorship.enabled", true);
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

  it("hands the student the coach's pending work when the student leaves", async () => {
    await link();
    await assign([
      { title: "Bekleyen koç ödevi", taskDate: isoDaysFromNow(2), coachNote: "Süre tut." },
      { title: "Yapılmış koç ödevi", taskDate: isoDaysFromNow(0) },
    ]);
    const done = await studentTask("Yapılmış koç ödevi");
    expect(
      (await http().patch(`/v1/plan-tasks/${done.id}`).set(auth("student")).send({ status: "DONE" }))
        .status,
    ).toBe(200);
    const pending = await studentTask("Bekleyen koç ödevi");
    // While the link stands, the coach's wording is theirs.
    expect(
      (await http().patch(`/v1/plan-tasks/${pending.id}`).set(auth("student")).send({ title: "x" }))
        .status,
    ).toBe(403);

    expect((await http().delete("/v1/mentorship/my-coach").set(auth("student"))).status).toBe(204);

    const released = await studentTask("Bekleyen koç ödevi");
    expect(released.origin).toBeNull();
    expect(released.coachNote).toBeNull();
    expect((await studentTask("Yapılmış koç ödevi")).origin?.type).toBe("MENTORSHIP");
    const renamed = await http()
      .patch(`/v1/plan-tasks/${pending.id}`)
      .set(auth("student"))
      .send({ title: "Artık benim ödevim" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.title).toBe("Artık benim ödevim");
  });

  it("does the same when the coach ends it", async () => {
    await link();
    await assign([{ title: "Koç bitirmeden önceki ödev", taskDate: isoDaysFromNow(3) }]);
    expect((await studentTask("Koç bitirmeden önceki ödev")).origin?.type).toBe("MENTORSHIP");

    expect(
      (await http().delete(`/v1/mentorship/students/${userId.student}`).set(auth("coach"))).status,
    ).toBe(204);

    expect((await studentTask("Koç bitirmeden önceki ödev")).origin).toBeNull();
  });
});
