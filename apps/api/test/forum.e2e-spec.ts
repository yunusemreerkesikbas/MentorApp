import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole, ZoneJoinPolicy, ZoneMemberStatus, ZoneType } from "@mentor/types";

const RUN = Date.now();

/**
 * Forum slice 1 (e2e): feature-flag gate, curated zone creation (staff only), OPEN vs REQUEST
 * join, and owner/staff approval — against a real Postgres (RLS active). Gated by forum.enabled.
 */
describe("forum zones (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let adminToken = "";
  let userToken = "";

  const signup = async (label: string) => {
    const email = `forum-${label}-${RUN}@test.local`;
    const res = await request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send({ email, password: "Sifre1234", displayName: `Forum ${label}`, kvkkAccepted: true });
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

  const setForumEnabled = (enabled: boolean) =>
    request(app.getHttpServer())
      .patch("/v1/admin/config/forum.enabled")
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ value: enabled });

  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });
  const asUser = () => ({ Authorization: `Bearer ${userToken}` });

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

    const admin = await signup("admin");
    const user = await signup("user");
    userToken = user.accessToken;

    await grantRole(admin.user.id, UserRole.ADMIN);
    const login = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: admin.email, password: "Sifre1234" });
    adminToken = login.body.accessToken;
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  it("404s when the feature flag is off", async () => {
    await setForumEnabled(false);
    const res = await request(app.getHttpServer()).get("/v1/forum/zones").set(asUser());
    expect(res.status).toBe(404);
  });

  it("non-staff cannot create a zone", async () => {
    await setForumEnabled(true);
    const res = await request(app.getHttpServer())
      .post("/v1/forum/zones")
      .set(asUser())
      .send({ type: ZoneType.CHAT, title: "Yetkisiz Oda" });
    expect(res.status).toBe(403);
  });

  it("staff creates a zone and a user joins an OPEN zone (→ ACTIVE)", async () => {
    const created = await request(app.getHttpServer())
      .post("/v1/forum/zones")
      .set(asAdmin())
      .send({ type: ZoneType.QA, title: "KPSS Genel", joinPolicy: ZoneJoinPolicy.OPEN });
    expect(created.status).toBe(201);
    const zoneId = created.body.id as string;

    const joined = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/join`)
      .set(asUser());
    expect(joined.body.status).toBe(ZoneMemberStatus.ACTIVE);
  });

  it("REQUEST zone join is PENDING then staff approves (→ ACTIVE)", async () => {
    const created = await request(app.getHttpServer())
      .post("/v1/forum/zones")
      .set(asAdmin())
      .send({ type: ZoneType.CHAT, title: "Onaylı Oda", joinPolicy: ZoneJoinPolicy.REQUEST });
    const zoneId = created.body.id as string;
    const user = await signup("requester");

    const joined = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/join`)
      .set({ Authorization: `Bearer ${user.accessToken}` });
    expect(joined.body.status).toBe(ZoneMemberStatus.PENDING);

    // Staff/owner can see the pending request (so they have a userId to approve).
    const pending = await request(app.getHttpServer())
      .get(`/v1/forum/zones/${zoneId}/members?status=${ZoneMemberStatus.PENDING}`)
      .set(asAdmin());
    expect(pending.status).toBe(200);
    expect(pending.body.map((m: { userId: string }) => m.userId)).toContain(user.user.id);

    const approved = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/members/${user.user.id}/approve`)
      .set(asAdmin())
      .send({ approve: true });
    expect(approved.status).toBe(201);
  });
});
