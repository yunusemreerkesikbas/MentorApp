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

  // ---- Slice 2: thread feed + reactions + pin ----

  const createZone = async (type: string, title: string) => {
    const res = await request(app.getHttpServer())
      .post("/v1/forum/zones")
      .set(asAdmin())
      .send({ type, title, joinPolicy: ZoneJoinPolicy.OPEN });
    return res.body.id as string;
  };

  it("ACTIVE member posts in CHAT and the item appears in the feed", async () => {
    const zoneId = await createZone(ZoneType.CHAT, "Sohbet Odası");
    await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(asUser());

    const posted = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({ body: "merhaba arkadaşlar" });
    expect(posted.status).toBe(201);
    expect(posted.body.body).toBe("merhaba arkadaşlar");

    const feed = await request(app.getHttpServer())
      .get(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser());
    expect(feed.status).toBe(200);
    expect(feed.body.items.map((t: { id: string }) => t.id)).toContain(posted.body.id);
  });

  it("a non-member cannot post in a CHAT zone (403)", async () => {
    const zoneId = await createZone(ZoneType.CHAT, "Üyesiz Sohbet");
    const outsider = await signup("outsider");
    const res = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set({ Authorization: `Bearer ${outsider.accessToken}` })
      .send({ body: "ben üye değilim" });
    expect(res.status).toBe(403);
  });

  it("ANNOUNCEMENT: a member cannot post but staff can", async () => {
    const zoneId = await createZone(ZoneType.ANNOUNCEMENT, "Duyurular");
    await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(asUser());

    const byMember = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({ body: "üye duyurusu" });
    expect(byMember.status).toBe(403);

    const byStaff = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asAdmin())
      .send({ body: "resmi duyuru" });
    expect(byStaff.status).toBe(201);
  });

  it("react / unreact toggles the reaction count and myReactions", async () => {
    const zoneId = await createZone(ZoneType.CHAT, "Tepki Odası");
    await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(asUser());
    const posted = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({ body: "tepki ver" });
    const threadId = posted.body.id as string;

    await request(app.getHttpServer())
      .put(`/v1/forum/threads/${threadId}/reactions`)
      .set(asUser())
      .send({ emoji: "👍" })
      .expect(200);

    let feed = await request(app.getHttpServer())
      .get(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser());
    let item = feed.body.items.find((t: { id: string }) => t.id === threadId);
    expect(item.reactionCounts["👍"]).toBe(1);
    expect(item.myReactions).toContain("👍");

    await request(app.getHttpServer())
      .delete(`/v1/forum/threads/${threadId}/reactions`)
      .set(asUser())
      .send({ emoji: "👍" })
      .expect(204);

    feed = await request(app.getHttpServer())
      .get(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser());
    item = feed.body.items.find((t: { id: string }) => t.id === threadId);
    expect(item.reactionCounts["👍"] ?? 0).toBe(0);
    expect(item.myReactions).not.toContain("👍");
  });

  it("staff pin floats a thread to the top of the feed", async () => {
    const zoneId = await createZone(ZoneType.CHAT, "Pin Odası");
    await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(asUser());
    const first = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({ body: "ilk mesaj" });
    await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({ body: "ikinci mesaj" });

    await request(app.getHttpServer())
      .post(`/v1/forum/threads/${first.body.id}/pin`)
      .set(asAdmin())
      .send({ pinned: true })
      .expect(201);

    const feed = await request(app.getHttpServer())
      .get(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser());
    expect(feed.body.items[0].id).toBe(first.body.id);
    expect(feed.body.items[0].isPinned).toBe(true);
  });

  it("a pinned thread is not duplicated onto cursor pages", async () => {
    const zoneId = await createZone(ZoneType.CHAT, "Sayfalama Odası");
    await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(asUser());
    const oldest = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({ body: "en eski" });
    await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({ body: "orta" });
    await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({ body: "en yeni" });
    await request(app.getHttpServer())
      .post(`/v1/forum/threads/${oldest.body.id}/pin`)
      .set(asAdmin())
      .send({ pinned: true })
      .expect(201);

    // Page 1 (limit 2): pinned-oldest floats to top.
    const page1 = await request(app.getHttpServer())
      .get(`/v1/forum/zones/${zoneId}/threads?limit=2`)
      .set(asUser());
    expect(page1.body.items[0].id).toBe(oldest.body.id);
    expect(page1.body.nextCursor).toBeTruthy();

    // Page 2: the pinned thread must NOT reappear.
    const page2 = await request(app.getHttpServer())
      .get(`/v1/forum/zones/${zoneId}/threads?limit=2&before=${encodeURIComponent(page1.body.nextCursor)}`)
      .set(asUser());
    expect(page2.body.items.map((t: { id: string }) => t.id)).not.toContain(oldest.body.id);
  });

  it("author soft-delete removes the item from the feed", async () => {
    const zoneId = await createZone(ZoneType.CHAT, "Silme Odası");
    await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(asUser());
    const posted = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({ body: "silinecek mesaj" });
    const threadId = posted.body.id as string;

    await request(app.getHttpServer())
      .delete(`/v1/forum/threads/${threadId}`)
      .set(asUser())
      .expect(204);

    const feed = await request(app.getHttpServer())
      .get(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser());
    expect(feed.body.items.map((t: { id: string }) => t.id)).not.toContain(threadId);
  });

  // ---- Slice 3: Q&A (questions, answers, accept→XP, search) ----

  const setConfig = (key: string, value: unknown) =>
    request(app.getHttpServer())
      .patch(`/v1/admin/config/${key}`)
      .set(asAdmin())
      .send({ value });

  it("QA: ask → answer → accept grants XP, re-accept 409, search + delete", async () => {
    await setForumEnabled(true);
    await setConfig("economy.enabled", true);

    const zoneId = await createZone(ZoneType.QA, "KPSS Soru-Cevap");
    await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(asUser());

    // One fresh user serves as both the non-member (before joining) and the answerer (after),
    // keeping the suite under the signup @Throttle(5/min).
    const answerer = await signup("qa-answerer");
    const answererAuth = { Authorization: `Bearer ${answerer.accessToken}` };

    // Ask (member, QA zone requires a title). Distinctive token → searchable.
    const tag = `bursluluk${RUN}`;
    const asked = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({ title: `${tag} memuriyet farkı nedir`, body: "4/A ve 4/B ayrımı" });
    expect(asked.status).toBe(201);
    expect(asked.body.title).toContain(tag);
    const threadId = asked.body.id as string;

    // A non-member cannot answer (the answerer has not joined yet).
    const nonMember = await request(app.getHttpServer())
      .post(`/v1/forum/threads/${threadId}/answers`)
      .set(answererAuth)
      .send({ body: "yetkisiz cevap" });
    expect(nonMember.status).toBe(403);

    // Join, then answer.
    await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(answererAuth);
    const ans = await request(app.getHttpServer())
      .post(`/v1/forum/threads/${threadId}/answers`)
      .set(answererAuth)
      .send({ body: "4/B sözleşmeli, 4/A kadrolu." });
    expect(ans.status).toBe(201);
    const postId = ans.body.id as string;

    // Only the asker may accept — the answerer cannot.
    const wrongAccept = await request(app.getHttpServer())
      .post(`/v1/forum/threads/${threadId}/accept/${postId}`)
      .set(answererAuth);
    expect(wrongAccept.status).toBe(403);

    // Asker accepts → answerer earns XP (granted synchronously via emitAsync).
    const accepted = await request(app.getHttpServer())
      .post(`/v1/forum/threads/${threadId}/accept/${postId}`)
      .set(asUser());
    expect(accepted.status).toBe(201);

    const balance = await request(app.getHttpServer()).get("/v1/economy/balance").set(answererAuth);
    expect(balance.status).toBe(200);
    expect(balance.body.xp).toBeGreaterThanOrEqual(25);

    // One-shot: a second accept is rejected.
    const reAccept = await request(app.getHttpServer())
      .post(`/v1/forum/threads/${threadId}/accept/${postId}`)
      .set(asUser());
    expect(reAccept.status).toBe(409);

    // Question detail reflects the accepted answer + ANSWERED status.
    const detail = await request(app.getHttpServer())
      .get(`/v1/forum/threads/${threadId}`)
      .set(asUser());
    expect(detail.body.question.status).toBe("ANSWERED");
    expect(detail.body.answers.find((a: { id: string }) => a.id === postId).isAccepted).toBe(true);

    // Full-text search finds the question by its distinctive token.
    const found = await request(app.getHttpServer())
      .get(`/v1/forum/search?q=${tag}`)
      .set(asUser());
    expect(found.status).toBe(200);
    expect(found.body.items.map((t: { id: string }) => t.id)).toContain(threadId);

    // A non-matching query does not.
    const empty = await request(app.getHttpServer())
      .get(`/v1/forum/search?q=zzzqxnotthere${RUN}`)
      .set(asUser());
    expect(empty.body.items.map((t: { id: string }) => t.id)).not.toContain(threadId);

    // Author soft-deletes their answer → drops from the question detail's answer list.
    await request(app.getHttpServer())
      .delete(`/v1/forum/answers/${postId}`)
      .set(answererAuth)
      .expect(204);
    const afterDelete = await request(app.getHttpServer())
      .get(`/v1/forum/threads/${threadId}`)
      .set(asUser());
    expect(afterDelete.body.answers.map((a: { id: string }) => a.id)).not.toContain(postId);
  });

  // ---- Slice 5: reports → moderation ----

  it("report → queue → resolve HIDE → restore", async () => {
    const zoneId = await createZone(ZoneType.CHAT, "Moderasyon Odası");
    await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(asUser());
    const posted = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({ body: "şikayet edilecek mesaj" });
    const threadId = posted.body.id as string;

    // A user reports it; a re-report is idempotent.
    await request(app.getHttpServer())
      .post("/v1/forum/reports")
      .set(asUser())
      .send({ targetType: "THREAD", targetId: threadId, reason: "SPAM" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/v1/forum/reports")
      .set(asUser())
      .send({ targetType: "THREAD", targetId: threadId, reason: "SPAM" })
      .expect(201);

    // Platform staff see it in the global queue; the zone queue shows it too.
    const globalQueue = await request(app.getHttpServer())
      .get("/v1/forum/reports?status=OPEN")
      .set(asAdmin());
    expect(globalQueue.status).toBe(200);
    const reportItem = globalQueue.body.items.find(
      (r: { targetId: string }) => r.targetId === threadId,
    );
    expect(reportItem).toBeTruthy();

    const zoneQueue = await request(app.getHttpServer())
      .get(`/v1/forum/zones/${zoneId}/reports?status=OPEN`)
      .set(asAdmin());
    expect(zoneQueue.body.items.map((r: { targetId: string }) => r.targetId)).toContain(threadId);

    // A non-moderator cannot resolve.
    const forbidden = await request(app.getHttpServer())
      .post(`/v1/forum/reports/${reportItem.id}/resolve`)
      .set(asUser())
      .send({ action: "HIDE" });
    expect(forbidden.status).toBe(403);

    // Staff resolves HIDE → the thread drops out of the feed (hidden = soft-deleted).
    await request(app.getHttpServer())
      .post(`/v1/forum/reports/${reportItem.id}/resolve`)
      .set(asAdmin())
      .send({ action: "HIDE" })
      .expect(201);
    const feedAfterHide = await request(app.getHttpServer())
      .get(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser());
    expect(feedAfterHide.body.items.map((t: { id: string }) => t.id)).not.toContain(threadId);

    // The report leaves the OPEN queue (target's reports are closed on resolve).
    const openAfter = await request(app.getHttpServer())
      .get("/v1/forum/reports?status=OPEN")
      .set(asAdmin());
    expect(openAfter.body.items.map((r: { targetId: string }) => r.targetId)).not.toContain(threadId);

    // Restore → the thread is back in the feed.
    await request(app.getHttpServer())
      .post(`/v1/forum/threads/${threadId}/restore`)
      .set(asAdmin())
      .expect(201);
    const feedAfterRestore = await request(app.getHttpServer())
      .get(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser());
    expect(feedAfterRestore.body.items.map((t: { id: string }) => t.id)).toContain(threadId);
  });

  // ---- Slice 6: public (SEO) reads ----

  it("public QA endpoint: indexable question anon-readable; non-indexable → 404", async () => {
    const zoneId = await createZone(ZoneType.QA, "Public SEO QA");
    await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(asUser());
    const asked = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({ title: "Public görünür soru başlığı", body: "gövde" });
    const threadId = asked.body.id as string;

    // No answer yet → not indexable (anonymous, no auth header).
    const before = await request(app.getHttpServer()).get(`/v1/forum/public/questions/${threadId}`);
    expect(before.status).toBe(404);

    await request(app.getHttpServer())
      .post(`/v1/forum/threads/${threadId}/answers`)
      .set(asUser())
      .send({ body: "bir cevap" });

    // Now indexable — readable with NO auth, and exposes no authorId.
    const pub = await request(app.getHttpServer()).get(`/v1/forum/public/questions/${threadId}`);
    expect(pub.status).toBe(200);
    expect(pub.body.title).toBe("Public görünür soru başlığı");
    expect(pub.body.answers.length).toBeGreaterThanOrEqual(1);
    expect(pub.body.authorId).toBeUndefined();

    // A CHAT thread is never indexable.
    const chatZoneId = await createZone(ZoneType.CHAT, "Public SEO Chat");
    await request(app.getHttpServer()).post(`/v1/forum/zones/${chatZoneId}/join`).set(asUser());
    const chat = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${chatZoneId}/threads`)
      .set(asUser())
      .send({ body: "mesaj" });
    const chatRes = await request(app.getHttpServer()).get(
      `/v1/forum/public/questions/${chat.body.id}`,
    );
    expect(chatRes.status).toBe(404);

    // Sitemap list (anon) includes the indexable question.
    const list = await request(app.getHttpServer()).get("/v1/forum/public/questions");
    expect(list.status).toBe(200);
    expect(list.body.map((r: { id: string }) => r.id)).toContain(threadId);
  });
});
