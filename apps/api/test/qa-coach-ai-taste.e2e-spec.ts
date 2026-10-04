import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { UserRole } from "@mentor/types";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConfigRegistryService } from "../src/common/config/config-registry.service";

const KEYS = [
  "mentorship.enabled",
  "mentorship.coach.free_seats",
  "ai.enabled",
  "ai.features.mentorship.suggestions.free_enabled",
  "ai.features.mentorship.suggestions.free_limit",
] as const;

describe("coach AI free taste (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let config: ConfigRegistryService;
  const stamp = randomUUID();
  const users: Record<string, { id: string; token: string }> = {};
  const email = (label: string) => `qa-taste-${label}-${stamp}@test.local`;
  const http = () => request(app.getHttpServer());
  const auth = (label: string) => ({ Authorization: `Bearer ${users[label]!.token}` });

  const serviceQuery = async (sql: string, values: unknown[] = []) => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.role','SERVICE',true)");
      const result = await client.query(sql, values);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  };

  const usageCount = async (label: string) => {
    const result = await serviceQuery(
      "select count(*)::int as n from ai_usage where user_id=$1 and feature='mentorship_suggestions'",
      [users[label]!.id],
    );
    return result.rows[0]?.n as number;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    await app.init();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    config = app.get(ConfigRegistryService);

    for (const label of ["coach", "student", "stranger"]) {
      const response = await http().post("/v1/auth/signup").send({
        email: email(label),
        password: "Sifre1234",
        displayName: `QA ${label}`,
        kvkkAccepted: true,
        termsAccepted: true,
        ageEligibilityConfirmed: true,
      });
      expect(response.status).toBe(201);
      users[label] = { id: response.body.user.id, token: response.body.accessToken };
    }

    await serviceQuery("update users set roles=array_append(roles,$1), email_verified_at=now(), phone_number='+905' || lpad((abs(hashtext(id::text)::bigint) % 1000000000)::text, 9, '0'), phone_verified_at=now() where id=$2", [
      UserRole.COACH,
      users.coach!.id,
    ]);
    await serviceQuery(
      "insert into mentorship_coach_applications (user_id,status,headline,bio) values ($1,'ACTIVE','QA coach','QA profile')",
      [users.coach!.id],
    );
    const login = await http().post("/v1/auth/login").send({
      email: email("coach"),
      password: "Sifre1234",
    });
    expect(login.status).toBe(200);
    users.coach!.token = login.body.accessToken;

    await config.set(users.coach!.id, "mentorship.enabled", true);
    await config.set(users.coach!.id, "mentorship.coach.free_seats", 1);
    await config.set(users.coach!.id, "ai.enabled", true);
    await config.set(users.coach!.id, "ai.features.mentorship.suggestions.free_enabled", false);
    await config.set(users.coach!.id, "ai.features.mentorship.suggestions.free_limit", 1);

    const invite = await http().post("/v1/mentorship/invite-code").set(auth("coach"));
    expect(invite.status).toBe(200);
    const accept = await http()
      .post("/v1/mentorship/invitations/accept")
      .set(auth("student"))
      .send({ code: invite.body.code });
    expect(accept.status).toBe(200);
  }, 120_000);

  afterAll(async () => {
    if (pool) {
      await serviceQuery("delete from config_overrides where key=any($1::text[])", [KEYS]);
    }
    await app?.close();
    await pool?.end();
  });

  it("allows one linked coach draft, charges the coach, then enforces the daily limit", async () => {
    const path = `/v1/mentorship/students/${users.student!.id}/assignment-suggestions`;
    const off = await http().post(path).set(auth("coach"));
    expect(off.status).toBe(403);
    expect(await usageCount("coach")).toBe(0);

    await config.set(users.coach!.id, "ai.features.mentorship.suggestions.free_enabled", true);
    const studentPhone = await serviceQuery("select phone_number, phone_verified_at from users where id=$1", [users.student!.id]);
    expect(studentPhone.rows[0]).toMatchObject({ phone_number: null, phone_verified_at: null });
    const first = await http().post(path).set(auth("coach"));
    expect(first.status).toBe(200);
    expect(first.body.tasks.length).toBeGreaterThan(0);
    expect(await usageCount("coach")).toBe(1);
    expect(await usageCount("student")).toBe(0);

    const second = await http().post(path).set(auth("coach"));
    expect(second.status).toBe(403);
    expect(second.body.code).toBe("MENTORSHIP_AI_DAILY_LIMIT");
    expect(await usageCount("coach")).toBe(1);

    const unrelated = await http()
      .post(`/v1/mentorship/students/${users.stranger!.id}/assignment-suggestions`)
      .set(auth("coach"));
    expect(unrelated.status).toBe(404);
    expect(await usageCount("coach")).toBe(1);
  });
});
