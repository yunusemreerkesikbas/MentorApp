import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";

/**
 * W6 admin e2e — STAFF role assignment + audit trail against a real Postgres (RLS active).
 * The acting admin is promoted to ADMIN via a SERVICE-context SQL update (mirrors devnote 0015).
 */
describe("admin (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let adminToken = "";
  let plainToken = "";
  let targetUserId = "";

  const signup = async (label: string) => {
    const email = `w6-${label}-${Date.now()}@test.local`;
    const res = await request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send({ email, password: "Sifre1234", displayName: `W6 ${label}`, kvkkAccepted: true });
    return { email, ...(res.body as { accessToken: string; user: { id: string } }) };
  };

  /** Promote a user to ADMIN directly (the bootstrap admin — no self-service path exists). */
  const promoteToAdmin = async (userId: string) => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.role','SERVICE',true)");
      await client.query("update users set roles = array_append(roles, $1) where id = $2", [
        UserRole.ADMIN,
        userId,
      ]);
      await client.query("commit");
    } finally {
      client.release();
    }
  };

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
    const plain = await signup("plain");
    const target = await signup("target");
    plainToken = plain.accessToken;
    targetUserId = target.user.id;

    await promoteToAdmin(admin.user.id);
    // Re-login so the freshly-issued JWT carries the granted ADMIN role.
    const login = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: admin.email, password: "Sifre1234" });
    adminToken = login.body.accessToken;
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });

  it("rejects non-admin callers with 403", async () => {
    const res = await request(app.getHttpServer())
      .get("/v1/admin/users")
      .set({ Authorization: `Bearer ${plainToken}` });
    expect(res.status).toBe(403);
  });

  it("rejects anonymous callers with 401", async () => {
    const res = await request(app.getHttpServer()).get("/v1/admin/users");
    expect(res.status).toBe(401);
  });

  it("grants STAFF (idempotent) and writes an audit row", async () => {
    const grant = await request(app.getHttpServer())
      .post(`/v1/admin/users/${targetUserId}/roles/staff`)
      .set(asAdmin());
    expect(grant.status).toBe(201);
    expect(grant.body.isStaff).toBe(true);

    // Idempotent: a second grant keeps a single STAFF entry.
    const again = await request(app.getHttpServer())
      .post(`/v1/admin/users/${targetUserId}/roles/staff`)
      .set(asAdmin());
    expect(again.body.roles.filter((r: string) => r === UserRole.STAFF)).toHaveLength(1);

    const audit = await request(app.getHttpServer()).get("/v1/admin/audit-log").set(asAdmin());
    expect(audit.status).toBe(200);
    const staffAssign = audit.body.find(
      (e: { action: string; targetId: string }) =>
        e.action === "staff.assign" && e.targetId === targetUserId,
    );
    expect(staffAssign).toBeTruthy();
    expect(staffAssign.after).toEqual({ roles: expect.arrayContaining([UserRole.STAFF]) });
  });

  it("revokes STAFF", async () => {
    const res = await request(app.getHttpServer())
      .delete(`/v1/admin/users/${targetUserId}/roles/staff`)
      .set(asAdmin());
    expect(res.status).toBe(200);
    expect(res.body.isStaff).toBe(false);
  });

  it("returns ADMIN_USER_NOT_FOUND for a missing user", async () => {
    const missing = "00000000-0000-0000-0000-000000000000";
    const res = await request(app.getHttpServer())
      .post(`/v1/admin/users/${missing}/roles/staff`)
      .set(asAdmin());
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("ADMIN_USER_NOT_FOUND");
  });
});
