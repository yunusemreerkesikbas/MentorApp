import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ThrottlerStorage } from "@nestjs/throttler";
import cookieParser from "cookie-parser";
import express from "express";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FORUM_LIKE_EMOJI, UserRole, ZoneJoinPolicy, ZoneMemberStatus, ZoneType } from "@mentor/types";

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
  let userId = "";

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

  /** Poll the in-app inbox for a FORUM notification with the given link (events emit fire-and-forget). */
  const pollForumNotif = async (auth: Record<string, string>, link: string): Promise<boolean> => {
    for (let i = 0; i < 40; i++) {
      const res = await request(app.getHttpServer()).get(`/v1/notifications`).set(auth);
      if (
        res.body.items?.some(
          (n: { category: string; linkUrl: string }) => n.category === "FORUM" && n.linkUrl === link,
        )
      ) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    const { AppModule } = await import("../src/app.module");
    // Disable rate limiting for e2e via a no-op throttler store — no test asserts 429, and per-IP
    // throttling made the suite fragile (a new test could push an unrelated later test over the limit).
    // Overriding the store (not the APP_GUARD) leaves the auth/roles guards intact.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }),
      })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    // Mirror main.ts: raw body for the fake-upload endpoint (needed by the attachments tests).
    app.use(
      "/v1/storage/fake-upload",
      express.raw({
        type: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ],
        limit: 10 * 1024 * 1024,
      }),
    );
    await app.init();

    const admin = await signup("admin");
    const user = await signup("user");
    userToken = user.accessToken;
    userId = user.user.id;

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

  it("reject ({approve:false}) deletes a pending request; kick removes an active member; self-DELETE stays 403", async () => {
    const created = await request(app.getHttpServer())
      .post("/v1/forum/zones")
      .set(asAdmin())
      .send({ type: ZoneType.CHAT, title: "Ret-Çıkarma Odası", joinPolicy: ZoneJoinPolicy.REQUEST });
    const zoneId = created.body.id as string;

    // Reject: PENDING request → {approve:false} → membership row gone.
    const rejectee = await signup("rejectee");
    await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/join`)
      .set({ Authorization: `Bearer ${rejectee.accessToken}` });
    await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/members/${rejectee.user.id}/approve`)
      .set(asAdmin())
      .send({ approve: false })
      .expect(201);
    const pendingAfter = await request(app.getHttpServer())
      .get(`/v1/forum/zones/${zoneId}/members?status=${ZoneMemberStatus.PENDING}`)
      .set(asAdmin());
    expect(pendingAfter.body.map((m: { userId: string }) => m.userId)).not.toContain(rejectee.user.id);

    // Kick: ACTIVE member removed by staff via DELETE.
    const kickee = await signup("kickee");
    await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/join`)
      .set({ Authorization: `Bearer ${kickee.accessToken}` });
    await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/members/${kickee.user.id}/approve`)
      .set(asAdmin())
      .send({ approve: true });
    // Self-DELETE by a plain member is moderation-only → 403 (leave is the self-scoped path).
    await request(app.getHttpServer())
      .delete(`/v1/forum/zones/${zoneId}/members/${kickee.user.id}`)
      .set({ Authorization: `Bearer ${kickee.accessToken}` })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/v1/forum/zones/${zoneId}/members/${kickee.user.id}`)
      .set(asAdmin())
      .expect(204);
    const activeAfter = await request(app.getHttpServer())
      .get(`/v1/forum/zones/${zoneId}/members?status=${ZoneMemberStatus.ACTIVE}`)
      .set(asAdmin());
    expect(activeAfter.body.map((m: { userId: string }) => m.userId)).not.toContain(kickee.user.id);
  });

  it("voluntary leave: ACTIVE member leaves (idempotent), PENDING withdraws, owner gets 409", async () => {
    // OPEN zone: member joins → leaves → myStatus resets → re-leave is a 204 no-op.
    const open = await request(app.getHttpServer())
      .post("/v1/forum/zones")
      .set(asAdmin())
      .send({ type: ZoneType.CHAT, title: "Ayrılma Odası", joinPolicy: ZoneJoinPolicy.OPEN });
    const openId = open.body.id as string;
    const leaver = await signup("leaver");
    const asLeaver = { Authorization: `Bearer ${leaver.accessToken}` };
    await request(app.getHttpServer()).post(`/v1/forum/zones/${openId}/join`).set(asLeaver);
    await request(app.getHttpServer()).post(`/v1/forum/zones/${openId}/leave`).set(asLeaver).expect(204);
    const zone = await request(app.getHttpServer()).get(`/v1/forum/zones/${openId}`).set(asLeaver);
    expect(zone.body.myStatus ?? null).toBeNull();
    await request(app.getHttpServer()).post(`/v1/forum/zones/${openId}/leave`).set(asLeaver).expect(204);

    // REQUEST zone: pending requester withdraws their own request.
    const req = await request(app.getHttpServer())
      .post("/v1/forum/zones")
      .set(asAdmin())
      .send({ type: ZoneType.CHAT, title: "Geri Çekme Odası", joinPolicy: ZoneJoinPolicy.REQUEST });
    const reqId = req.body.id as string;
    await request(app.getHttpServer()).post(`/v1/forum/zones/${reqId}/join`).set(asLeaver);
    await request(app.getHttpServer()).post(`/v1/forum/zones/${reqId}/leave`).set(asLeaver).expect(204);
    const pending = await request(app.getHttpServer())
      .get(`/v1/forum/zones/${reqId}/members?status=${ZoneMemberStatus.PENDING}`)
      .set(asAdmin());
    expect(pending.body.map((m: { userId: string }) => m.userId)).not.toContain(leaver.user.id);

    // OWNER cannot leave (zone must not go ownerless).
    const owner = await signup("zone-owner");
    await request(app.getHttpServer())
      .post(`/v1/forum/zones/${openId}/owner`)
      .set(asAdmin())
      .send({ userId: owner.user.id });
    await request(app.getHttpServer())
      .post(`/v1/forum/zones/${openId}/leave`)
      .set({ Authorization: `Bearer ${owner.accessToken}` })
      .expect(409);
  });

  it("member search (@mention autocomplete): ACTIVE member finds prefix matches; non-member is 403 (APP-021)", async () => {
    const created = await request(app.getHttpServer())
      .post("/v1/forum/zones")
      .set(asAdmin())
      .send({ type: ZoneType.CHAT, title: "Mention Odası", joinPolicy: ZoneJoinPolicy.OPEN });
    const zoneId = created.body.id as string;

    const alice = await signup("mention-a");
    const bob = await signup("mention-b");
    // Usernames are set via the users table (signup has no username field); handle-charset only.
    await svc(async (c) => {
      await c.query("update users set username=$1 where id=$2", [`mentiona${RUN}`, alice.user.id]);
      await c.query("update users set username=$1 where id=$2", [`mentionb${RUN}`, bob.user.id]);
    });
    for (const tok of [alice.accessToken, bob.accessToken]) {
      await request(app.getHttpServer())
        .post(`/v1/forum/zones/${zoneId}/join`)
        .set({ Authorization: `Bearer ${tok}` });
    }

    const found = await request(app.getHttpServer())
      .get(`/v1/forum/zones/${zoneId}/members/search?q=mention`)
      .set({ Authorization: `Bearer ${alice.accessToken}` });
    expect(found.status).toBe(200);
    const usernames = found.body.map((s: { username: string }) => s.username);
    expect(usernames).toContain(`mentiona${RUN}`);
    expect(usernames).toContain(`mentionb${RUN}`);
    expect(found.body[0]).toHaveProperty("displayName");
    expect(found.body[0]).toHaveProperty("avatarUrl");

    // The regular test user never joined this zone → forbidden.
    const outsider = await request(app.getHttpServer())
      .get(`/v1/forum/zones/${zoneId}/members/search?q=mention`)
      .set(asUser());
    expect(outsider.status).toBe(403);
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

    // The zone list carries a per-zone thread count (APP-026 loose-end).
    const zones = await request(app.getHttpServer()).get("/v1/forum/zones").set(asUser());
    const listed = zones.body.items.find((z: { id: string }) => z.id === zoneId);
    expect(listed.threadCount).toBeGreaterThanOrEqual(1);
  });

  it("attachments: upload → post with image → feed returns it; rejects a foreign key + >4 (APP-018)", async () => {
    await setForumEnabled(true);
    const zoneId = await createZone(ZoneType.CHAT, "Ekli Sohbet");
    await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(asUser());

    // 1) presigned upload URL (fake storage in test)
    const urlRes = await request(app.getHttpServer())
      .post("/v1/forum/attachments/upload-url")
      .set(asUser())
      .send({ contentType: "image/png" });
    expect(urlRes.status).toBe(201);
    const { uploadUrl, key } = urlRes.body as { uploadUrl: string; key: string };
    expect(key).toMatch(/^forum-attachments\//);

    // 2) PUT a real 1x1 PNG to the fake-upload endpoint
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    await request(app.getHttpServer())
      .put(uploadUrl)
      .set("Content-Type", "image/png")
      .send(png)
      .expect(200);

    // 3) create a thread carrying the attachment
    const posted = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({ body: "resimli mesaj", attachments: [{ key, mimeType: "image/png", width: 1, height: 1 }] });
    expect(posted.status).toBe(201);
    expect(posted.body.attachments).toHaveLength(1);
    expect(posted.body.attachments[0].url).toContain("/v1/storage/fake-object");
    expect(posted.body.attachments[0].width).toBe(1);

    // …and the feed returns it too
    const feed = await request(app.getHttpServer())
      .get(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser());
    const item = feed.body.items.find((t: { id: string }) => t.id === posted.body.id);
    expect(item.attachments).toHaveLength(1);

    // 4) a key under another user's prefix is rejected (ownership belt)
    const foreign = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({
        body: "yabancı ek",
        attachments: [
          { key: "forum-attachments/00000000-0000-0000-0000-000000000000/x.png", mimeType: "image/png" },
        ],
      });
    expect(foreign.status).toBe(400);

    // 5) more than 4 attachments → zod rejects (400)
    const tooMany = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({
        body: "çok fazla",
        attachments: Array.from({ length: 5 }, () => ({ key, mimeType: "image/png" })),
      });
    expect(tooMany.status).toBe(400);
  });

  it("file attachments: upload → post with PDF → detail returns kind=file + fileName; rejects a bad type (APP-027)", async () => {
    await setForumEnabled(true);
    const zoneId = await createZone(ZoneType.CHAT, "Dosyalı Sohbet");
    await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(asUser());

    // A disallowed content type is rejected at the upload-url boundary.
    const bad = await request(app.getHttpServer())
      .post("/v1/forum/attachments/upload-url")
      .set(asUser())
      .send({ contentType: "application/x-msdownload" });
    expect(bad.status).toBe(400);

    // Presigned upload for a PDF → key carries the .pdf extension.
    const urlRes = await request(app.getHttpServer())
      .post("/v1/forum/attachments/upload-url")
      .set(asUser())
      .send({ contentType: "application/pdf" });
    expect(urlRes.status).toBe(201);
    const { uploadUrl, key } = urlRes.body as { uploadUrl: string; key: string };
    expect(key).toMatch(/\.pdf$/);

    const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF", "utf8");
    await request(app.getHttpServer())
      .put(uploadUrl)
      .set("Content-Type", "application/pdf")
      .send(pdf)
      .expect(200);

    const posted = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({
        body: "notlarım ekte",
        attachments: [{ key, mimeType: "application/pdf", fileName: "kpss-notlari.pdf" }],
      });
    expect(posted.status).toBe(201);
    expect(posted.body.attachments).toHaveLength(1);
    const att = posted.body.attachments[0];
    expect(att.kind).toBe("file");
    expect(att.fileName).toBe("kpss-notlari.pdf");
    expect(att.sizeBytes).toBeGreaterThan(0);

    // A mime outside the allowlist on create is rejected (spoof belt).
    const spoof = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({ body: "sahte", attachments: [{ key, mimeType: "application/zip", fileName: "x.zip" }] });
    expect(spoof.status).toBe(400);
  });

  it("QA attachments: question + answer carry images; question detail returns both (Phase 2)", async () => {
    await setForumEnabled(true);
    const zoneId = await createZone(ZoneType.QA, "Ekli Soru-Cevap");
    await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(asUser());

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    // Upload one image and return its key (fake storage in test).
    const uploadImage = async (): Promise<string> => {
      const urlRes = await request(app.getHttpServer())
        .post("/v1/forum/attachments/upload-url")
        .set(asUser())
        .send({ contentType: "image/png" });
      expect(urlRes.status).toBe(201);
      const { uploadUrl, key } = urlRes.body as { uploadUrl: string; key: string };
      await request(app.getHttpServer())
        .put(uploadUrl)
        .set("Content-Type", "image/png")
        .send(png)
        .expect(200);
      return key;
    };

    // Ask a question carrying an image (QA questions now accept attachments).
    const qKey = await uploadImage();
    const asked = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({
        title: "Görselli soru başlığı",
        body: "aşağıdaki ekran görüntüsü",
        attachments: [{ key: qKey, mimeType: "image/png", width: 1, height: 1 }],
      });
    expect(asked.status).toBe(201);
    expect(asked.body.attachments).toHaveLength(1);
    const threadId = asked.body.id as string;

    // Answer carrying an image too.
    const aKey = await uploadImage();
    const answered = await request(app.getHttpServer())
      .post(`/v1/forum/threads/${threadId}/answers`)
      .set(asUser())
      .send({ body: "çözümüm ekte", attachments: [{ key: aKey, mimeType: "image/png", width: 1, height: 1 }] });
    expect(answered.status).toBe(201);
    expect(answered.body.attachments).toHaveLength(1);

    // Question detail returns attachments on both the question and the answer.
    const detail = await request(app.getHttpServer())
      .get(`/v1/forum/threads/${threadId}`)
      .set(asUser());
    expect(detail.status).toBe(200);
    expect(detail.body.question.attachments).toHaveLength(1);
    expect(detail.body.question.attachments[0].url).toContain("/v1/storage/fake-object");
    expect(detail.body.answers[0].attachments).toHaveLength(1);
  });

  it("bookmarks: save a thread + a post → saved feed returns both; unsave drops it (APP-018)", async () => {
    await setForumEnabled(true);
    const zoneId = await createZone(ZoneType.QA, "Kayıt Soru-Cevap");
    await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(asUser());

    // A question (thread) + an answer (post) by the same member.
    const asked = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({ title: "Kaydedilecek soru", body: "gövde" });
    const threadId = asked.body.id as string;
    const answered = await request(app.getHttpServer())
      .post(`/v1/forum/threads/${threadId}/answers`)
      .set(asUser())
      .send({ body: "kaydedilecek cevap" });
    const postId = answered.body.id as string;

    // Bookmark both (post after thread → newest-saved first = post, then thread).
    await request(app.getHttpServer()).put(`/v1/forum/threads/${threadId}/bookmark`).set(asUser()).expect(200);
    await request(app.getHttpServer()).put(`/v1/forum/posts/${postId}/bookmark`).set(asUser()).expect(200);

    const saved = await request(app.getHttpServer()).get(`/v1/forum/bookmarks`).set(asUser());
    expect(saved.status).toBe(200);
    expect(saved.body.items).toHaveLength(2);
    expect(saved.body.items[0]).toMatchObject({ type: "comment" }); // newest-saved first
    expect(saved.body.items[0].comment.id).toBe(postId);
    expect(saved.body.items[0].comment.myBookmarked).toBe(true);
    expect(saved.body.items[1]).toMatchObject({ type: "thread" });
    expect(saved.body.items[1].thread.id).toBe(threadId);

    // The question detail reflects myBookmarked on both the question and the answer.
    const detail = await request(app.getHttpServer()).get(`/v1/forum/threads/${threadId}`).set(asUser());
    expect(detail.body.question.myBookmarked).toBe(true);
    expect(detail.body.answers[0].myBookmarked).toBe(true);

    // Unsave the thread → the saved feed drops to just the post.
    await request(app.getHttpServer()).delete(`/v1/forum/threads/${threadId}/bookmark`).set(asUser()).expect(204);
    const after = await request(app.getHttpServer()).get(`/v1/forum/bookmarks`).set(asUser());
    expect(after.body.items).toHaveLength(1);
    expect(after.body.items[0].comment.id).toBe(postId);
  });

  it("notifications: a join request notifies the zone owner (in-app, APP-018)", async () => {
    await setForumEnabled(true);
    // admin (staff) creates a REQUEST zone and makes `user` its owner.
    const zoneRes = await request(app.getHttpServer())
      .post("/v1/forum/zones")
      .set(asAdmin())
      .send({ type: ZoneType.CHAT, title: "Bildirim Owner Zonu", joinPolicy: ZoneJoinPolicy.REQUEST });
    const zoneId = zoneRes.body.id as string;
    const slug = zoneRes.body.slug as string;
    await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/owner`)
      .set(asAdmin())
      .send({ userId })
      .expect(201);

    // A different user (admin) requests to join → the owner (user) is notified.
    await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(asAdmin());
    expect(await pollForumNotif(asUser(), `/community/${slug}/management`)).toBe(true);
  });

  it("notifications: commenting on a thread notifies its author (in-app, APP-018)", async () => {
    await setForumEnabled(true);
    const zoneId = await createZone(ZoneType.CHAT, "Bildirim Yorum Zonu");
    await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(asUser());
    const posted = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({ body: "gönderim" });
    const threadId = posted.body.id as string;

    // A different user (admin) comments → the thread author (user) is notified.
    await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(asAdmin());
    await request(app.getHttpServer())
      .post(`/v1/forum/threads/${threadId}/comments`)
      .set(asAdmin())
      .send({ body: "güzel gönderi" });

    expect(await pollForumNotif(asUser(), `/community/message/${threadId}`)).toBe(true);
  });

  it("notifications: an @mention notifies the mentioned user (in-app, APP-018)", async () => {
    await setForumEnabled(true);
    const handle = `mnt${RUN}`;
    // The mentioned user (`user`) sets a username so they can be @mentioned.
    await request(app.getHttpServer())
      .patch("/v1/users/me")
      .set(asUser())
      .send({ username: handle })
      .expect(200);

    const zoneId = await createZone(ZoneType.CHAT, "Bildirim Mention Zonu");
    // admin (staff) posts a thread mentioning @handle → the mentioned user is notified.
    const posted = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asAdmin())
      .send({ body: `selam @${handle} nasılsın` });
    const threadId = posted.body.id as string;

    expect(await pollForumNotif(asUser(), `/community/message/${threadId}`)).toBe(true);
  });

  it("profile: activity feed + public header (no email); unknown username → 404 (APP-018)", async () => {
    await setForumEnabled(true);
    const handle = `prof${RUN}`;
    await request(app.getHttpServer())
      .patch("/v1/users/me")
      .set(asUser())
      .send({ username: handle, bio: "KPSS yolculuğu", website: "https://ornek.dev" })
      .expect(200);
    const zoneId = await createZone(ZoneType.CHAT, "Profil Zonu");
    await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(asUser());
    const posted = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({ body: "profil gönderisi" });
    const threadId = posted.body.id as string;
    await request(app.getHttpServer())
      .post(`/v1/forum/threads/${threadId}/comments`)
      .set(asUser())
      .send({ body: "profil yorumu" });

    // Forum activity feed — the user's thread + comment interleaved.
    const activity = await request(app.getHttpServer())
      .get(`/v1/forum/users/${handle}/activity`)
      .set(asUser());
    expect(activity.status).toBe(200);
    const types = (activity.body.items as { type: string }[]).map((i) => i.type);
    expect(types).toContain("thread");
    expect(types).toContain("comment");
    // Each item carries its zone (for the "posted in X" label).
    expect(activity.body.items[0].zone.title).toBe("Profil Zonu");

    // Community profile header — identity + stats, and crucially NO email (PII).
    const profile = await request(app.getHttpServer())
      .get(`/v1/community/profile/${handle}`)
      .set(asUser());
    expect(profile.status).toBe(200);
    expect(profile.body.username).toBe(handle);
    expect(profile.body.email).toBeUndefined();
    expect(profile.body).toHaveProperty("streak");
    // Public bio + website surface (APP-024); still no PII.
    expect(profile.body.bio).toBe("KPSS yolculuğu");
    expect(profile.body.website).toBe("https://ornek.dev");

    const missing = await request(app.getHttpServer())
      .get(`/v1/community/profile/nobody${RUN}`)
      .set(asUser());
    expect(missing.status).toBe(404);
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

  it("emoji palette: multi-emoji reactions on threads + comments; disallowed emoji rejected", async () => {
    const zoneId = await createZone(ZoneType.CHAT, "Tepki Odası");
    await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(asUser());
    const posted = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({ body: "tepki ver" });
    const threadId = posted.body.id as string;

    // React with two distinct palette emojis (multiple reactions per user).
    for (const emoji of [FORUM_LIKE_EMOJI, "💪"]) {
      await request(app.getHttpServer())
        .put(`/v1/forum/threads/${threadId}/reactions`)
        .set(asUser())
        .send({ emoji })
        .expect(200);
    }
    // A disallowed emoji is rejected (allowlist).
    await request(app.getHttpServer())
      .put(`/v1/forum/threads/${threadId}/reactions`)
      .set(asUser())
      .send({ emoji: "🤢" })
      .expect(400);

    let feed = await request(app.getHttpServer())
      .get(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser());
    let item = feed.body.items.find((t: { id: string }) => t.id === threadId);
    expect(item.reactionCounts[FORUM_LIKE_EMOJI]).toBe(1);
    expect(item.reactionCounts["💪"]).toBe(1);
    expect(item.myReactions).toEqual(expect.arrayContaining([FORUM_LIKE_EMOJI, "💪"]));

    // Unreact one → the other stays.
    await request(app.getHttpServer())
      .delete(`/v1/forum/threads/${threadId}/reactions`)
      .set(asUser())
      .send({ emoji: FORUM_LIKE_EMOJI })
      .expect(204);
    feed = await request(app.getHttpServer())
      .get(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser());
    item = feed.body.items.find((t: { id: string }) => t.id === threadId);
    expect(item.reactionCounts[FORUM_LIKE_EMOJI] ?? 0).toBe(0);
    expect(item.reactionCounts["💪"]).toBe(1);

    // Comments carry the same palette (reactionCounts / myReactions).
    const comment = await request(app.getHttpServer())
      .post(`/v1/forum/threads/${threadId}/comments`)
      .set(asUser())
      .send({ body: "yorum" });
    const postId = comment.body.id as string;
    await request(app.getHttpServer())
      .put(`/v1/forum/posts/${postId}/reactions`)
      .set(asUser())
      .send({ emoji: "🙏" })
      .expect(200);
    const detail = await request(app.getHttpServer())
      .get(`/v1/forum/threads/${threadId}/detail`)
      .set(asUser());
    const commentView = detail.body.comments.find((c: { id: string }) => c.id === postId);
    expect(commentView.reactionCounts["🙏"]).toBe(1);
    expect(commentView.myReactions).toContain("🙏");
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

  // ---- Follow graph + "Akış" feed (APP-022) ----

  it("follow → profile counts/isFollowing, following-feed scoping, notification, unfollow, self-follow", async () => {
    await setForumEnabled(true);
    // A (the default user) + B + C, all with handles (needed for followability + the notif link).
    const aHandle = `fola${RUN}`;
    const bHandle = `folb${RUN}`;
    await request(app.getHttpServer())
      .patch("/v1/users/me")
      .set(asUser())
      .send({ username: aHandle })
      .expect(200);
    const b = await signup("followee");
    const asB = () => ({ Authorization: `Bearer ${b.accessToken}` });
    await request(app.getHttpServer())
      .patch("/v1/users/me")
      .set(asB())
      .send({ username: bHandle })
      .expect(200);
    const c = await signup("nonfollowee");
    const asC = () => ({ Authorization: `Bearer ${c.accessToken}` });

    // A CHAT zone all three join; B and C each post a thread.
    const zoneId = await createZone(ZoneType.CHAT, "Takip Zonu");
    for (const auth of [asUser(), asB(), asC()]) {
      await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(auth);
    }
    const bThread = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asB())
      .send({ body: "B'nin gönderisi" });
    const cThread = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asC())
      .send({ body: "C'nin gönderisi" });
    const bThreadId = bThread.body.id as string;
    const cThreadId = cThread.body.id as string;

    // A follows B.
    await request(app.getHttpServer()).put(`/v1/users/${bHandle}/follow`).set(asUser()).expect(200);

    // B's profile (viewed by A) reflects the follow.
    const profile = await request(app.getHttpServer())
      .get(`/v1/community/profile/${bHandle}`)
      .set(asUser());
    expect(profile.status).toBe(200);
    expect(profile.body.isFollowing).toBe(true);
    expect(profile.body.followerCount).toBe(1);

    // A's following feed shows B's thread but NOT C's (A doesn't follow C).
    const feed = await request(app.getHttpServer()).get("/v1/forum/feed/following").set(asUser());
    expect(feed.status).toBe(200);
    const feedIds = (feed.body.items as { id: string }[]).map((t) => t.id);
    expect(feedIds).toContain(bThreadId);
    expect(feedIds).not.toContain(cThreadId);

    // B is notified that A followed them (link → A's profile).
    expect(await pollForumNotif(asB(), `/community/member/${aHandle}`)).toBe(true);

    // Self-follow is rejected.
    await request(app.getHttpServer()).put(`/v1/users/${aHandle}/follow`).set(asUser()).expect(400);

    // Unfollow → profile flips + B's thread leaves the feed.
    await request(app.getHttpServer()).delete(`/v1/users/${bHandle}/follow`).set(asUser()).expect(204);
    const after = await request(app.getHttpServer())
      .get(`/v1/community/profile/${bHandle}`)
      .set(asUser());
    expect(after.body.isFollowing).toBe(false);
    expect(after.body.followerCount).toBe(0);
    const feed2 = await request(app.getHttpServer()).get("/v1/forum/feed/following").set(asUser());
    expect((feed2.body.items as { id: string }[]).map((t) => t.id)).not.toContain(bThreadId);
  });

  it("follow-suggestions: active zone authors, excluding self + already-followed (APP-023)", async () => {
    await setForumEnabled(true);
    const sHandle = `sug${RUN}`;
    const bHandle = `sugb${RUN}`;
    const cHandle = `sugc${RUN}`;
    const s = await signup("sugviewer");
    const asS = () => ({ Authorization: `Bearer ${s.accessToken}` });
    const b = await signup("sugb");
    const asB = () => ({ Authorization: `Bearer ${b.accessToken}` });
    const c = await signup("sugc");
    const asC = () => ({ Authorization: `Bearer ${c.accessToken}` });
    for (const [auth, handle] of [
      [asS(), sHandle],
      [asB(), bHandle],
      [asC(), cHandle],
    ] as const) {
      await request(app.getHttpServer()).patch("/v1/users/me").set(auth).send({ username: handle }).expect(200);
    }

    const zoneId = await createZone(ZoneType.CHAT, "Öneri Zonu");
    for (const auth of [asS(), asB(), asC()]) {
      await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(auth);
    }
    await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/threads`).set(asB()).send({ body: "B önerisi" });
    await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/threads`).set(asC()).send({ body: "C önerisi" });

    // S follows no one → suggestions surface the zone's authors (B, C), never S itself; all not-followed.
    const sug1 = await request(app.getHttpServer()).get("/v1/forum/follow-suggestions").set(asS());
    expect(sug1.status).toBe(200);
    const handles1 = (sug1.body as { username: string }[]).map((u) => u.username);
    expect(handles1).toContain(bHandle);
    expect(handles1).toContain(cHandle);
    expect(handles1).not.toContain(sHandle);
    expect((sug1.body as { isFollowing: boolean }[]).every((u) => u.isFollowing === false)).toBe(true);

    // After following B, B drops out of the suggestions; C stays.
    await request(app.getHttpServer()).put(`/v1/users/${bHandle}/follow`).set(asS()).expect(200);
    const sug2 = await request(app.getHttpServer()).get("/v1/forum/follow-suggestions").set(asS());
    const handles2 = (sug2.body as { username: string }[]).map((u) => u.username);
    expect(handles2).not.toContain(bHandle);
    expect(handles2).toContain(cHandle);
  });

  const createDiscoveryTag = async (label: string, isActive = true) => {
    const slug = `${label}-${RUN}`;
    const response = await request(app.getHttpServer())
      .post("/v1/admin/forum/tags")
      .set(asAdmin())
      .send({
        slug,
        nameTr: `${label} ${RUN}`,
        nameEn: `${label} ${RUN}`,
        isActive,
      })
      .expect(201);
    return { id: response.body.id as string, slug };
  };

  const activityAt = async (threadId: string): Promise<Date> => {
    const result = await pool.query(
      "select last_activity_at from forum_threads where id = $1",
      [threadId],
    );
    return new Date(result.rows[0].last_activity_at as string);
  };

  const expectActivityAdvance = async (
    threadId: string,
    action: () => Promise<unknown>,
  ): Promise<void> => {
    await pool.query(
      "update forum_threads set last_activity_at = '2000-01-01T00:00:00.000Z' where id = $1",
      [threadId],
    );
    const before = await activityAt(threadId);
    await action();
    const after = await activityAt(threadId);
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  };

  it("Discovery V2 cold-start hub returns useful content for a new student", async () => {
    await setForumEnabled(true);
    const newcomer = await signup("discovery-cold-start");
    const response = await request(app.getHttpServer())
      .get("/v1/forum/hub")
      .set({ Authorization: `Bearer ${newcomer.accessToken}` })
      .expect(200);

    expect(
      response.body.featured ||
        response.body.continueDiscussions.length > 0 ||
        response.body.recommendedZones.length > 0,
    ).toBeTruthy();
  });

  it("Discovery V2 hub keeps recent interactions first and fills the remaining slots without duplicates", async () => {
    await setForumEnabled(true);
    const viewer = await signup("discovery-continue-viewer");
    const author = await signup("discovery-continue-author");
    const asViewer = { Authorization: `Bearer ${viewer.accessToken}` };
    const asAuthor = { Authorization: `Bearer ${author.accessToken}` };
    const zoneId = await createZone(ZoneType.CHAT, "Discovery Devam Akışı");
    for (const auth of [asViewer, asAuthor]) {
      await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(auth).expect(201);
    }
    const threadIds: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      const created = await request(app.getHttpServer())
        .post(`/v1/forum/zones/${zoneId}/threads`)
        .set(asAuthor)
        .send({ body: `Devam akışı tartışması ${index + 1}` })
        .expect(201);
      threadIds.push(created.body.id as string);
    }
    await request(app.getHttpServer())
      .post(`/v1/forum/threads/${threadIds[0]}/comments`)
      .set(asViewer)
      .send({ body: "Bu tartışmaya daha sonra devam edeceğim." })
      .expect(201);

    const hub = await request(app.getHttpServer()).get("/v1/forum/hub").set(asViewer).expect(200);
    const ids = (hub.body.continueDiscussions as Array<{ id: string }>).map((item) => item.id);
    expect(ids[0]).toBe(threadIds[0]);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("Discovery V2 feed covers all sorts, filters and duplicate-free opaque cursors", async () => {
    await setForumEnabled(true);
    const tag = await createDiscoveryTag("discovery-feed");
    const zoneId = await createZone(ZoneType.QA, "Discovery Feed QA");
    await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(asUser()).expect(201);
    const threadIds: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      const created = await request(app.getHttpServer())
        .post(`/v1/forum/zones/${zoneId}/threads`)
        .set(asUser())
        .send({
          title: `Discovery sıralama sorusu ${index + 1}`,
          body: `Sıralama, filtre ve cursor kabul içeriği ${index + 1}.`,
          tagIds: [tag.id],
        })
        .expect(201);
      threadIds.push(created.body.id as string);
    }

    for (const sort of ["trending", "recent", "top"] as const) {
      const response = await request(app.getHttpServer())
        .get(`/v1/forum/feed?scope=relevant&sort=${sort}&tag=${tag.slug}&zoneType=QA`)
        .set(asUser())
        .expect(200);
      expect(response.body.items).toHaveLength(4);
      expect(
        response.body.items.every(
          (item: { zone: { type: string }; tags: Array<{ slug: string }> }) =>
            item.zone.type === ZoneType.QA && item.tags.some((itemTag) => itemTag.slug === tag.slug),
        ),
      ).toBe(true);
    }

    const firstPage = await request(app.getHttpServer())
      .get(`/v1/forum/feed?scope=relevant&sort=recent&tag=${tag.slug}&limit=2`)
      .set(asUser())
      .expect(200);
    expect(firstPage.body.nextCursor).toEqual(expect.any(String));
    const secondPage = await request(app.getHttpServer())
      .get(
        `/v1/forum/feed?scope=relevant&sort=recent&tag=${tag.slug}&limit=2&cursor=${encodeURIComponent(firstPage.body.nextCursor)}`,
      )
      .set(asUser())
      .expect(200);
    const firstIds = firstPage.body.items.map((item: { id: string }) => item.id);
    const secondIds = secondPage.body.items.map((item: { id: string }) => item.id);
    expect(firstIds.filter((id: string) => secondIds.includes(id))).toEqual([]);
    expect(new Set([...firstIds, ...secondIds])).toEqual(new Set(threadIds));
  });

  it("Discovery V2 rejects inactive tags", async () => {
    await setForumEnabled(true);
    const tag = await createDiscoveryTag("discovery-inactive", false);
    const zoneId = await createZone(ZoneType.QA, "Discovery Pasif Etiket");
    await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(asUser()).expect(201);

    await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({
        title: "Pasif etiket kullanılabilir mi?",
        body: "Bu gönderinin pasif etiket nedeniyle reddedilmesi gerekir.",
        tagIds: [tag.id],
      })
      .expect(400);
  });

  it("Discovery V2 helpful voting is self-safe and idempotent, then locks editing", async () => {
    await setForumEnabled(true);
    const helper = await signup("discovery-helpful");
    const asHelper = { Authorization: `Bearer ${helper.accessToken}` };
    const zoneId = await createZone(ZoneType.QA, "Discovery Helpful QA");
    for (const auth of [asUser(), asHelper]) {
      await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(auth).expect(201);
    }
    const question = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({ title: "Faydalı oy güvenli mi?", body: "Tekrarlı ve öz oy davranışını doğruluyoruz." })
      .expect(201);
    const threadId = question.body.id as string;

    await request(app.getHttpServer())
      .patch(`/v1/forum/threads/${threadId}`)
      .set(asUser())
      .send({ body: "Etkileşimden önce düzenleme çalışır." })
      .expect(200);
    await request(app.getHttpServer())
      .put(`/v1/forum/threads/${threadId}/helpful-vote`)
      .set(asUser())
      .expect(400);
    await request(app.getHttpServer())
      .put(`/v1/forum/threads/${threadId}/helpful-vote`)
      .set(asHelper)
      .expect(200);
    await request(app.getHttpServer())
      .put(`/v1/forum/threads/${threadId}/helpful-vote`)
      .set(asHelper)
      .expect(200);
    const count = await pool.query(
      "select count(*)::int as n from forum_helpful_votes where target_type = 'THREAD' and target_id = $1 and user_id = $2",
      [threadId, helper.user.id],
    );
    expect(count.rows[0].n).toBe(1);
    await request(app.getHttpServer())
      .patch(`/v1/forum/threads/${threadId}`)
      .set(asUser())
      .send({ body: "Etkileşimden sonra düzenleme kilitlenir." })
      .expect(409);

    const expired = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({ title: "Süresi dolan düzenleme", body: "Bu kayıt doğrudan eski tarihe alınacak." })
      .expect(201);
    await pool.query(
      "update forum_threads set created_at = now() - interval '31 minutes' where id = $1",
      [expired.body.id],
    );
    await request(app.getHttpServer())
      .patch(`/v1/forum/threads/${expired.body.id}`)
      .set(asUser())
      .send({ body: "Süre dolduktan sonra değişmemeli." })
      .expect(409);
  });

  it("Discovery V2 advances last_activity_at after comments, reactions, helpful votes and acceptance", async () => {
    await setForumEnabled(true);
    const helper = await signup("discovery-activity");
    const asHelper = { Authorization: `Bearer ${helper.accessToken}` };
    const chatZoneId = await createZone(ZoneType.CHAT, "Discovery Aktivite Sohbet");
    const qaZoneId = await createZone(ZoneType.QA, "Discovery Aktivite QA");
    for (const zoneId of [chatZoneId, qaZoneId]) {
      for (const auth of [asUser(), asHelper]) {
        await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(auth).expect(201);
      }
    }

    const commentThread = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${chatZoneId}/threads`)
      .set(asUser())
      .send({ body: "Yorum aktivitesi" })
      .expect(201);
    await expectActivityAdvance(commentThread.body.id, () =>
      request(app.getHttpServer())
        .post(`/v1/forum/threads/${commentThread.body.id}/comments`)
        .set(asHelper)
        .send({ body: "Son aktiviteyi ilerleten yorum." })
        .expect(201),
    );

    const reactionThread = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${chatZoneId}/threads`)
      .set(asUser())
      .send({ body: "Reaksiyon aktivitesi" })
      .expect(201);
    await expectActivityAdvance(reactionThread.body.id, () =>
      request(app.getHttpServer())
        .put(`/v1/forum/threads/${reactionThread.body.id}/reactions`)
        .set(asHelper)
        .send({ emoji: FORUM_LIKE_EMOJI })
        .expect(200),
    );

    const helpfulThread = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${qaZoneId}/threads`)
      .set(asUser())
      .send({ title: "Helpful aktivitesi", body: "Faydalı oy son aktiviteyi ilerletmeli." })
      .expect(201);
    await expectActivityAdvance(helpfulThread.body.id, () =>
      request(app.getHttpServer())
        .put(`/v1/forum/threads/${helpfulThread.body.id}/helpful-vote`)
        .set(asHelper)
        .expect(200),
    );

    const acceptedThread = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${qaZoneId}/threads`)
      .set(asUser())
      .send({ title: "Kabul aktivitesi", body: "Kabul durumu son aktiviteyi ilerletmeli." })
      .expect(201);
    const answer = await request(app.getHttpServer())
      .post(`/v1/forum/threads/${acceptedThread.body.id}/answers`)
      .set(asHelper)
      .send({ body: "Kabul edilecek cevap." })
      .expect(201);
    await expectActivityAdvance(acceptedThread.body.id, () =>
      request(app.getHttpServer())
        .post(`/v1/forum/threads/${acceptedThread.body.id}/accept/${answer.body.id}`)
        .set(asUser())
        .expect(201),
    );
  });

  it("Discovery V2 restricts curation to staff and returns the selected thread summary", async () => {
    await setForumEnabled(true);
    const zoneId = await createZone(ZoneType.QA, "Discovery Featured QA");
    await request(app.getHttpServer()).post(`/v1/forum/zones/${zoneId}/join`).set(asUser()).expect(201);
    const question = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${zoneId}/threads`)
      .set(asUser())
      .send({ title: "Öne çıkarılacak tartışma", body: "Admin yanıtı güvenli özeti taşımalı." })
      .expect(201);

    await request(app.getHttpServer())
      .post("/v1/admin/forum/tags")
      .set(asUser())
      .send({ slug: `yetkisiz-${RUN}`, nameTr: "Yetkisiz", nameEn: "Unauthorized" })
      .expect(403);
    await request(app.getHttpServer())
      .put("/v1/admin/forum/featured-thread")
      .set(asUser())
      .send({ threadId: question.body.id })
      .expect(403);

    const featured = await request(app.getHttpServer())
      .put("/v1/admin/forum/featured-thread")
      .set(asAdmin())
      .send({ threadId: question.body.id })
      .expect(200);
    expect(featured.body).toEqual(
      expect.objectContaining({
        threadId: question.body.id,
        thread: expect.objectContaining({
          id: question.body.id,
          title: "Öne çıkarılacak tartışma",
          zoneType: ZoneType.QA,
        }),
      }),
    );
    const current = await request(app.getHttpServer())
      .get("/v1/admin/forum/featured-thread")
      .set(asAdmin())
      .expect(200);
    expect(current.body.thread.id).toBe(question.body.id);
    await request(app.getHttpServer())
      .delete("/v1/admin/forum/featured-thread")
      .set(asAdmin())
      .expect(204);
  });

  it("Discovery V2 search returns public identity fields without PII", async () => {
    await setForumEnabled(true);
    const searcher = await signup("discovery-searcher");
    const ownerHandle = `dvo${String(RUN).slice(-10)}`;
    await request(app.getHttpServer())
      .patch("/v1/users/me")
      .set(asUser())
      .send({ username: ownerHandle })
      .expect(200);

    const search = await request(app.getHttpServer())
      .get(`/v1/forum/search?q=${encodeURIComponent(ownerHandle)}`)
      .set({ Authorization: `Bearer ${searcher.accessToken}` })
      .expect(200);
    expect(JSON.stringify(search.body)).not.toMatch(/@test\.local|email/i);
    const person = search.body.people.find(
      (item: { username: string | null }) => item.username === ownerHandle,
    );
    expect(person).toBeTruthy();
    expect(Object.keys(person).sort()).toEqual(["avatarUrl", "displayName", "id", "username"]);
  });
});
