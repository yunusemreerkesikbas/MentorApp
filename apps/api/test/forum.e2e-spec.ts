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
});
