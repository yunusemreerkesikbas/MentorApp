import { disableAuthRateLimits } from "./app-harness";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "./browser-request";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";

const RUN = Date.now();

/** Admin waitlist (e2e, real Postgres): SUPPORT lists/invites/deletes, FINANCE reads only, audit written. */
describe("admin waitlist (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  const tokens: Record<string, string> = {};
  const waitingEmail = `wl-waiting-${RUN}@test.local`;
  let waitingId = "";

  const auth = (label: string) => ({ Authorization: `Bearer ${tokens[label]}` });

  const svc = async <T>(fn: (c: import("pg").PoolClient) => Promise<T>): Promise<T> => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('app.role','SERVICE',true)");
      const out = await fn(c);
      await c.query("commit");
      return out;
    } finally {
      c.release();
    }
  };

  const makeActor = async (label: string, role: string): Promise<void> => {
    const email = `wl-${label}-${RUN}@test.local`;
    const res = await request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send({ email, password: "Sifre1234", displayName: `WL ${label}`, kvkkAccepted: true, termsAccepted: true, ageEligibilityConfirmed: true });
    await svc((c) => c.query("update users set roles = array_append(roles,$1) where id=$2", [role, res.body.user.id]));
    const login = await request(app.getHttpServer()).post("/v1/auth/login").send({ email, password: "Sifre1234" });
    tokens[label] = login.body.accessToken;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    disableAuthRateLimits(moduleRef);
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    await app.init();
    await makeActor("support", UserRole.SUPPORT);
    await makeActor("finance", UserRole.FINANCE);
    waitingId = await svc(async (c) => {
      const r = await c.query(
        "insert into signup_invitations (email, role, locale, status) values ($1,'student','tr','waiting') returning id",
        [waitingEmail],
      );
      return r.rows[0].id as string;
    });
  }, 90_000);

  afterAll(async () => {
    await svc((c) => c.query("delete from signup_invitations where email like $1", [`%-${RUN}@test.local`]));
    await app?.close();
    await pool?.end();
  });

  const auditCount = (action: string, targetId: string) =>
    svc(async (c) => {
      const r = await c.query("select count(*)::int as n from admin_audit_log where action=$1 and target_id=$2", [action, targetId]);
      return r.rows[0].n as number;
    });

  it("FINANCE can list but cannot invite", async () => {
    const list = await request(app.getHttpServer()).get("/v1/admin/waitlist").query({ q: waitingEmail }).set(auth("finance"));
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    const invite = await request(app.getHttpServer()).post(`/v1/admin/waitlist/${waitingId}/invite`).set(auth("finance"));
    expect(invite.status).toBe(403);
  });

  it("SUPPORT invites, the email job is queued, the invite is audited", async () => {
    const res = await request(app.getHttpServer()).post(`/v1/admin/waitlist/${waitingId}/invite`).set(auth("support"));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: waitingId, status: "invited" });
    const jobs = await svc((c) =>
      c.query("select count(*)::int as n from jobs where payload->>'to' = $1 and payload->>'template' = 'identity.signup-invitation'", [waitingEmail]),
    );
    expect(jobs.rows[0].n).toBeGreaterThanOrEqual(1);
    expect(await auditCount("signup-invitation.invite", waitingId)).toBe(1);
  });

  it("SUPPORT deletes the row and it is audited", async () => {
    const res = await request(app.getHttpServer()).delete(`/v1/admin/waitlist/${waitingId}`).set(auth("support"));
    expect(res.status).toBe(204);
    expect(await auditCount("signup-invitation.delete", waitingId)).toBe(1);
    const again = await request(app.getHttpServer()).delete(`/v1/admin/waitlist/${waitingId}`).set(auth("support"));
    expect(again.status).toBe(404);
  });
});
