import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("analysis improvement loop (e2e)", () => {
  let app: INestApplication;
  let token = "";
  let otherToken = "";
  let examId = "";
  const auth = () => ({ Authorization: `Bearer ${token}` });
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    const { AppModule } = await import("../src/app.module");
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    await app.init();
    for (const label of ["self", "other"]) {
      const result = await request(app.getHttpServer()).post("/v1/auth/signup").send({ email: `analysis-${label}-${Date.now()}@test.local`, password: "Sifre1234", displayName: "Analysis test", kvkkAccepted: true });
      expect(result.status).toBe(201);
      if (label === "self") token = result.body.accessToken;
      else otherToken = result.body.accessToken;
    }
    const calendar = await request(app.getHttpServer()).get("/v1/content/exams/kpss-lisans-2026/calendar");
    expect(calendar.status).toBe(200);
    examId = calendar.body.exam.id;
  }, 90_000);
  afterAll(async () => { await app?.close(); });

  it("connects owned attempts, filtered notebook, idempotent plan, practice and neutral follow-up", async () => {
    const http = app.getHttpServer();
    const createExam = (date: string, correct: number) => request(http).post("/v1/mock-exams").set(auth()).send({ examId, takenAt: date, subjects: [{ subjectRef: "matematik", correct, wrong: 0, blank: 30 - correct }] });
    const baseline = await createExam("2026-08-01T12:00:00Z", 20);
    expect(baseline.status).toBe(201);
    const entry = await request(http).post("/v1/coaching/notebook/entries").set(auth()).send({ examId, mockExamId: baseline.body.id, subjectRef: "matematik", errorType: "UNKNOWN_TOPIC" });
    expect(entry.status).toBe(201);
    const filtered = await request(http).get("/v1/coaching/notebook/entries").set(auth()).query({ examId, mockExamId: baseline.body.id, subjectRef: "matematik" });
    expect(filtered.status).toBe(200);
    expect(filtered.body.items.map((item: { id: string }) => item.id)).toContain(entry.body.id);
    const isolated = await request(http).get("/v1/coaching/notebook/entries").set({ Authorization: `Bearer ${otherToken}` }).query({ examId, mockExamId: baseline.body.id });
    expect(isolated.status).toBe(200);
    expect(isolated.body.items).toEqual([]);
    const analysis = await request(http).get("/v1/coaching/analysis").set(auth()).query({ examId });
    expect(analysis.status).toBe(200);
    const focus = analysis.body.nextFocus;
    const input = { examId, baselineMockExamId: baseline.body.id, expectedSubjectRef: focus.subjectRef, expectedTopicRef: focus.topicRef, title: "Review focus" };
    const foreign = await request(http).post("/v1/coaching/analysis/plan-task").set({ Authorization: `Bearer ${otherToken}` }).send(input);
    expect(foreign.status).toBe(404);
    const task = await request(http).post("/v1/coaching/analysis/plan-task").set(auth()).send(input);
    expect(task.status).toBe(201);
    expect(task.body.origin.type).toBe("ANALYSIS");
    const duplicate = await request(http).post("/v1/coaching/analysis/plan-task").set(auth()).send(input);
    expect(duplicate.body.id).toBe(task.body.id);
    const review = await request(http).post(`/v1/coaching/notebook/entries/${entry.body.id}/review`).set(auth()).send({ solved: true });
    expect(review.status).toBe(200);
    expect((await createExam("2026-08-01T20:00:00Z", 25)).status).toBe(201);
    expect((await createExam("2026-07-31T12:00:00Z", 26)).status).toBe(201);
    const unmeasured = await request(http).get("/v1/coaching/analysis").set(auth()).query({ examId });
    expect(unmeasured.body.improvementCycle.followUp).toBeNull();
    const next = await createExam("2026-08-15T12:00:00Z", 22);
    expect(next.status).toBe(201);
    expect((await createExam("2026-08-20T12:00:00Z", 24)).status).toBe(201);
    const result = await request(http).get("/v1/coaching/analysis").set(auth()).query({ examId });
    expect(result.status).toBe(200);
    expect(result.body.improvementCycle).toMatchObject({ baseline: { mockExamId: baseline.body.id, net: "20.00" }, followUp: { mockExamId: next.body.id, net: "22.00", delta: "+2.00" }, steps: { practiced: true, measured: true } });
    const stale = await request(http).post("/v1/coaching/analysis/plan-task").set(auth()).send(input);
    expect(stale.status).toBe(409);
  });
});
