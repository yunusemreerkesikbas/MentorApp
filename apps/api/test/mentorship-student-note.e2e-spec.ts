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
 * The student's standing note to their coach (QA F4, 2026-09-27), the mirror of the coach's note:
 * one note per link, written on `/my-coach`, read back to the student there and shown on the
 * coach's report, the coach told at most once a day, gone when the link ends.
 */
describe("mentorship student note (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  const token: Record<string, string> = {};
  const userId: Record<string, string> = {};
  let stamp = 0;

  const NOTE_TITLE = "W8N student sana not bıraktı";
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
      email: `w8n-${label}-${stamp}@test.local`,
      password: "Sifre1234",
      displayName: `W8N ${label}`,
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
      .send({ email: `w8n-${label}-${stamp}@test.local`, password: "Sifre1234" });
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

  const writeNote = (who: string, body: string | null) =>
    http().put("/v1/mentorship/my-coach/note").set(auth(who)).send({ body });
  const myCoach = async () =>
    (await http().get("/v1/mentorship/my-coach").set(auth("student"))).body;
  const report = async () =>
    (await http().get(`/v1/mentorship/students/${userId.student}`).set(auth("coach"))).body;

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
    for (const label of ["coach", "student", "outsider", "admin"]) await signup(label);
    await grantRoleAndRelogin("coach", UserRole.COACH);
    await grantRoleAndRelogin("admin", UserRole.SUPER_ADMIN);
    await app.get(ConfigRegistryService).set(userId.admin!, "mentorship.enabled", true);
    await link();
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

  it("reaches the coach's report and is read back to the student", async () => {
    expect((await writeNote("student", "  Cuma akşamları çalışamıyorum.  ")).status).toBe(204);

    expect((await myCoach()).studentNote).toMatchObject({ body: "Cuma akşamları çalışamıyorum." });
    expect((await report()).studentNote).toMatchObject({ body: "Cuma akşamları çalışamıyorum." });
  });

  it("tells the coach, with a link to the student's report", async () => {
    const target = `/students/${userId.student}`;
    let inbox: Array<{ title: string; linkUrl: string | null }> = [];
    for (let attempt = 0; attempt < 40; attempt++) {
      inbox = (await http().get("/v1/notifications").set(auth("coach"))).body.items;
      if (inbox.some((n) => n.linkUrl === target && n.title === NOTE_TITLE)) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(inbox.filter((n) => n.title === NOTE_TITLE)).toHaveLength(1);

    // Rewording it the same day is not news again.
    expect((await writeNote("student", "Cuma ve cumartesi akşamları çalışamıyorum.")).status).toBe(204);
    await new Promise((resolve) => setTimeout(resolve, 300));
    inbox = (await http().get("/v1/notifications").set(auth("coach"))).body.items;
    expect(inbox.filter((n) => n.title === NOTE_TITLE)).toHaveLength(1);
  });

  it("is refused past 500 characters, and to a student with no coach", async () => {
    expect((await writeNote("student", "x".repeat(501))).status).toBe(400);
    expect((await writeNote("outsider", "Merhaba")).status).toBe(404);
  });

  it("goes with the link", async () => {
    expect((await http().delete("/v1/mentorship/my-coach").set(auth("student"))).status).toBe(204);
    await link();

    expect((await myCoach()).studentNote).toBeNull();
    expect((await report()).studentNote).toBeNull();
  });
});
