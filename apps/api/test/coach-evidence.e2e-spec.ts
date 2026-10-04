import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CoachEvidenceType } from "@mentor/types";
import { CoachEvidenceService } from "../src/modules/coaching/application/coach-evidence.service";
import { CohortEvidenceService } from "../src/modules/coaching/application/cohort-evidence.service";
import { addDays, todayInIstanbul } from "../src/modules/coaching/domain/date.util";
import { completedMentorshipWeek } from "../src/modules/coaching/domain/mentorship-weekly-report";

const PREMIUM_PLAN_ID = "9f1c0a10-0000-4000-8000-0000000e0001";

/** The premium AI data pool read end to end: real rows in, verified aggregates out. */
describe("coach evidence pool (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let token = "";
  let userId = "";
  let examId = "";
  const auth = () => ({ Authorization: `Bearer ${token}` });

  const signupStudent = (label: string) =>
    request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send({
        email: `evidence-${label}-${Date.now()}@test.local`,
        password: "Sifre1234",
        displayName: "Evidence test",
        kvkkAccepted: true,
        termsAccepted: true,
        ageEligibilityConfirmed: true,
      });

  /** Premium through a real subscription row, the way a paying student has it. */
  const seedPremium = async (id: string) => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.role','SERVICE',true)");
      await client.query(
        `insert into plans (id,name,period_months,price_minor,currency,trial_days,is_active)
         values ($1,'Evidence Test Plan',1,19900,'TRY',7,true) on conflict (id) do nothing`,
        [PREMIUM_PLAN_ID],
      );
      await client.query(
        `insert into subscriptions (user_id,plan_id,status,provider,provider_ref,current_period_start,current_period_end)
         values ($1,$2,'ACTIVE','FAKE',$3, now(), now() + interval '30 days')`,
        [id, PREMIUM_PLAN_ID, `fake_evidence_${id}`],
      );
      await client.query("commit");
    } finally {
      client.release();
    }
  };

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { AppModule } = await import("../src/app.module");
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    await app.init();

    const signup = await signupStudent("student");
    expect(signup.status).toBe(201);
    token = signup.body.accessToken;
    userId = signup.body.user.id;
    const me = await request(app.getHttpServer())
      .patch("/v1/users/me")
      .set(auth())
      .send({ examType: "KPSS", examVariant: "LISANS" });
    expect(me.status).toBe(200);
    const calendar = await request(app.getHttpServer()).get(
      "/v1/content/exams/kpss-lisans-2026/calendar",
    );
    expect(calendar.status).toBe(200);
    examId = calendar.body.exam.id;
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  it("reads weak subjects, repeated notebook topics and last week's plan from real rows", async () => {
    const http = app.getHttpServer();
    const exam = (takenAt: string, turkce: number, matematik: number, tarih: number) =>
      request(http)
        .post("/v1/mock-exams")
        .set(auth())
        .send({
          examId,
          takenAt,
          subjects: [
            { subjectRef: "turkce", correct: turkce, wrong: 0, blank: 30 - turkce },
            { subjectRef: "matematik", correct: matematik, wrong: 0, blank: 30 - matematik },
            { subjectRef: "tarih", correct: tarih, wrong: 0, blank: 27 - tarih },
          ],
        });
    expect((await exam("2026-09-10T12:00:00Z", 25, 8, 20)).status).toBe(201);
    expect((await exam("2026-09-17T12:00:00Z", 26, 9, 18)).status).toBe(201);

    const topics = await request(http).get("/v1/content/exams/kpss-lisans-2026/topics");
    const topic = topics.body.find(
      (item: { subjectSlug: string }) => item.subjectSlug === "matematik",
    );
    expect(topic).toBeDefined();
    for (let index = 0; index < 2; index += 1) {
      const entry = await request(http)
        .post("/v1/coaching/notebook/entries")
        .set(auth())
        .send({ examId, subjectRef: "matematik", topicRef: topic.slug, errorType: "UNKNOWN_TOPIC" });
      expect(entry.status).toBe(201);
    }

    // Past days are read-only through the API, so last week's plan is seeded like a real history.
    const lastWeek = completedMentorshipWeek(new Date());
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.role','SERVICE',true)");
      await client.query(
        `insert into plan_tasks (user_id, task_date, title, subject, status)
         values ($1, $2, 'Geçen hafta A', 'matematik', 'DONE'),
                ($1, $2, 'Geçen hafta B', 'tarih', 'PENDING')`,
        [userId, lastWeek.startDate],
      );
      await client.query("commit");
    } finally {
      client.release();
    }

    const snapshot = await app.get(CoachEvidenceService).build(userId);
    const types = snapshot.evidence.map((item) => item.type);

    expect(types).toEqual(
      expect.arrayContaining([
        CoachEvidenceType.MOCK_PERFORMANCE,
        CoachEvidenceType.WEAK_SUBJECTS,
        CoachEvidenceType.NOTEBOOK_TOPICS,
        CoachEvidenceType.PLAN_FOLLOW_THROUGH,
      ]),
    );
    expect(snapshot.weakSubjects).toHaveLength(2);
    expect(snapshot.weakSubjects[0]).toBe("Matematik");
    expect(snapshot.coverage).toMatchObject({ mockCount: 2, notebookCount: 2 });
    const serialized = JSON.stringify(snapshot);
    expect(serialized).toContain(topic.name);
    expect(serialized).not.toContain("Geçen hafta A");
  });

  // Runs after the pool test above: the same student's mocks and notebook feed the plan.
  it("plans a premium week from the pool: brief, a reason on every change, then apply", async () => {
    const http = app.getHttpServer();
    await seedPremium(userId);

    const brief = await request(http)
      .get("/v1/coach/plan-adaptation/brief")
      .set(auth());
    expect(brief.status).toBe(200);
    expect(brief.body.groundingLine).toContain("2 denemene");
    expect(
      brief.body.evidence.map((item: { type: string }) => item.type),
    ).toContain(CoachEvidenceType.WEAK_SUBJECTS);
    expect(brief.body.suggestion.focusSubjects[0]).toBe("Matematik");

    const preview = await request(http)
      .post("/v1/coach/plan-adaptation")
      .set(auth())
      .send({ source: "PLAN", days: 2, minutesPerDay: 30 });
    expect(preview.status).toBe(201);
    expect(preview.body.status).toBe("READY");
    expect(preview.body.usedEvidence.length).toBeGreaterThan(0);
    expect(preview.body.changes.length).toBeGreaterThan(0);
    for (const change of preview.body.changes as Array<{ reason?: string }>) {
      expect(change.reason).toEqual(expect.any(String));
    }

    // The web sends the selected rows back as they arrived; the reason is display-only.
    const applied = await request(http)
      .post("/v1/plan-tasks/adapt")
      .set(auth())
      .send({ planRevision: preview.body.planRevision, changes: preview.body.changes });
    expect(applied.status).toBe(200);
    expect(applied.body.added).toHaveLength(
      preview.body.changes.filter((change: { kind: string }) => change.kind === "ADD").length,
    );
  });

  // Runs after the premium test above, for the same (now premium) student.
  it("suggests the weekdays the student studies on most, on the Istanbul calendar", async () => {
    const DAY = 24 * 60 * 60 * 1000;
    const at = (offset: number, time: string) =>
      new Date(`${new Date(Date.now() - offset * DAY).toISOString().slice(0, 10)}T${time}Z`);
    const offsets = Array.from({ length: 26 }, (_, index) => index + 1);
    const utcDay = (offset: number) => at(offset, "09:00:00").getUTCDay();
    // Mondays and Thursdays every week, a short Saturday once, and a long Sunday 22:30 UTC session
    // that is Monday 01:30 in Istanbul: a UTC grouping would rank Sunday over Saturday.
    const sessions = [
      ...offsets
        .filter((offset) => [1, 4].includes(utcDay(offset)))
        .map((offset) => ({ startedAt: at(offset, "09:00:00"), seconds: 1500 })),
      { startedAt: at(offsets.find((offset) => utcDay(offset) === 6)!, "09:00:00"), seconds: 600 },
      { startedAt: at(offsets.find((offset) => utcDay(offset) === 0)!, "22:30:00"), seconds: 3000 },
    ];
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.role','SERVICE',true)");
      for (const session of sessions) {
        await client.query(
          `insert into study_sessions (user_id, started_at, ended_at, preset, actual_focus_seconds, status)
           values ($1, $2, $2::timestamptz + make_interval(secs => $3), '25_5', $3, 'COMPLETED')`,
          [userId, session.startedAt.toISOString(), session.seconds],
        );
      }
      await client.query("commit");
    } finally {
      client.release();
    }

    const brief = await request(app.getHttpServer())
      .get("/v1/coach/plan-adaptation/brief")
      .set(auth());
    expect(brief.status).toBe(200);
    expect(brief.body.evidence.map((item: { type: string }) => item.type)).toContain(
      CoachEvidenceType.LONG_TERM_RHYTHM,
    );
    expect(brief.body.suggestion.days).toBe(3);
    expect(brief.body.suggestion.weekdays).toEqual([1, 4, 6]);
  });

  /**
   * The human coach's read (`CohortEvidenceService`) on a student of its own: NET_DROP compares an
   * attempt only with attempts of the same exam, and every window is cut on the Istanbul day.
   */
  it("compares mocks within one exam and cuts coach windows on Istanbul days", async () => {
    const signup = await signupStudent("cohort");
    expect(signup.status).toBe(201);
    const studentId: string = signup.body.user.id;
    const now = new Date();
    const localToday = todayInIstanbul(now);
    const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();
    const otherExamId = "7a1c0a10-0000-4000-8000-00000000e0b2";

    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.role','SERVICE',true)");
      const mock = (exam: string, takenAt: string, net: number) =>
        client.query(
          `insert into mock_exams (user_id, exam_id, taken_at, total_net) values ($1, $2, $3, $4)`,
          [studentId, exam, takenAt, net],
        );
      // Two strong attempts on one exam, then a first attempt on another: nothing to fall from.
      await mock(examId, hoursAgo(72), 70);
      await mock(examId, hoursAgo(48), 72);
      await mock(otherExamId, hoursAgo(24), 40);
      // 21:30 UTC is 00:30 the next Istanbul day: the first session opens the 7-day window's first
      // Istanbul day, the second is the student's today.
      for (const startedAt of [
        `${addDays(localToday, -7)}T21:30:00Z`,
        `${addDays(localToday, -1)}T21:30:00Z`,
      ]) {
        await client.query(
          `insert into study_sessions (user_id, started_at, ended_at, preset, actual_focus_seconds, status)
           values ($1, $2, $2::timestamptz + interval '25 minutes', '25_5', 1500, 'COMPLETED')`,
          [studentId, startedAt],
        );
      }
      // A done task, as `PlanService` records it: the task and the ledger row for its date.
      await client.query(
        `insert into plan_tasks (user_id, task_date, title, status) values ($1, $2, 'Paragraf', 'DONE')`,
        [studentId, addDays(localToday, -2)],
      );
      await client.query(
        `insert into daily_activity (user_id, activity_date, tasks_done) values ($1, $2, 1)`,
        [studentId, addDays(localToday, -2)],
      );
      await client.query("commit");
    } finally {
      client.release();
    }

    const evidence = app.get(CohortEvidenceService);
    const snapshot = (await evidence.listCohortSnapshots([studentId], now)).get(studentId)!;
    expect(snapshot).toMatchObject({
      latestMockNet: 40,
      previousMockNetAvg: null,
      lastActiveDate: localToday,
      sessions7d: 2,
      focusMinutes7d: 50,
      activeDays7d: 3,
    });
    const report = await evidence.getStudentReport(studentId, now);
    expect(report.activity).toMatchObject({
      lastActiveDate: localToday,
      sessions7d: 2,
      focusMinutes7d: 50,
      activeDays7d: 3,
    });

    // A second attempt on the new exam, older than the first: the baseline is that attempt alone.
    const again = await pool.connect();
    try {
      await again.query("begin");
      await again.query("select set_config('app.role','SERVICE',true)");
      await again.query(
        `insert into mock_exams (user_id, exam_id, taken_at, total_net) values ($1, $2, $3, 45)`,
        [studentId, otherExamId, hoursAgo(36)],
      );
      await again.query("commit");
    } finally {
      again.release();
    }
    const later = (await evidence.listCohortSnapshots([studentId], now)).get(studentId)!;
    expect(later).toMatchObject({ latestMockNet: 40, previousMockNetAvg: 45 });
  });

  it("keeps the wizard brief behind the premium gate", async () => {
    const free = await signupStudent("free");
    expect(free.status).toBe(201);

    const brief = await request(app.getHttpServer())
      .get("/v1/coach/plan-adaptation/brief")
      .set({ Authorization: `Bearer ${free.body.accessToken}` });
    expect(brief.status).toBe(403);
  });
});
