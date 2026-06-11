import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * W2 coaching e2e — daily loop against real Postgres (RLS active).
 * Covers: plan tasks, streak refresh via /today, cross-user isolation, mood check-in.
 */
describe("coaching (e2e)", () => {
  let app: INestApplication;
  let userAToken = "";
  let userBToken = "";
  let taskId = "";

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    process.env.JWT_ACCESS_SECRET ??= "test-secret-test-secret-test-secret!!";

    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    await app.init();

    const stamp = Date.now();
    const signupA = await request(app.getHttpServer()).post("/v1/auth/signup").send({
      email: `w2a-${stamp}@test.local`,
      password: "Sifre1234",
      displayName: "Coaching A",
      kvkkAccepted: true,
    });
    expect(signupA.status).toBe(201);
    userAToken = signupA.body.accessToken;

    const signupB = await request(app.getHttpServer()).post("/v1/auth/signup").send({
      email: `w2b-${stamp}@test.local`,
      password: "Sifre1234",
      displayName: "Coaching B",
      kvkkAccepted: true,
    });
    expect(signupB.status).toBe(201);
    userBToken = signupB.body.accessToken;
  }, 90_000);

  afterAll(async () => {
    await app?.close();
  });

  const authA = () => ({ Authorization: `Bearer ${userAToken}` });
  const authB = () => ({ Authorization: `Bearer ${userBToken}` });

  it("coaching endpoints require auth", async () => {
    expect((await request(app.getHttpServer()).get("/v1/coaching/today")).status).toBe(401);
    expect((await request(app.getHttpServer()).post("/v1/plan-tasks").send({ title: "x" })).status).toBe(
      401,
    );
  });

  it("signup → create plan task → toggle done → GET /today reflects task + streak", async () => {
    const create = await request(app.getHttpServer())
      .post("/v1/plan-tasks")
      .set(authA())
      .send({ title: "Tarih tekrar", subject: "Tarih" });
    expect(create.status).toBe(201);
    expect(create.body.status).toBe("PENDING");
    taskId = create.body.id;

    const before = await request(app.getHttpServer()).get("/v1/coaching/today").set(authA());
    expect(before.status).toBe(200);
    expect(before.body.tasks.some((t: { id: string }) => t.id === taskId)).toBe(true);
    const streakBefore = before.body.streak.currentStreak;

    const toggle = await request(app.getHttpServer())
      .patch(`/v1/plan-tasks/${taskId}`)
      .set(authA())
      .send({ status: "DONE" });
    expect(toggle.status).toBe(200);
    expect(toggle.body.status).toBe("DONE");

    const after = await request(app.getHttpServer()).get("/v1/coaching/today").set(authA());
    expect(after.status).toBe(200);
    const task = after.body.tasks.find((t: { id: string }) => t.id === taskId);
    expect(task?.status).toBe("DONE");
    expect(after.body.streak.currentStreak).toBeGreaterThanOrEqual(streakBefore);
    expect(typeof after.body.motivationalLine).toBe("string");
    expect(after.body.motivationalLine.length).toBeGreaterThan(0);
  });

  it("user A cannot PATCH user B's plan task (404 — RLS hides foreign rows)", async () => {
    const createB = await request(app.getHttpServer())
      .post("/v1/plan-tasks")
      .set(authB())
      .send({ title: "B-only task" });
    expect(createB.status).toBe(201);

    const crossPatch = await request(app.getHttpServer())
      .patch(`/v1/plan-tasks/${createB.body.id}`)
      .set(authA())
      .send({ status: "DONE" });
    expect([403, 404]).toContain(crossPatch.status);
    expect(crossPatch.body.code).toBeTruthy();
  });

  it("mood check-in upsert returns an encouraging message", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/coaching/mood-checkins")
      .set(authA())
      .send({ mood: 4 });
    expect(res.status).toBe(200);
    expect(res.body.mood).toBe(4);
    expect(typeof res.body.message).toBe("string");
    expect(res.body.message.length).toBeGreaterThan(0);
    expect(res.body.code).toBeTruthy();

    const today = await request(app.getHttpServer()).get("/v1/coaching/today").set(authA());
    expect(today.status).toBe(200);
    expect(today.body.mood?.mood).toBe(4);
    expect(today.body.mood?.message).toBe(res.body.message);
  });

  it("RLS: each user only sees own plan tasks in /today", async () => {
    const todayA = await request(app.getHttpServer()).get("/v1/coaching/today").set(authA());
    const todayB = await request(app.getHttpServer()).get("/v1/coaching/today").set(authB());
    expect(todayA.status).toBe(200);
    expect(todayB.status).toBe(200);

    const idsA = todayA.body.tasks.map((t: { id: string }) => t.id);
    const idsB = todayB.body.tasks.map((t: { id: string }) => t.id);
    expect(idsA).toContain(taskId);
    expect(idsB).not.toContain(taskId);
    expect(idsA.some((id: string) => idsB.includes(id))).toBe(false);
  });

  it("study session start → IN_PROGRESS; complete → COMPLETED counts for streak", async () => {
    const start = await request(app.getHttpServer())
      .post("/v1/study-sessions")
      .set(authA())
      .send({ preset: "25_5" });
    expect(start.status).toBe(201);
    expect(start.body.status).toBe("IN_PROGRESS");
    expect(start.body.endedAt).toBeNull();

    const midToday = await request(app.getHttpServer()).get("/v1/coaching/today").set(authA());
    const streakMid = midToday.body.streak.currentStreak;

    const done = await request(app.getHttpServer())
      .patch(`/v1/study-sessions/${start.body.id}`)
      .set(authA())
      .send({ status: "COMPLETED", actualFocusSeconds: 1500 });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe("COMPLETED");
    expect(done.body.endedAt).toBeTruthy();

    const afterToday = await request(app.getHttpServer()).get("/v1/coaching/today").set(authA());
    expect(afterToday.body.streak.currentStreak).toBeGreaterThanOrEqual(streakMid);
  });
});
