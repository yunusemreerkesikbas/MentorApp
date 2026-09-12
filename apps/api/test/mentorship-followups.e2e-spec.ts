import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConfigRegistryService } from "../src/common/config/config-registry.service";
import { MentorshipFollowupService } from "../src/modules/mentorship/application/mentorship-followup.service";
import { MentorshipLinkRepository } from "../src/modules/mentorship/infrastructure/mentorship-link.repository";
import { followupToday } from "../src/modules/mentorship/domain/mentorship-followup";

describe("mentorship followups HTTP and database", () => {
  let app: INestApplication;
  let pool: Pool;
  const ids: Record<string, string> = {};
  const tokens: Record<string, string> = {};
  let record: { id: string; version: number };
  let privateId: string;
  let linkId: string;
  const http = () => request(app.getHttpServer());
  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const base = () => `/v1/mentorship/students/${ids.student}/followups`;
  const shared = "/v1/mentorship/my-coach/followups";
  const today = () => followupToday(new Date());
  const draft = (extra = {}) => ({ operationId: randomUUID(), title: "PRIVATE action title", privateNote: "PRIVATE coach note", sharedDecision: "Walk through the week together", followUpDate: today(), ...extra });
  async function sql(text: string, values: unknown[] = []) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.role','SERVICE',true)");
      const result = await client.query(text, values);
      await client.query("commit");
      return result;
    } catch (error) { await client.query("rollback"); throw error; }
    finally { client.release(); }
  }
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    const { AppModule } = await import("../src/app.module");
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    await app.init();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    for (const who of ["coach", "other", "student", "outsider"]) {
      const result = await http().post("/v1/auth/signup").send({ email: `followup-${who}-${randomUUID()}@test.local`, password: "Sifre1234", displayName: `Followup ${who}`, kvkkAccepted: true });
      expect(result.status).toBe(201);
      ids[who] = result.body.user.id;
      tokens[who] = result.body.accessToken;
    }
    await sql("update users set roles = array_append(roles, 'COACH') where id = any($1::uuid[])", [[ids.coach, ids.other]]);
    const config = app.get(ConfigRegistryService);
    await config.set(ids.coach!, "mentorship.enabled", true);
    await config.set(ids.coach!, "mentorship.followups.enabled", true);
    const relation = await sql("insert into coach_students(coach_id,student_id,status,source,accepted_at) values($1,$2,'ACTIVE','INVITE',now()) returning id", [ids.coach, ids.student]);
    linkId = relation.rows[0].id;
  }, 120_000);
  afterAll(async () => {
    if (pool) {
      await sql("delete from coach_students where coach_id = $1", [ids.coach]);
      await sql("delete from config_overrides where key in ('mentorship.enabled','mentorship.followups.enabled')");
    }
    await app?.close();
    await pool?.end();
  });

  it("requires authentication, role and an active student link", async () => {
    expect((await http().get("/v1/mentorship/followups/availability")).status).toBe(401);
    expect((await http().post(base()).set(auth("student")).send(draft())).status).toBe(403);
    expect((await http().post(base()).set(auth("other")).send(draft())).status).toBe(404);
  });
  it("atomically deduplicates creates, rejects key reuse, and whitelists student output", async () => {
    const input = draft();
    const [first, second] = await Promise.all([http().post(base()).set(auth("coach")).send(input), http().post(base()).set(auth("coach")).send(input)]);
    expect(first.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    record = first.body;
    expect((await http().post(base()).set(auth("coach")).send({ ...input, title: "Changed" })).status).toBe(409);
    const privateRecord = await http().post(base()).set(auth("coach")).send(draft({ sharedDecision: null, followUpDate: null }));
    privateId = privateRecord.body.id;
    const view = await http().get(shared).set(auth("student"));
    expect(view.status).toBe(200);
    expect(view.body.total).toBe(1);
    expect(view.text).not.toContain("PRIVATE");
    expect(Object.keys(view.body.items[0]).sort()).toEqual(["id", "sharedDecision", "response", "followUpDate", "status", "version", "createdAt", "updatedAt", "respondedAt", "closedAt"].sort());
    expect((await http().put(`${shared}/${privateId}/response`).set(auth("student")).send({ version: 1, response: "ACCEPTED" })).status).toBe(404);
  });
  it("keeps decisions immutable and validates dates", async () => {
    expect((await http().patch(`${base()}/${record.id}`).set(auth("coach")).send({ version: record.version, sharedDecision: "Rewritten" })).status).toBe(400);
    expect((await http().post(base()).set(auth("coach")).send(draft({ followUpDate: "2026-02-30" }))).status).toBe(400);
    expect((await http().post(base()).set(auth("coach")).send(draft({ followUpDate: "2000-01-01" }))).status).toBe(400);
  });
  it("serializes a coach edit against a student response and detects stale versions", async () => {
    const results = await Promise.all([
      http().patch(`${base()}/${record.id}`).set(auth("coach")).send({ version: record.version, followUpDate: null }),
      http().put(`${shared}/${record.id}/response`).set(auth("student")).send({ version: record.version, response: "ACCEPTED" }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    record = results.find((result) => result.status === 200)!.body;
    const reply = await http().put(`${shared}/${record.id}/response`).set(auth("student")).send({ version: record.version, response: "CHANGE_REQUESTED" });
    expect(reply.status).toBe(200);
    const replay = await http().put(`${shared}/${record.id}/response`).set(auth("student")).send({ version: record.version, response: "CHANGE_REQUESTED" });
    expect(replay.body.version).toBe(reply.body.version);
    record = reply.body;
  });
  it("orders and filters before pagination, including change requests without risk signals", async () => {
    await http().post(base()).set(auth("coach")).send(draft({ sharedDecision: null }));
    const page = await http().get("/v1/mentorship/followups?view=ACTIONABLE&pageSize=1").set(auth("coach"));
    expect(page.status).toBe(200);
    expect(page.body.items[0].id).toBe(record.id);
    expect(page.body.total).toBe(2);
    const next = await http().get("/v1/mentorship/followups?view=ACTIONABLE&pageSize=1&page=2").set(auth("coach"));
    expect(next.body.items[0].id).not.toBe(record.id);
    const outsider = await http().get("/v1/mentorship/followups?view=ACTIONABLE").set(auth("other"));
    expect(outsider.body.total).toBe(0);
  });
  it("closes independently of student consent and allows a replacement of only a closed record", async () => {
    expect((await http().post(base()).set(auth("coach")).send(draft({ replacesId: record.id }))).status).toBe(409);
    const close = await http().patch(`${base()}/${record.id}`).set(auth("coach")).send({ version: record.version, status: "COMPLETED" });
    expect(close.status).toBe(200);
    expect((await http().put(`${shared}/${record.id}/response`).set(auth("student")).send({ version: close.body.version, response: "ACCEPTED" })).status).toBe(409);
    const replacement = await http().post(base()).set(auth("coach")).send(draft({ replacesId: record.id }));
    expect(replacement.status).toBe(201);
    expect(replacement.body.replacesId).toBe(record.id);
    expect((await app.get(MentorshipFollowupService).getNotificationTarget(record.id, "responded", record.version))).toBeNull();
  });
  it("rechecks a blocked write after link end, and a re-link never opens the old period", async () => {
    const client = await pool.connect();
    await client.query("begin");
    await client.query("select set_config('app.role','SERVICE',true)");
    await client.query("select id from coach_students where id=$1 for update", [linkId]);
    const pending = http().patch(`${base()}/${privateId}`).set(auth("coach")).send({ version: 1, followUpDate: today() }).then((result) => result);
    await client.query("update coach_students set status='ENDED' where id=$1", [linkId]);
    await client.query("commit");
    client.release();
    expect((await pending).status).toBe(404);
    expect((await http().get(shared).set(auth("student"))).body.total).toBe(0);
    const service = app.get(MentorshipFollowupService);
    expect(await service.getDueCount(ids.coach!, new Date())).toBe(0);
    const renewed = await app.get(MentorshipLinkRepository).acceptInvite(ids.coach!, ids.student!, 20);
    expect(typeof renewed).toBe("object");
    expect((await http().get(shared).set(auth("student"))).body.total).toBe(0);
    expect((await http().patch(`${base()}/${record.id}`).set(auth("coach")).send({ version: record.version, status: "CANCELLED" })).status).toBe(404);
    expect((await http().post(base()).set(auth("coach")).send(draft({ replacesId: record.id }))).status).toBe(404);
  });
  it("the kill switch blocks data and erasure cascades records", async () => {
    await app.get(ConfigRegistryService).set(ids.coach!, "mentorship.followups.enabled", false);
    expect((await http().get("/v1/mentorship/followups/availability").set(auth("coach"))).body.enabled).toBe(false);
    expect((await http().get(shared).set(auth("student"))).status).toBe(403);
    await sql("delete from coach_students where id=$1", [linkId]);
    const remaining = await sql("select count(*)::int as n from mentorship_followups where link_id=$1", [linkId]);
    expect(remaining.rows[0].n).toBe(0);
  });
});
