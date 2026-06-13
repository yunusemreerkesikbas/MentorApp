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
  let plainUserId = "";
  let targetUserId = "";
  let targetEmail = "";
  let adminUserId = "";

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
    plainUserId = plain.user.id;
    targetUserId = target.user.id;
    targetEmail = target.email;
    adminUserId = admin.user.id;

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

  it("returns user detail (no secrets)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/admin/users/${targetUserId}`)
      .set(asAdmin());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(targetUserId);
    expect(res.body).not.toHaveProperty("passwordHash");
    expect(res.body).toHaveProperty("emailVerified");
  });

  it("changes status (suspend) and audits it", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/admin/users/${targetUserId}/status`)
      .set(asAdmin())
      .send({ status: "SUSPENDED" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("SUSPENDED");

    const audit = await request(app.getHttpServer()).get("/v1/admin/audit-log").set(asAdmin());
    const entry = audit.body.find(
      (e: { action: string; targetId: string }) => e.action === "user.status" && e.targetId === targetUserId,
    );
    expect(entry.after).toEqual({ status: "SUSPENDED" });
  });

  it("rejects changing your own status (ADMIN_CANNOT_MODIFY_SELF)", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/admin/users/${adminUserId}/status`)
      .set(asAdmin())
      .send({ status: "SUSPENDED" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ADMIN_CANNOT_MODIFY_SELF");
  });

  it("rejects an invalid status value", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/admin/users/${targetUserId}/status`)
      .set(asAdmin())
      .send({ status: "NOPE" });
    expect(res.status).toBe(400);
  });

  it("exports the user's identity data (no secrets)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/admin/users/${targetUserId}/export`)
      .set(asAdmin());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(targetUserId);
    expect(res.body).toHaveProperty("email");
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("anonymizes (KVKK) — scrubs PII, bans, and does NOT leak PII into the audit log", async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/admin/users/${targetUserId}/anonymize`)
      .set(asAdmin());
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("BANNED");
    expect(res.body.email).toContain("anonymized.local");

    // KVKK guardrail: the append-only audit must record THAT it happened, not the erased PII.
    const audit = await request(app.getHttpServer()).get("/v1/admin/audit-log").set(asAdmin());
    const entry = audit.body.find(
      (e: { action: string; targetId: string }) =>
        e.action === "user.kvkk-anonymize" && e.targetId === targetUserId,
    );
    expect(entry).toBeTruthy();
    expect(entry.after).toMatchObject({ anonymized: true });
    expect(JSON.stringify(entry)).not.toContain(targetEmail);
  });

  it("lists config (feature flags) with defaults", async () => {
    const res = await request(app.getHttpServer()).get("/v1/admin/config").set(asAdmin());
    expect(res.status).toBe(200);
    const ai = res.body.find((e: { key: string }) => e.key === "ai.enabled");
    expect(ai).toMatchObject({ category: "feature-flags", type: "boolean" });
  });

  it("rejects config from non-admins (403)", async () => {
    const res = await request(app.getHttpServer())
      .get("/v1/admin/config")
      .set({ Authorization: `Bearer ${plainToken}` });
    expect(res.status).toBe(403);
  });

  it("updates a flag, reflects it, and audits the change", async () => {
    const patch = await request(app.getHttpServer())
      .patch("/v1/admin/config/economy.enabled")
      .set(asAdmin())
      .send({ value: true });
    expect(patch.status).toBe(200);
    const economy = patch.body.find((e: { key: string }) => e.key === "economy.enabled");
    expect(economy.value).toBe(true);

    const audit = await request(app.getHttpServer()).get("/v1/admin/audit-log").set(asAdmin());
    const entry = audit.body.find(
      (e: { action: string; targetId: string }) =>
        e.action === "config.update" && e.targetId === "economy.enabled",
    );
    expect(entry.after).toEqual({ value: true });
  });

  it("rejects an invalid config value (400)", async () => {
    const res = await request(app.getHttpServer())
      .patch("/v1/admin/config/ai.enabled")
      .set(asAdmin())
      .send({ value: "nope" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ADMIN_CONFIG_INVALID_VALUE");
  });

  it("rejects an unknown config key (404)", async () => {
    const res = await request(app.getHttpServer())
      .patch("/v1/admin/config/does.not.exist")
      .set(asAdmin())
      .send({ value: true });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("ADMIN_CONFIG_KEY_NOT_FOUND");
  });

  // ---- economy (W6 light economy slice 1) ----
  const setEconomyEnabled = (on: boolean) =>
    request(app.getHttpServer())
      .patch("/v1/admin/config/economy.enabled")
      .set(asAdmin())
      .send({ value: on });

  it("user economy balance is 404 when economy is disabled", async () => {
    await setEconomyEnabled(false);
    const res = await request(app.getHttpServer())
      .get("/v1/economy/balance")
      .set({ Authorization: `Bearer ${plainToken}` });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("ECONOMY_DISABLED");
  });

  it("admin adjust credits coin, the user sees it, and it is audited", async () => {
    await setEconomyEnabled(true);
    const adjust = await request(app.getHttpServer())
      .post(`/v1/admin/users/${plainUserId}/economy/adjust`)
      .set(asAdmin())
      .send({ unit: "COIN", amount: 25, reason: "e2e-grant" });
    expect(adjust.status).toBe(201);
    expect(adjust.body.coinConfirmed).toBe(25);

    const balance = await request(app.getHttpServer())
      .get("/v1/economy/balance")
      .set({ Authorization: `Bearer ${plainToken}` });
    expect(balance.status).toBe(200);
    expect(balance.body.coinConfirmed).toBe(25);

    const audit = await request(app.getHttpServer()).get("/v1/admin/audit-log").set(asAdmin());
    const entry = audit.body.find(
      (e: { action: string; targetId: string }) =>
        e.action === "economy.adjust" && e.targetId === plainUserId,
    );
    expect(entry).toBeTruthy();
  });

  it("rejects an invalid economy adjust (zero amount → 400)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/admin/users/${plainUserId}/economy/adjust`)
      .set(asAdmin())
      .send({ unit: "COIN", amount: 0, reason: "bad" });
    expect(res.status).toBe(400);
  });
});
