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
const announcementZoneId = randomUUID(), announcementId = randomUUID(), announcementCommentId = randomUUID();
describe("reviewed public QA ads (e2e)", () => {
  let app: INestApplication, pool: Pool;
  let userId = "", editorToken = "", studentToken = "", superAdminToken = "";
  const server = () => app.getHttpServer();
  const adminPath = `/v1/admin/ads/questions/${questionId}`;
  const publicPath = `/v1/forum/public/questions/${questionId}`;
  const announcementAdmin = `/v1/admin/ads/announcements/${announcementId}`;
  const announcementPreview = () => request(server()).get(announcementAdmin).set("Authorization", `Bearer ${editorToken}`);
  const announcementApprove = (contentRevision: string) => request(server()).put(announcementAdmin).set("Authorization", `Bearer ${editorToken}`).send({ contentRevision });
  const announcementPlacement = (contentRevision: string, country = "TR") => request(server())
    .get(`/v1/ads/placements/community.announcement.end?threadId=${announcementId}&contentRevision=${contentRevision}`)
    .set("Authorization", `Bearer ${studentToken}`).set("cf-ipcountry", country);
  const configValues = {
    "forum.enabled": true, "ads.enabled": true, "ads.display.enabled": true,
    "ads.display.allowed_countries": "TR", "ads.placement.forum_question_end.enabled": true,
    "ads.placement.forum_question_end.ad_unit_path": "/123/reviewed-qa",
    "ads.placement.community_question_end.enabled": true,
    "ads.placement.community_question_end.ad_unit_path": "/123/community-qa",
    "ads.placement.community_announcement_end.enabled": true,
    "ads.placement.community_announcement_end.ad_unit_path": "/123/announcement",
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
  it("keeps discovery preparation authenticated, disabled and independent of question approval", async () => {
    const path = "/v1/ads/placements/community.overview";
    const registry = app.get(ConfigRegistryService);
    expect(await registry.get("ads.placement.community_overview.enabled")).toBe(false);
    expect(await registry.get("ads.placement.community_overview.review_approved")).toBe(false);
    expect((await request(server()).get(path)).status).toBe(401);
    expect((await request(server()).get("/v1/ads/public/placements/community.overview")).status).toBe(404);
    const denied = await request(server()).get(`${path}?contentRevision=${"a".repeat(64)}`).set("Authorization", `Bearer ${studentToken}`).set("cf-ipcountry", "TR");
    expect(denied.status).toBe(200);
    expect(denied.body).toMatchObject({ enabled: false, reason: "CONTEXT_UNVERIFIED", adUnitPath: null });
    const invalid = await request(server()).get(`${path}?contentRevision=invalid`).set("Authorization", `Bearer ${studentToken}`);
    expect(invalid.status).toBe(400);
    const hub = await request(server()).get("/v1/forum/hub").set("Authorization", `Bearer ${studentToken}`);
    expect(hub.status).toBe(200); expect(hub.body).not.toHaveProperty("adContext");
  });
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
    const ownerEmail = `ads-readiness-owner-${RUN}@test.local`;
    const owner = await request(server()).post("/v1/auth/signup").send({
      email: ownerEmail, password: "Sifre1234", displayName: "Readiness test", kvkkAccepted: true, termsAccepted: true, ageEligibilityConfirmed: true,
    });
    expect(owner.status).toBe(201);
    await query("update users set roles=array_append(roles,'SUPER_ADMIN') where id=$1", [owner.body.user.id]);
    const ownerLogin = await request(server()).post("/v1/auth/login").send({ email: ownerEmail, password: "Sifre1234" });
    expect(ownerLogin.status).toBe(200);
    superAdminToken = ownerLogin.body.accessToken;
    for (const [key, value] of Object.entries(configValues)) await app.get(ConfigRegistryService).set(userId, key, value);
    await query("insert into forum_zones (id,type,title,slug,exam_type) values ($1,'QA','Review test',$2,'LGS')", [zoneId, `ads-review-${RUN}`]);
    await query("insert into forum_threads (id,zone_id,author_id,title,body) values ($1,$2,$3,'A public question','Question body')", [questionId, zoneId, userId]);
    await query("insert into forum_posts (id,thread_id,author_id,body) values ($1,$2,$3,'An answer')", [answerId, questionId, userId]);
    await query("insert into forum_zones (id,type,title,slug,exam_type) values ($1,'ANNOUNCEMENT','Announcements',$2,'LGS')", [announcementZoneId, `ads-announcement-${RUN}`]);
    await query("insert into forum_threads (id,zone_id,author_id,body) values ($1,$2,$3,'A public announcement')", [announcementId, announcementZoneId, userId]);
    await query("insert into forum_posts (id,thread_id,author_id,body) values ($1,$2,$3,'Visible announcement comment')", [announcementCommentId, announcementId, userId]);
  }, 90_000);

  afterAll(async () => {
    if (pool && userId) {
      await query("delete from ad_question_reviews where question_id=$1", [questionId]);
      await query("delete from ad_question_reviews where question_id=$1", [announcementId]);
      await query("delete from forum_posts where thread_id=$1", [announcementId]);
      await query("delete from forum_threads where id=$1", [announcementId]);
      await query("delete from forum_zones where id=$1", [announcementZoneId]);
      await query("delete from forum_posts where thread_id=$1", [questionId]);
      await query("delete from forum_threads where id=$1", [questionId]);
      await query("delete from forum_zones where id=$1", [zoneId]);
      await query("delete from config_overrides where key=any($1::text[])", [Object.keys(configValues)]);
    }
    await app?.close();
    await pool?.end();
  });

  it("limits the read-only readiness report to SUPER_ADMIN without mutating config", async () => {
    const path = "/v1/admin/ads/readiness";
    expect((await request(server()).get(path)).status).toBe(401);
    for (const token of [studentToken, editorToken]) {
      expect((await request(server()).get(path).set("Authorization", `Bearer ${token}`)).status).toBe(403);
    }
    const before = await query("select key,value from config_overrides order by key");
    const response = await request(server()).get(path).set("Authorization", `Bearer ${superAdminToken}`);
    expect(response.status).toBe(200);
    expect(response.body.externalVerification).toBe("NOT_CHECKED");
    expect(response.body.placements).toHaveLength(8);
    expect(response.body.placements.some((row: { id: string }) => row.id === "dashboard.rewarded.coin")).toBe(false);
    expect(JSON.stringify(response.body)).not.toContain("/123/");
    expect(JSON.stringify(response.body)).not.toContain("adUnitPath");
    const after = await query("select key,value from config_overrides order by key");
    expect(after.rows).toEqual(before.rows);
  });

  it("protects announcement review with roles and validates its own identifiers", async () => {
    expect((await request(server()).get(announcementAdmin)).status).toBe(401);
    expect((await request(server()).put(announcementAdmin).set("Authorization", `Bearer ${studentToken}`).send({ contentRevision: "a".repeat(64) })).status).toBe(403);
    expect((await request(server()).get("/v1/admin/ads/announcements/invalid").set("Authorization", `Bearer ${editorToken}`)).status).toBe(400);
    expect((await request(server()).put(announcementAdmin).set("Authorization", `Bearer ${editorToken}`).send({ contentRevision: "<script>" })).status).toBe(400);
    const wrong = await request(server()).get(`/v1/admin/ads/announcements/${questionId}`).set("Authorization", `Bearer ${editorToken}`);
    expect(wrong.status).toBe(200); expect(wrong.body.snapshot).toBeNull();
  });

  it("requires reviewed announcement content and stores only scoped audit metadata", async () => {
    const preview = await announcementPreview(); expect(preview.status).toBe(200);
    const revision = preview.body.snapshot.contentRevision;
    expect((await announcementPlacement(revision)).body).toMatchObject({ enabled: false, reason: "CONTEXT_UNVERIFIED" });
    const approved = await announcementApprove(revision); expect(approved.status).toBe(200); expect(approved.body.approved).toBe(true);
    expect((await announcementPlacement(revision)).body).toMatchObject({ enabled: true, audienceTreatment: "CHILD" });
    expect((await announcementPlacement(revision, "US")).body.enabled).toBe(false);
    expect((await request(server()).get(`/v1/ads/public/placements/community.announcement.end?threadId=${announcementId}&contentRevision=${revision}`)).status).toBe(404);
    const detail = await request(server()).get(`/v1/forum/threads/${announcementId}/detail`).set("Authorization", `Bearer ${studentToken}`);
    expect(detail.body.adContext.contentRevision).toBe(revision);
    const row = await query("select content_type from ad_question_reviews where question_id=$1", [announcementId]);
    expect(row.rows[0].content_type).toBe("ANNOUNCEMENT");
    const audit = await query("select after from admin_audit_log where target_id=$1 and action='ads.announcement.approve'", [announcementId]);
    expect(audit.rows[0].after.contentRevision).toBe(revision); expect(audit.rows[0].after).not.toHaveProperty("snapshot");
  });

  it("invalidates announcement edits and isolates question revocation", async () => {
    const old = (await announcementPreview()).body.snapshot.contentRevision;
    await query("update forum_posts set body='Changed announcement comment',edited_at=now(),updated_at=now() where id=$1", [announcementCommentId]);
    const current = (await announcementPreview()).body;
    expect(current.snapshot.contentRevision).not.toBe(old); expect(current.approved).toBe(false);
    expect((await announcementPlacement(old)).body.enabled).toBe(false);
    expect((await announcementApprove(old)).status).toBe(409);
    expect((await announcementApprove(current.snapshot.contentRevision)).body.approved).toBe(true);
    await request(server()).delete(`/v1/admin/ads/questions/${announcementId}`).set("Authorization", `Bearer ${editorToken}`);
    expect((await announcementPreview()).body.approved).toBe(true);
    const q = await publicQuestion();
    await query("insert into ad_question_reviews (question_id,content_revision,reviewed_by) values ($1,$2,$3)", [questionId, q.contentRevision, userId]);
    try {
      await request(server()).delete(`/v1/admin/ads/announcements/${questionId}`).set("Authorization", `Bearer ${editorToken}`);
      const retained = await query("select content_revision,content_type from ad_question_reviews where question_id=$1", [questionId]);
      expect(retained.rows[0]).toEqual({ content_revision: q.contentRevision, content_type: "QUESTION" });
    } finally { await query("delete from ad_question_reviews where question_id=$1", [questionId]); }
  });

  it("denies private/chat announcement contexts and permits revoking hidden content", async () => {
    try {
      await query("update forum_zones set type='CHAT',updated_at=now() where id=$1", [announcementZoneId]);
      expect((await announcementPreview()).body.snapshot).toBeNull();
      await query("update forum_zones set type='ANNOUNCEMENT',visibility='PRIVATE',updated_at=now() where id=$1", [announcementZoneId]);
      expect((await announcementPreview()).body.snapshot).toBeNull();
      expect((await request(server()).delete(announcementAdmin).set("Authorization", `Bearer ${editorToken}`)).status).toBe(200);
      expect((await announcementPreview()).body.approval).toBeNull();
    } finally { await query("update forum_zones set type='ANNOUNCEMENT',visibility='PUBLIC',updated_at=now() where id=$1", [announcementZoneId]); }
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

  it("requires a separate audited community approval and revokes it independently", async () => {
    const q = await publicQuestion();
    await approve(q.contentRevision);
    const communityPath = `${adminPath}/community`;
    const preview = () => request(server()).get(communityPath).set("Authorization", `Bearer ${editorToken}`);
    const view = await preview();
    expect(view.status).toBe(200);
    expect(view.body.snapshot?.contentRevision).toMatch(/^[a-f0-9]{64}$/);
    expect(view.body).toMatchObject({ publicApproved: true, approved: false });
    const revision = view.body.snapshot.contentRevision as string;
    const adPath = `/v1/ads/placements/community.question.end?questionId=${questionId}&contentRevision=${revision}`;
    const get = () => request(server()).get(adPath).set({ Authorization: `Bearer ${editorToken}`, "cf-ipcountry": "TR" });
    expect((await get()).body).toMatchObject({ enabled: false, reason: "CONTEXT_UNVERIFIED" });
    expect((await request(server()).get(adPath)).status).toBe(401);
    expect((await request(server()).get(adPath.replace("/placements/", "/public/placements/"))).status).toBe(404);
    expect((await request(server()).put(communityPath).set("Authorization", `Bearer ${studentToken}`).send({ contentRevision: revision })).status).toBe(403);
    expect((await request(server()).put(communityPath).set("Authorization", `Bearer ${editorToken}`).send({ contentRevision: "a".repeat(64) })).status).toBe(409);
    expect((await request(server()).put(communityPath).set("Authorization", `Bearer ${editorToken}`).send({ contentRevision: revision })).status).toBe(200);
    expect((await get()).body).toMatchObject({ enabled: true, audienceTreatment: "CHILD", adUnitPath: "/123/community-qa" });
    const detail = await request(server()).get(`/v1/forum/threads/${questionId}`).set("Authorization", `Bearer ${editorToken}`);
    expect(detail.body.pageContext.adContentRevision).toBe(revision);
    expect(detail.body.pageContext.waitingQuestions).toEqual(expect.any(Array));
    const audit = await query("select after from admin_audit_log where target_id=$1 and action='ads.question.community.approve'", [questionId]);
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].after.contentRevision).toBe(revision);
    expect(audit.rows[0].after).not.toHaveProperty("snapshot");
    await request(server()).delete(communityPath).set("Authorization", `Bearer ${editorToken}`);
    expect((await get()).body.enabled).toBe(false);
    expect(await placement(q.contentRevision)).toMatchObject({ enabled: true });
    await request(server()).put(communityPath).set("Authorization", `Bearer ${editorToken}`).send({ contentRevision: revision });
    await approve(q.contentRevision);
    expect((await get()).body.enabled).toBe(false);
  });

  it("invalidates community approval after display identity changes", async () => {
    const q = await publicQuestion();
    await approve(q.contentRevision);
    const communityPath = `${adminPath}/community`;
    const view = await request(server()).get(communityPath).set("Authorization", `Bearer ${editorToken}`);
    const revision = view.body.snapshot.contentRevision as string;
    await request(server()).put(communityPath).set("Authorization", `Bearer ${editorToken}`).send({ contentRevision: revision });
    await query("update users set display_name='Changed public author' where id=$1", [userId]);
    const next = await request(server()).get(communityPath).set("Authorization", `Bearer ${editorToken}`);
    expect(next.body.snapshot.contentRevision).not.toBe(revision);
    expect(next.body.approved).toBe(false);
    expect(await placement(q.contentRevision)).toMatchObject({ enabled: true });
  });

  it("anonymizes editor attribution through the account-erasure seam", async () => {
    const q = await publicQuestion();
    expect((await approve(q.contentRevision)).status).toBe(200);
    const view = await request(server()).get(`${adminPath}/community`).set("Authorization", `Bearer ${editorToken}`);
    const communityRevision = view.body.snapshot.contentRevision as string;
    await request(server()).put(`${adminPath}/community`).set("Authorization", `Bearer ${editorToken}`).send({ contentRevision: communityRevision });
    const announcementRevision = (await announcementPreview()).body.snapshot.contentRevision;
    expect((await announcementApprove(announcementRevision)).body.approved).toBe(true);
    await app.get(AdsErasureService).eraseUserData(userId);
    const row = await query("select reviewed_by,content_revision from ad_question_reviews where question_id=$1", [questionId]);
    expect(row.rows[0]).toEqual({ reviewed_by: null, content_revision: q.contentRevision });
    const community = await query("select community_reviewed_by,community_content_revision from ad_question_reviews where question_id=$1", [questionId]);
    expect(community.rows[0]).toEqual({ community_reviewed_by: null, community_content_revision: communityRevision });
    const announcement = await query("select reviewed_by,content_revision,content_type from ad_question_reviews where question_id=$1", [announcementId]);
    expect(announcement.rows[0]).toEqual({ reviewed_by: null, content_revision: announcementRevision, content_type: "ANNOUNCEMENT" });
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
