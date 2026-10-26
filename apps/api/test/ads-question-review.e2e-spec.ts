import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ThrottlerStorage } from "@nestjs/throttler";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConfigRegistryService } from "../src/common/config/config-registry.service";
import { AdsErasureService } from "../src/modules/ads/application/ads-erasure.service";
import { createTestApp } from "./app-harness";
import request from "./browser-request";

const RUN = Date.now();
const zoneId = randomUUID(), questionId = randomUUID(), answerId = randomUUID();
describe("reviewed public QA ads (e2e)", () => {
  let app: INestApplication, pool: Pool;
  let userId = "", editorToken = "", studentToken = "";
  const server = () => app.getHttpServer();
  const adminPath = `/v1/admin/ads/questions/${questionId}`;
  const publicPath = `/v1/forum/public/questions/${questionId}`;
  const configValues = {
    "forum.enabled": true, "ads.enabled": true, "ads.display.enabled": true,
    "ads.display.allowed_countries": "TR", "ads.placement.forum_question_end.enabled": true,
    "ads.placement.forum_question_end.ad_unit_path": "/123/reviewed-qa",
  };
  const query = async (sql: string, params: unknown[] = []) => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.role','SERVICE',true)");
      const result = await client.query(sql, params);
      await client.query("commit");
      return result;
    } catch (error) { await client.query("rollback"); throw error; }
    finally { client.release(); }
  };
  const publicQuestion = async () => {
    const res = await request(server()).get(publicPath);
    expect(res.status).toBe(200);
    return res.body as { contentRevision: string };
  };
  const approve = async (contentRevision: string) => request(server()).put(adminPath)
    .set("Authorization", `Bearer ${editorToken}`).send({ contentRevision });
  const placement = async (revision: string, country = "TR", token?: string) => {
    const path = `/v1/ads/${token ? "" : "public/"}placements/forum.question.end?questionId=${questionId}&contentRevision=${revision}&examType=KPSS`;
    const req = request(server()).get(path).set("cf-ipcountry", country);
    if (token) req.set("Authorization", `Bearer ${token}`);
    const response = await req;
    expect(response.status).toBe(200);
    return response.body;
  };

  beforeAll(async () => {
    process.env.ADS_LOCAL_TEST_ENABLED = "false";
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { AppModule } = await import("../src/app.module");
    const ref = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(ThrottlerStorage)
      .useValue({ increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }) }).compile();
    app = createTestApp(ref, { authRateLimits: false });
    await app.init();
    const email = `ads-review-${RUN}@test.local`;
    const signup = await request(server()).post("/v1/auth/signup").send({
      email, password: "Sifre1234", displayName: "QA review test", kvkkAccepted: true, termsAccepted: true, ageEligibilityConfirmed: true,
    });
    expect(signup.status).toBe(201);
    userId = signup.body.user.id;
    const student = await request(server()).post("/v1/auth/signup").send({
      email: `ads-review-student-${RUN}@test.local`, password: "Sifre1234", displayName: "QA student test", kvkkAccepted: true, termsAccepted: true, ageEligibilityConfirmed: true,
    });
    expect(student.status).toBe(201);
    studentToken = student.body.accessToken;
    await query("update users set roles=array_append(roles,'EDITOR'), exam_type='KPSS' where id=$1", [userId]);
    const login = await request(server()).post("/v1/auth/login").send({ email, password: "Sifre1234" });
    expect(login.status).toBe(200);
    editorToken = login.body.accessToken;
    for (const [key, value] of Object.entries(configValues)) await app.get(ConfigRegistryService).set(userId, key, value);
    await query("insert into forum_zones (id,type,title,slug,exam_type) values ($1,'QA','Review test',$2,'LGS')", [zoneId, `ads-review-${RUN}`]);
    await query("insert into forum_threads (id,zone_id,author_id,title,body) values ($1,$2,$3,'A public question','Question body')", [questionId, zoneId, userId]);
    await query("insert into forum_posts (id,thread_id,author_id,body) values ($1,$2,$3,'An answer')", [answerId, questionId, userId]);
  }, 90_000);

  afterAll(async () => {
    if (pool && userId) {
      await query("delete from ad_question_reviews where question_id=$1", [questionId]);
      await query("delete from forum_posts where thread_id=$1", [questionId]);
      await query("delete from forum_threads where id=$1", [questionId]);
      await query("delete from forum_zones where id=$1", [zoneId]);
      await query("delete from config_overrides where key=any($1::text[])", [Object.keys(configValues)]);
    }
    await app?.close();
    await pool?.end();
  });

  it("requires editor authority and validated identifiers/revisions", async () => {
    expect((await request(server()).get(adminPath)).status).toBe(401);
    expect((await request(server()).put(adminPath).set("Authorization", `Bearer ${studentToken}`).send({ contentRevision: "a".repeat(64) })).status).toBe(403);
    expect((await request(server()).put(adminPath).set("Authorization", `Bearer ${editorToken}`).send({ contentRevision: "<script>" })).status).toBe(400);
    expect((await request(server()).get("/v1/admin/ads/questions/invalid").set("Authorization", `Bearer ${editorToken}`)).status).toBe(400);
  });

  it("serves only an approved matching snapshot, with server-owned CHILD treatment", async () => {
    const q = await publicQuestion();
    expect(await placement(q.contentRevision)).toMatchObject({ enabled: false, reason: "CONTEXT_UNVERIFIED", adUnitPath: null });
    expect((await approve("a".repeat(64))).status).toBe(409);
    const approved = await approve(q.contentRevision);
    expect(approved.status).toBe(200);
    expect(approved.body.approved).toBe(true);
    expect(await placement(q.contentRevision)).toMatchObject({ enabled: true, audienceTreatment: "CHILD", adUnitPath: "/123/reviewed-qa" });
    expect(await placement(q.contentRevision, "TR", editorToken)).toMatchObject({ enabled: true, audienceTreatment: "CHILD" });
    expect(await placement(q.contentRevision, "US")).toMatchObject({ enabled: false });
    expect(await placement("b".repeat(64))).toMatchObject({ enabled: false, reason: "CONTEXT_UNVERIFIED" });
    const audit = await query("select after from admin_audit_log where target_id=$1 and action='ads.question.approve'", [questionId]);
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].after.contentRevision).toBe(q.contentRevision);
    expect(audit.rows[0].after).not.toHaveProperty("body");
  });

  it("invalidates after answer edits and rejects stale preview approval", async () => {
    const old = await publicQuestion();
    await query("update forum_posts set body='An edited answer',updated_at=now() where id=$1", [answerId]);
    const current = await publicQuestion();
    expect(current.contentRevision).not.toBe(old.contentRevision);
    expect(await placement(old.contentRevision)).toMatchObject({ enabled: false });
    expect(await placement(current.contentRevision)).toMatchObject({ enabled: false });
    expect((await approve(old.contentRevision)).status).toBe(409);
    expect((await approve(current.contentRevision)).status).toBe(200);
    expect(await placement(current.contentRevision)).toMatchObject({ enabled: true });
    await query("update forum_posts set body='An answer',updated_at=now() where id=$1", [answerId]);
    expect(await placement(old.contentRevision)).toMatchObject({ enabled: false });
  });

  it("supports audited revoke and dynamic slot configuration", async () => {
    const q = await publicQuestion();
    await approve(q.contentRevision);
    const registry = app.get(ConfigRegistryService);
    await registry.set(userId, "ads.placement.forum_question_end.enabled", false);
    expect(await placement(q.contentRevision)).toMatchObject({ enabled: false, reason: "PLACEMENT_DISABLED" });
    await registry.set(userId, "ads.placement.forum_question_end.enabled", true);
    await registry.set(userId, "ads.placement.forum_question_end.ad_unit_path", "");
    expect(await placement(q.contentRevision)).toMatchObject({ enabled: false, reason: "PROVIDER_NOT_CONFIGURED" });
    await expect(registry.set(userId, "ads.placement.forum_question_end.ad_unit_path", "<script>alert(1)</script>")).rejects.toBeDefined();
    await registry.set(userId, "ads.placement.forum_question_end.ad_unit_path", "/123/reviewed-qa");
    expect((await request(server()).delete(adminPath).set("Authorization", `Bearer ${editorToken}`)).status).toBe(200);
    expect(await placement(q.contentRevision)).toMatchObject({ enabled: false, reason: "CONTEXT_UNVERIFIED" });
    const audit = await query("select action from admin_audit_log where target_id=$1 and action='ads.question.revoke'", [questionId]);
    expect(audit.rows).toHaveLength(1);
  });

  it("anonymizes editor attribution through the account-erasure seam", async () => {
    const q = await publicQuestion();
    expect((await approve(q.contentRevision)).status).toBe(200);
    await app.get(AdsErasureService).eraseUserData(userId);
    const row = await query("select reviewed_by,content_revision from ad_question_reviews where question_id=$1", [questionId]);
    expect(row.rows[0]).toEqual({ reviewed_by: null, content_revision: q.contentRevision });
    expect(await placement(q.contentRevision)).toMatchObject({ enabled: true });
  });

  it("never approves hidden/private/unanswered questions or unknown exam context", async () => {
    const q = await publicQuestion();
    for (const [sql, restore] of [
      ["update forum_zones set visibility='PRIVATE' where id=$1", "update forum_zones set visibility='PUBLIC' where id=$1"],
      ["update forum_zones set is_archived=true where id=$1", "update forum_zones set is_archived=false where id=$1"],
      ["update forum_zones set exam_type=null where id=$1", "update forum_zones set exam_type='LGS' where id=$1"],
    ]) {
      await query(sql, [zoneId]);
      expect((await approve(q.contentRevision)).status).toBe(404);
      expect(await placement(q.contentRevision)).toMatchObject({ enabled: false });
      await query(restore, [zoneId]);
    }
    await query("update forum_posts set deleted_at=now(), updated_at=now() where id=$1", [answerId]);
    expect((await approve(q.contentRevision)).status).toBe(404);
    expect((await request(server()).get(publicPath)).status).toBe(404);
  });
});
