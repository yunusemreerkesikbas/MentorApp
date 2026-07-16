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

  it("bulk create adds all tasks; a single past date rejects the whole batch (403)", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const ok = await request(app.getHttpServer())
      .post("/v1/plan-tasks/bulk")
      .set(authA())
      .send({
        tasks: [
          { title: "Bulk 1", subject: "Matematik", taskDate: today },
          { title: "Bulk 2", subject: "Türkçe", taskDate: today },
        ],
      });
    expect(ok.status).toBe(201);
    expect(ok.body).toHaveLength(2);

    const list = await request(app.getHttpServer())
      .get(`/v1/plan-tasks?date=${today}`)
      .set(authA());
    const titles = list.body.items.map((t: { title: string }) => t.title);
    expect(titles).toEqual(expect.arrayContaining(["Bulk 1", "Bulk 2"]));

    const rejected = await request(app.getHttpServer())
      .post("/v1/plan-tasks/bulk")
      .set(authA())
      .send({
        tasks: [
          { title: "Geçerli", taskDate: today },
          { title: "Geçmiş", taskDate: "2020-01-01" },
        ],
      });
    expect(rejected.status).toBe(403); // COACHING_TASK_DATE_READONLY — same as single create
    const after = await request(app.getHttpServer())
      .get(`/v1/plan-tasks?date=${today}`)
      .set(authA());
    expect(
      after.body.items.some((t: { title: string }) => t.title === "Geçerli"),
    ).toBe(false); // all-or-nothing
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

  it("lists plan tasks by inclusive from/to range", async () => {
    const today = new Date();
    const addDays = (base: Date, days: number) => {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    };
    const day1 = addDays(today, 1);
    const day3 = addDays(today, 3);
    const dayOut = addDays(today, 10);
    const rangeTo = addDays(today, 7);

    const create1 = await request(app.getHttpServer())
      .post("/v1/plan-tasks")
      .set(authA())
      .send({ title: "Range day 1", taskDate: day1 });
    expect(create1.status).toBe(201);

    const create2 = await request(app.getHttpServer())
      .post("/v1/plan-tasks")
      .set(authA())
      .send({ title: "Range day 3", taskDate: day3 });
    expect(create2.status).toBe(201);

    const createOut = await request(app.getHttpServer())
      .post("/v1/plan-tasks")
      .set(authA())
      .send({ title: "Out of range", taskDate: dayOut });
    expect(createOut.status).toBe(201);

    const range = await request(app.getHttpServer())
      .get(
        `/v1/plan-tasks?from=${encodeURIComponent(day1)}&to=${encodeURIComponent(rangeTo)}&page=1&pageSize=50`,
      )
      .set(authA());
    expect(range.status).toBe(200);
    const titles = range.body.items.map((t: { title: string }) => t.title);
    expect(titles).toContain("Range day 1");
    expect(titles).toContain("Range day 3");
    expect(titles).not.toContain("Out of range");
    expect(
      range.body.items.every(
        (t: { taskDate: string }) => t.taskDate >= day1 && t.taskDate <= rangeTo,
      ),
    ).toBe(true);
    const ordered = range.body.items
      .filter((t: { title: string }) => t.title.startsWith("Range day"))
      .map((t: { taskDate: string }) => t.taskDate);
    expect(ordered).toEqual([day1, day3]);

    const invalid = await request(app.getHttpServer())
      .get(
        `/v1/plan-tasks?date=${encodeURIComponent(day1)}&from=${encodeURIComponent(day1)}&to=${encodeURIComponent(rangeTo)}`,
      )
      .set(authA());
    expect(invalid.status).toBe(400);
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
    expect(start.body.plannedFocusMinutes).toBeNull();

    const midToday = await request(app.getHttpServer()).get("/v1/coaching/today").set(authA());
    const streakMid = midToday.body.streak.currentStreak;

    const done = await request(app.getHttpServer())
      .patch(`/v1/study-sessions/${start.body.id}`)
      .set(authA())
      .send({ status: "COMPLETED", actualFocusSeconds: 1500 });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe("COMPLETED");
    expect(done.body.endedAt).toBeTruthy();
    expect(done.body.countsAsFocusSession).toBe(true);

    const afterToday = await request(app.getHttpServer()).get("/v1/coaching/today").set(authA());
    expect(afterToday.body.streak.currentStreak).toBeGreaterThanOrEqual(streakMid);
  });

  it("short completed session is saved but does not count as focus session", async () => {
    const start = await request(app.getHttpServer())
      .post("/v1/study-sessions")
      .set(authA())
      .send({ preset: "25_5" });
    expect(start.status).toBe(201);

    const done = await request(app.getHttpServer())
      .patch(`/v1/study-sessions/${start.body.id}`)
      .set(authA())
      .send({ status: "COMPLETED", actualFocusSeconds: 60 });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe("COMPLETED");
    expect(done.body.countsAsFocusSession).toBe(false);
  });

  it("long completed session counts as focus session", async () => {
    const start = await request(app.getHttpServer())
      .post("/v1/study-sessions")
      .set(authB())
      .send({ preset: "25_5" });
    expect(start.status).toBe(201);

    const done = await request(app.getHttpServer())
      .patch(`/v1/study-sessions/${start.body.id}`)
      .set(authB())
      .send({ status: "COMPLETED", actualFocusSeconds: 1500 });
    expect(done.status).toBe(200);
    expect(done.body.countsAsFocusSession).toBe(true);
  });

  it("post-session feedback persists mood + note; unknown id → 404", async () => {
    const start = await request(app.getHttpServer())
      .post("/v1/study-sessions")
      .set(authA())
      .send({ preset: "25_5", subject: "Türkçe" });
    expect(start.status).toBe(201);

    await request(app.getHttpServer())
      .patch(`/v1/study-sessions/${start.body.id}`)
      .set(authA())
      .send({ status: "COMPLETED", actualFocusSeconds: 1500 });

    const feedback = await request(app.getHttpServer())
      .patch(`/v1/study-sessions/${start.body.id}/feedback`)
      .set(authA())
      .send({ mood: 3, struggleNote: "Paragraf soruları" });
    expect(feedback.status).toBe(200);
    expect(feedback.body.sessionMood).toBe(3);
    expect(feedback.body.struggleNote).toBe("Paragraf soruları");

    const invalid = await request(app.getHttpServer())
      .patch(`/v1/study-sessions/${start.body.id}/feedback`)
      .set(authA())
      .send({ mood: 9 });
    expect(invalid.status).toBe(400);

    const missing = await request(app.getHttpServer())
      .patch("/v1/study-sessions/00000000-0000-0000-0000-000000000000/feedback")
      .set(authA())
      .send({ mood: 2 });
    expect(missing.status).toBe(404);
  });

  it("GET /study-sessions lists finalized sessions (paginated, most recent first)", async () => {
    const start = await request(app.getHttpServer())
      .post("/v1/study-sessions")
      .set(authA())
      .send({ preset: "25_5", subject: "Matematik" });
    expect(start.status).toBe(201);

    await request(app.getHttpServer())
      .patch(`/v1/study-sessions/${start.body.id}`)
      .set(authA())
      .send({ status: "COMPLETED", actualFocusSeconds: 1500 });

    const list = await request(app.getHttpServer())
      .get("/v1/study-sessions?page=1&pageSize=5")
      .set(authA());
    expect(list.status).toBe(200);
    expect(list.body.page).toBe(1);
    expect(list.body.pageSize).toBe(5);
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.items.some((s: { id: string }) => s.id === start.body.id)).toBe(true);
  });

  it("GET /study-sessions filters by subject when subject query param is set", async () => {
    const matematik = await request(app.getHttpServer())
      .post("/v1/study-sessions")
      .set(authA())
      .send({ preset: "25_5", subject: "Matematik" });
    expect(matematik.status).toBe(201);
    await request(app.getHttpServer())
      .patch(`/v1/study-sessions/${matematik.body.id}`)
      .set(authA())
      .send({ status: "COMPLETED", actualFocusSeconds: 1500 });

    const turkce = await request(app.getHttpServer())
      .post("/v1/study-sessions")
      .set(authA())
      .send({ preset: "25_5", subject: "Türkçe" });
    expect(turkce.status).toBe(201);
    await request(app.getHttpServer())
      .patch(`/v1/study-sessions/${turkce.body.id}`)
      .set(authA())
      .send({ status: "COMPLETED", actualFocusSeconds: 1500 });

    const filtered = await request(app.getHttpServer())
      .get("/v1/study-sessions?page=1&pageSize=10&subject=Matematik")
      .set(authA());
    expect(filtered.status).toBe(200);
    expect(filtered.body.items.every((s: { subject: string }) => s.subject === "Matematik")).toBe(
      true,
    );
    expect(filtered.body.items.some((s: { id: string }) => s.id === matematik.body.id)).toBe(true);
    expect(filtered.body.items.some((s: { id: string }) => s.id === turkce.body.id)).toBe(false);

    const empty = await request(app.getHttpServer())
      .get("/v1/study-sessions?page=1&pageSize=10&subject=Fizik")
      .set(authA());
    expect(empty.status).toBe(200);
    expect(empty.body.items).toEqual([]);
    expect(empty.body.total).toBe(0);
  });

  it("GET /study-sessions filters by from/to UTC day bounds on started_at", async () => {
    const start = await request(app.getHttpServer())
      .post("/v1/study-sessions")
      .set(authA())
      .send({ preset: "25_5", subject: "Tarih" });
    expect(start.status).toBe(201);
    await request(app.getHttpServer())
      .patch(`/v1/study-sessions/${start.body.id}`)
      .set(authA())
      .send({ status: "COMPLETED", actualFocusSeconds: 1500 });

    const today = new Date().toISOString().slice(0, 10);
    const inRange = await request(app.getHttpServer())
      .get(`/v1/study-sessions?page=1&pageSize=10&from=${today}&to=${today}`)
      .set(authA());
    expect(inRange.status).toBe(200);
    expect(inRange.body.items.some((s: { id: string }) => s.id === start.body.id)).toBe(true);

    const outOfRange = await request(app.getHttpServer())
      .get("/v1/study-sessions?page=1&pageSize=10&from=2000-01-01&to=2000-01-02")
      .set(authA());
    expect(outOfRange.status).toBe(200);
    expect(outOfRange.body.items.some((s: { id: string }) => s.id === start.body.id)).toBe(false);

    const badRange = await request(app.getHttpServer())
      .get("/v1/study-sessions?page=1&pageSize=10&from=2026-07-20&to=2026-07-10")
      .set(authA());
    expect(badRange.status).toBe(400);
  });

  it("study session start persists planTaskId when linked from a plan task", async () => {
    const createTask = await request(app.getHttpServer())
      .post("/v1/plan-tasks")
      .set(authA())
      .send({ title: "Seans bağlantısı", subject: "Coğrafya" });
    expect(createTask.status).toBe(201);

    const start = await request(app.getHttpServer())
      .post("/v1/study-sessions")
      .set(authA())
      .send({
        preset: "25_5",
        subject: "Coğrafya",
        planTaskId: createTask.body.id,
      });
    expect(start.status).toBe(201);
    expect(start.body.planTaskId).toBe(createTask.body.id);

    const done = await request(app.getHttpServer())
      .patch(`/v1/study-sessions/${start.body.id}`)
      .set(authA())
      .send({ status: "COMPLETED", actualFocusSeconds: 1500 });
    expect(done.status).toBe(200);
    expect(done.body.planTaskAutoCompleted).toBe(true);

    const today = new Date().toISOString().slice(0, 10);
    const tasks = await request(app.getHttpServer())
      .get(`/v1/plan-tasks?date=${today}`)
      .set(authA());
    expect(tasks.status).toBe(200);
    const linkedTask = tasks.body.items.find(
      (t: { id: string }) => t.id === createTask.body.id,
    );
    expect(linkedTask?.status).toBe("DONE");

    const list = await request(app.getHttpServer())
      .get("/v1/study-sessions?page=1&pageSize=5")
      .set(authA());
    expect(list.status).toBe(200);
    const listed = list.body.items.find((s: { id: string }) => s.id === start.body.id);
    expect(listed?.planTaskTitle).toBe("Seans bağlantısı");

    const foreign = await request(app.getHttpServer())
      .post("/v1/study-sessions")
      .set(authA())
      .send({
        preset: "25_5",
        planTaskId: "00000000-0000-0000-0000-000000000000",
      });
    expect(foreign.status).toBe(404);
    expect(foreign.body.code).toBeTruthy();
  });

  it("custom preset requires focusMinutes and persists plannedFocusMinutes", async () => {
    const missing = await request(app.getHttpServer())
      .post("/v1/study-sessions")
      .set(authA())
      .send({ preset: "custom" });
    expect(missing.status).toBe(400);

    const start = await request(app.getHttpServer())
      .post("/v1/study-sessions")
      .set(authA())
      .send({ preset: "custom", focusMinutes: 35 });
    expect(start.status).toBe(201);
    expect(start.body.preset).toBe("custom");
    expect(start.body.plannedFocusMinutes).toBe(35);
  });

  it("mock exam POST computes net → GET analysis returns trend", async () => {
    const exams = await request(app.getHttpServer()).get("/v1/content/exams?page=1&pageSize=20");
    expect(exams.status).toBe(200);
    const exam = exams.body.items.find((e: { slug: string }) => e.slug === "kpss-lisans-2026");
    expect(exam?.id).toBeTruthy();

    const subjects = await request(app.getHttpServer()).get(
      `/v1/content/exams/kpss-lisans-2026/subjects`,
    );
    expect(subjects.status).toBe(200);
    expect(subjects.body.length).toBeGreaterThan(0);

    const turkce = subjects.body.find((s: { slug: string }) => s.slug === "turkce");
    expect(turkce).toBeTruthy();

    const create = await request(app.getHttpServer())
      .post("/v1/mock-exams")
      .set(authA())
      .send({
        examId: exam.id,
        subjects: [{ subjectRef: "turkce", correct: 20, wrong: 4, blank: 6 }],
      });
    expect(create.status).toBe(201);
    expect(create.body.totalNet).toBe("19.00");

    const analysis = await request(app.getHttpServer())
      .get("/v1/coaching/analysis")
      .set(authA());
    expect(analysis.status).toBe(200);
    expect(analysis.body.trend.some((t: { id: string }) => t.id === create.body.id)).toBe(true);
    expect(analysis.body.trend[0].totalNet).toBe("19.00");
    expect(Array.isArray(analysis.body.photoSubjectSignals)).toBe(true);

    const scoped = await request(app.getHttpServer())
      .get(`/v1/coaching/analysis?examId=${exam.id}`)
      .set(authA());
    expect(scoped.status).toBe(200);
    expect(scoped.body.trend.some((t: { id: string }) => t.id === create.body.id)).toBe(true);
    expect(scoped.body.subjects[0]).toMatchObject({
      subjectRef: "turkce",
      questionCount: 30,
      normalizedAveragePercent: "63.33",
    });

    const otherExamId = "00000000-0000-4000-8000-000000000001";
    const otherScope = await request(app.getHttpServer())
      .get(`/v1/coaching/analysis?examId=${otherExamId}`)
      .set(authA());
    expect(otherScope.status).toBe(200);
    expect(otherScope.body.trend).toEqual([]);
    expect(otherScope.body.personalRecordNet).toBeNull();

    const otherHistory = await request(app.getHttpServer())
      .get(`/v1/mock-exams?page=1&pageSize=5&examId=${otherExamId}`)
      .set(authA());
    expect(otherHistory.status).toBe(200);
    expect(otherHistory.body.items).toEqual([]);
  });

  it("updates and permanently deletes an owned mock exam", async () => {
    const exams = await request(app.getHttpServer()).get(
      "/v1/content/exams?page=1&pageSize=20",
    );
    const exam = exams.body.items.find(
      (item: { slug: string }) => item.slug === "kpss-lisans-2026",
    );

    const created = await request(app.getHttpServer())
      .post("/v1/mock-exams")
      .set(authA())
      .send({
        examId: exam.id,
        publisherName: "İlk yayın",
        subjects: [
          { subjectRef: "turkce", correct: 15, wrong: 4, blank: 11 },
        ],
      });
    expect(created.status).toBe(201);

    const updateBody = {
      takenAt: "2026-07-10T12:00:00.000Z",
      publisherName: null,
      subjects: [
        { subjectRef: "turkce", correct: 18, wrong: 4, blank: 8 },
      ],
    };
    const updated = await request(app.getHttpServer())
      .put(`/v1/mock-exams/${created.body.id}`)
      .set(authA())
      .send(updateBody);
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      id: created.body.id,
      examId: exam.id,
      publisherName: null,
      totalNet: "17.00",
    });

    const history = await request(app.getHttpServer())
      .get(`/v1/mock-exams?page=1&pageSize=20&examId=${exam.id}`)
      .set(authA());
    expect(
      history.body.items.filter(
        (item: { id: string }) => item.id === created.body.id,
      ),
    ).toHaveLength(1);

    const analysis = await request(app.getHttpServer())
      .get(`/v1/coaching/analysis?examId=${exam.id}`)
      .set(authA());
    expect(
      analysis.body.trend.find(
        (item: { id: string }) => item.id === created.body.id,
      )?.totalNet,
    ).toBe("17.00");

    const crossUpdate = await request(app.getHttpServer())
      .put(`/v1/mock-exams/${created.body.id}`)
      .set(authB())
      .send(updateBody);
    expect([403, 404]).toContain(crossUpdate.status);

    const crossDelete = await request(app.getHttpServer())
      .delete(`/v1/mock-exams/${created.body.id}`)
      .set(authB());
    expect([403, 404]).toContain(crossDelete.status);

    const removed = await request(app.getHttpServer())
      .delete(`/v1/mock-exams/${created.body.id}`)
      .set(authA());
    expect(removed.status).toBe(204);

    const missing = await request(app.getHttpServer())
      .get(`/v1/mock-exams/${created.body.id}`)
      .set(authA());
    expect(missing.status).toBe(404);

    const analysisAfterDelete = await request(app.getHttpServer())
      .get(`/v1/coaching/analysis?examId=${exam.id}`)
      .set(authA());
    expect(
      analysisAfterDelete.body.trend.some(
        (item: { id: string }) => item.id === created.body.id,
      ),
    ).toBe(false);
  });

  it("mock exam data is isolated per user (RLS)", async () => {
    const exams = await request(app.getHttpServer()).get("/v1/content/exams?page=1&pageSize=20");
    const exam = exams.body.items.find((e: { slug: string }) => e.slug === "kpss-lisans-2026");

    const createA = await request(app.getHttpServer())
      .post("/v1/mock-exams")
      .set(authA())
      .send({
        examId: exam.id,
        subjects: [{ subjectRef: "turkce", correct: 15, wrong: 2, blank: 13 }],
      });
    expect(createA.status).toBe(201);

    const analysisB = await request(app.getHttpServer())
      .get("/v1/coaching/analysis")
      .set(authB());
    expect(analysisB.status).toBe(200);
    expect(analysisB.body.trend.some((t: { id: string }) => t.id === createA.body.id)).toBe(false);

    const getByIdCross = await request(app.getHttpServer())
      .get(`/v1/mock-exams/${createA.body.id}`)
      .set(authB());
    expect([403, 404]).toContain(getByIdCross.status);
  });
});
