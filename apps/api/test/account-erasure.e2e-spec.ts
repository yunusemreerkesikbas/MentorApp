import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ThrottlerStorage } from "@nestjs/throttler";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";

const RUN = Date.now();
const REDACTED = "[silinmiş içerik]";

/**
 * KVKK erasure e2e (WP-K): DELETE /v1/account must leave NO personal data behind in ANY module —
 * free-text forum content is redacted in place (conversation integrity), everything else keyed by
 * the user is deleted, and only the legally-retained payment/ledger records survive. Written
 * test-first: each table group is its own `it` so a red run lists the missing erasures precisely.
 */
describe("account erasure (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let tokenA = "";
  let idA = ""; // the erased user
  let idB = ""; // the neighbour whose data must survive
  let chatThreadA = ""; // A's CHAT thread (redacted)
  let questionA = ""; // A's QA question (redacted)
  let answerAonB = ""; // A's accepted answer on B's question (redacted, stays accepted)
  let answerBonA = ""; // B's answer on A's question (untouched)

  const signup = async (label: string, username: string) => {
    const res = await request(app.getHttpServer()).post("/v1/auth/signup").send({
      email: `erasure-${label}-${RUN}@test.local`,
      password: "Sifre1234",
      displayName: `Erasure ${label}`,
      username,
      kvkkAccepted: true,
    });
    expect(res.status).toBe(201);
    return res.body as { accessToken: string; user: { id: string } };
  };

  const svc = async <T>(fn: (c: import("pg").PoolClient) => Promise<T>): Promise<T> => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('app.role','SERVICE',true)");
      const out = await fn(c);
      await c.query("commit");
      return out;
    } finally {
      c.release();
    }
  };

  const countRows = (table: string, where: string, params: unknown[]) =>
    svc(async (c) => {
      const res = await c.query(`select count(*)::int as n from ${table} where ${where}`, params);
      return res.rows[0].n as number;
    });

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }),
      })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    await app.init();

    // --- Actors ------------------------------------------------------------
    const a = await signup("a", `eru${RUN.toString(36)}a`);
    const b = await signup("b", `eru${RUN.toString(36)}b`);
    tokenA = a.accessToken;
    idA = a.user.id;
    idB = b.user.id;
    const asA = { Authorization: `Bearer ${tokenA}` };
    const asB = { Authorization: `Bearer ${b.accessToken}` };

    // Admin flips forum.enabled (config cache invalidates via the PATCH path).
    const admin = await signup("admin", `eru${RUN.toString(36)}c`);
    await svc(async (c) => {
      await c.query("update users set roles = array_append(roles,$1) where id=$2", [
        UserRole.SUPER_ADMIN,
        admin.user.id,
      ]);
    });
    const adminLogin = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: `erasure-admin-${RUN}@test.local`, password: "Sifre1234" });
    await request(app.getHttpServer())
      .patch("/v1/admin/config/forum.enabled")
      .set({ Authorization: `Bearer ${adminLogin.body.accessToken}` })
      .send({ value: true })
      .expect(200);

    // --- Coaching traces (regression: existing erasure must keep working) ---
    const today = new Date().toISOString().slice(0, 10);
    await request(app.getHttpServer())
      .post("/v1/plan-tasks")
      .set(asA)
      .send({ title: "Erasure görevi", taskDate: today, description: "gizli plan notu" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/v1/coaching/mood-checkins")
      .set(asA)
      .send({ mood: 4 })
      .expect(200);

    for (const [auth, label] of [
      [asA, "A"],
      [asB, "B"],
    ] as const) {
      await request(app.getHttpServer()).get("/v1/coaching/notebooks").set(auth).expect(200);
      const notebook = await request(app.getHttpServer())
        .post("/v1/coaching/notebooks")
        .set(auth)
        .send({
          title: `Erasure notebook ${label}`,
          examId: null,
          subjectRef: null,
          cover: { color: "navy", material: "cloth" },
        });
      expect(notebook.status).toBe(201);
      await request(app.getHttpServer())
        .put(`/v1/coaching/notebooks/${notebook.body.id}/pages/0`)
        .set(auth)
        .send({ doc: { version: 1, paper: "ruled", items: [], ink: [] } })
        .expect(200);
    }

    // --- AI trace (SQL seed — the chat API is premium/coin-gated) -----------
    await svc(async (c) => {
      const conv = await c.query(
        "insert into coach_conversations (user_id, title) values ($1,'erasure') returning id",
        [idA],
      );
      await c.query(
        "insert into coach_messages (user_id, conversation_id, role, content) values ($1,$2,'USER','çok gizli itiraf')",
        [idA, conv.rows[0].id],
      );
    });

    // --- Forum traces -------------------------------------------------------
    // The boot seed guarantees these two zones exist (WP-J); fetch by slug — the paginated
    // list may not surface them among zones accumulated from other e2e runs.
    const chatRes = await request(app.getHttpServer()).get("/v1/forum/zones/genel-sohbet").set(asA);
    const qaRes = await request(app.getHttpServer()).get("/v1/forum/zones/soru-cevap").set(asA);
    expect(chatRes.status).toBe(200);
    expect(qaRes.status).toBe(200);
    const chatZone = chatRes.body;
    const qaZone = qaRes.body;

    for (const auth of [asA, asB]) {
      await request(app.getHttpServer()).post(`/v1/forum/zones/${chatZone.id}/join`).set(auth).expect(201);
      await request(app.getHttpServer()).post(`/v1/forum/zones/${qaZone.id}/join`).set(auth).expect(201);
    }

    // A: CHAT thread.
    const chat = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${chatZone.id}/threads`)
      .set(asA)
      .send({ body: "kişisel bir mesaj" });
    expect(chat.status).toBe(201);
    chatThreadA = chat.body.id;

    // A asks a question; B answers it (B's answer must survive untouched).
    const qA = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${qaZone.id}/threads`)
      .set(asA)
      .send({ title: `A sorusu ${RUN}`, body: "kişisel soru metni" });
    expect(qA.status).toBe(201);
    questionA = qA.body.id;
    const bAns = await request(app.getHttpServer())
      .post(`/v1/forum/threads/${questionA}/answers`)
      .set(asB)
      .send({ body: "B'nin cevabı" });
    expect(bAns.status).toBe(201);
    answerBonA = bAns.body.id;

    // B asks; A answers; B accepts A's answer (accepted flag must survive redaction).
    const qB = await request(app.getHttpServer())
      .post(`/v1/forum/zones/${qaZone.id}/threads`)
      .set(asB)
      .send({ title: `B sorusu ${RUN}`, body: "B'nin sorusu" });
    expect(qB.status).toBe(201);
    const aAns = await request(app.getHttpServer())
      .post(`/v1/forum/threads/${qB.body.id}/answers`)
      .set(asA)
      .send({ body: "A'nın kişisel cevabı" });
    expect(aAns.status).toBe(201);
    answerAonB = aAns.body.id;
    await request(app.getHttpServer())
      .post(`/v1/forum/threads/${qB.body.id}/accept/${answerAonB}`)
      .set(asB)
      .expect(201);

    // A: reaction + bookmark + report.
    await request(app.getHttpServer())
      .put(`/v1/forum/threads/${questionA}/reactions`)
      .set(asA)
      .send({ emoji: "❤️" })
      .expect(200);
    await request(app.getHttpServer())
      .put(`/v1/forum/threads/${chatThreadA}/bookmark`)
      .set(asA)
      .expect(200);
    await request(app.getHttpServer())
      .post("/v1/forum/reports")
      .set(asA)
      .send({ targetType: "THREAD", targetId: answerBonA ? questionA : questionA, reason: "SPAM" })
      .expect(201);

    // A: attachment ledger row (upload flow is heavy — SQL seed keeps focus on erasure).
    await svc(async (c) => {
      await c.query(
        `insert into forum_attachments (target_type, target_id, author_id, kind, storage_key, mime_type, size_bytes, position)
         values ('THREAD', $1, $2, 'image', 'forum/erasure-${RUN}.png', 'image/png', 123, 0)`,
        [chatThreadA, idA],
      );
    });

    // --- Social traces ------------------------------------------------------
    await request(app.getHttpServer())
      .put(`/v1/users/eru${RUN.toString(36)}b/follow`)
      .set(asA)
      .expect(200);
    await request(app.getHttpServer())
      .put(`/v1/users/eru${RUN.toString(36)}a/follow`)
      .set(asB)
      .expect(200);
    await svc(async (c) => {
      await c.query(
        "insert into buddy_pairs (requester_id, addressee_id, status) values ($1,$2,'ACTIVE')",
        [idA, idB],
      );
    });

    // --- Notification traces (SQL seed) -------------------------------------
    await svc(async (c) => {
      await c.query(
        "insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1,$2,'k','a')",
        [idA, `https://push.test/erasure-${RUN}`],
      );
      await c.query(
        "insert into notification_preferences (user_id, email_enabled, push_enabled) values ($1,true,true) on conflict (user_id) do nothing",
        [idA],
      );
      await c.query(
        "insert into notification_deliveries (user_id, channel, template, dedupe_key) values ($1,'EMAIL','erasure',$2)",
        [idA, `erasure-${RUN}`],
      );
      await c.query(
        "insert into user_notifications (user_id, category, title, body) values ($1,'SYSTEM','t','b')",
        [idA],
      );
    });

    // --- Economy trace (must be RETAINED — legal/append-only) ---------------
    await svc(async (c) => {
      await c.query(
        "insert into ledger_entries (user_id, unit, amount, reason, status) values ($1,'XP',5,'quest.daily.plan-task-done','CONFIRMED')",
        [idA],
      );
    });

    // --- The erasure itself -------------------------------------------------
    await request(app.getHttpServer()).delete("/v1/account").set(asA).expect(204);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  it("identity: user row is anonymized with status DELETED", async () => {
    const row = await svc(async (c) => {
      const res = await c.query("select email, display_name, status from users where id=$1", [idA]);
      return res.rows[0];
    });
    expect(row.status).toBe("DELETED");
    expect(row.email).not.toContain("erasure-a");
  });

  it("coaching: free text is scrubbed, analytic rows survive (regression)", async () => {
    // Coaching keeps the numbers (analytic value) and scrubs everything the user typed.
    const task = await svc(async (c) => {
      const res = await c.query("select title, description from plan_tasks where user_id=$1", [idA]);
      return res.rows[0];
    });
    expect(task.title).toBe("Silinmiş görev");
    expect(task.description).toBeNull();
    const mood = await svc(async (c) => {
      const res = await c.query(
        "select struggle_note, ai_reflection from mood_checkins where user_id=$1",
        [idA],
      );
      return res.rows[0];
    });
    expect(mood.struggle_note).toBeNull();
    expect(mood.ai_reflection).toBeNull();
  });

  it("coaching: owned notebooks and their pages are erased by cascade", async () => {
    expect(await countRows("notebooks", "user_id=$1", [idA])).toBe(0);
    expect(await countRows("notebook_pages", "user_id=$1", [idA])).toBe(0);
    expect(await countRows("notebooks", "user_id=$1", [idB])).toBeGreaterThan(0);
    expect(await countRows("notebook_pages", "user_id=$1", [idB])).toBeGreaterThan(0);
  });

  it("ai: coach conversations and messages are gone (regression)", async () => {
    expect(await countRows("coach_messages", "user_id=$1", [idA])).toBe(0);
    expect(await countRows("coach_conversations", "user_id=$1", [idA])).toBe(0);
  });

  it("forum: A's threads and posts remain but are redacted in place", async () => {
    const thread = await svc(async (c) => {
      const res = await c.query("select title, body from forum_threads where id=$1", [chatThreadA]);
      return res.rows[0];
    });
    expect(thread.body).toBe(REDACTED);

    const question = await svc(async (c) => {
      const res = await c.query("select title, body from forum_threads where id=$1", [questionA]);
      return res.rows[0];
    });
    expect(question.title).toBe(REDACTED);
    expect(question.body).toBe(REDACTED);

    const answer = await svc(async (c) => {
      const res = await c.query("select body, is_accepted from forum_posts where id=$1", [answerAonB]);
      return res.rows[0];
    });
    expect(answer.body).toBe(REDACTED);
    expect(answer.is_accepted).toBe(true); // conversation integrity: accept survives redaction
  });

  it("forum: B's answer on A's question is untouched", async () => {
    const row = await svc(async (c) => {
      const res = await c.query("select body from forum_posts where id=$1", [answerBonA]);
      return res.rows[0];
    });
    expect(row.body).toBe("B'nin cevabı");
  });

  it("forum: reactions, bookmarks, memberships, reports, attachments are gone", async () => {
    expect(await countRows("forum_reactions", "user_id=$1", [idA])).toBe(0);
    expect(await countRows("forum_bookmarks", "user_id=$1", [idA])).toBe(0);
    expect(await countRows("forum_zone_members", "user_id=$1", [idA])).toBe(0);
    expect(await countRows("forum_reports", "reporter_id=$1", [idA])).toBe(0);
    expect(await countRows("forum_attachments", "author_id=$1", [idA])).toBe(0);
  });

  it("social: follows (both directions) and buddy pairs are gone", async () => {
    expect(await countRows("user_follows", "follower_id=$1 or followee_id=$1", [idA])).toBe(0);
    expect(await countRows("buddy_pairs", "requester_id=$1 or addressee_id=$1", [idA])).toBe(0);
  });

  it("notifications: subscriptions, preferences, deliveries, inbox are gone", async () => {
    expect(await countRows("push_subscriptions", "user_id=$1", [idA])).toBe(0);
    expect(await countRows("notification_preferences", "user_id=$1", [idA])).toBe(0);
    expect(await countRows("notification_deliveries", "user_id=$1", [idA])).toBe(0);
    expect(await countRows("user_notifications", "user_id=$1", [idA])).toBe(0);
  });

  it("economy/payments: ledger rows are RETAINED (append-only, legal)", async () => {
    expect(await countRows("ledger_entries", "user_id=$1", [idA])).toBeGreaterThan(0);
  });

  it("a second DELETE is not a server error (idempotent orchestration)", async () => {
    const res = await request(app.getHttpServer())
      .delete("/v1/account")
      .set({ Authorization: `Bearer ${tokenA}` });
    expect(res.status).toBeLessThan(500);
  });
});
