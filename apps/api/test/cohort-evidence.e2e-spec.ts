import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool, type PoolClient } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CohortEvidenceService } from "../src/modules/coaching/application/cohort-evidence.service";
import {
  addDays,
  todayInIstanbul,
  todayIso,
} from "../src/modules/coaching/domain/date.util";

/**
 * The numbers the coach screens draw, read end to end from real rows: the activity strip cut on
 * Istanbul days, a plan rate that ignores weeks not yet due, a streak that does not trust the
 * `streak_state` cache, and names instead of slugs.
 */
describe("cohort evidence (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let token = "";
  let studentId = "";
  let exam: { id: string; name: string };
  const now = new Date();
  const today = todayIso(now);
  const localToday = todayInIstanbul(now);

  const asService = async (work: (client: PoolClient) => Promise<unknown>) => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.role','SERVICE',true)");
      await work(client);
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

    const signup = await request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send({
        email: `cohort-evidence-${Date.now()}@test.local`,
        password: "Sifre1234",
        displayName: "Cohort evidence",
        kvkkAccepted: true,
        termsAccepted: true,
        ageEligibilityConfirmed: true,
      });
    expect(signup.status).toBe(201);
    token = signup.body.accessToken;
    studentId = signup.body.user.id;
    const me = await request(app.getHttpServer())
      .patch("/v1/users/me")
      .set({ Authorization: `Bearer ${token}` })
      .send({ examType: "KPSS", examVariant: "LISANS" });
    expect(me.status).toBe(200);
    const calendar = await request(app.getHttpServer()).get(
      "/v1/content/exams/kpss-lisans-2026/calendar",
    );
    expect(calendar.status).toBe(200);
    exam = { id: calendar.body.exam.id, name: calendar.body.exam.name };
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  it("cuts the activity strip on Istanbul days, not UTC ones", async () => {
    // 20:30 UTC is 23:30 in Istanbul, the same day; 21:30 UTC is 00:30 the next Istanbul day.
    const day = addDays(localToday, -3);
    await asService(async (client) => {
      for (const [startedAt, seconds] of [
        [`${day}T20:30:00Z`, 1500],
        [`${day}T21:30:00Z`, 600],
      ] as const) {
        await client.query(
          `insert into study_sessions (user_id, started_at, ended_at, preset, actual_focus_seconds, status)
           values ($1, $2, $2::timestamptz + make_interval(secs => $3), '25_5', $3, 'COMPLETED')`,
          [studentId, startedAt, seconds],
        );
      }
    });

    const service = app.get(CohortEvidenceService);
    const snapshot = (await service.listCohortSnapshots([studentId], now)).get(studentId)!;
    expect(snapshot.dailyFocusMinutes14d).toHaveLength(14);
    expect(snapshot.dailyFocusMinutes14d.slice(-4)).toEqual([25, 10, 0, 0]);

    const report = await service.getStudentReport(studentId, now);
    expect(report.dailyFocusMinutes28d).toHaveLength(28);
    expect(report.dailyFocusMinutes28d.slice(-4)).toEqual([25, 10, 0, 0]);
  });

  it("rates the plan only up to today, so an assigned future week cannot sink it", async () => {
    await asService((client) =>
      client.query(
        `insert into plan_tasks (user_id, task_date, title, status)
         values ($1, $2, 'Dün', 'DONE'), ($1, $3, 'Evvelsi gün', 'PENDING'),
                ($1, $4, 'Gelecek 1', 'PENDING'), ($1, $5, 'Gelecek 2', 'PENDING'),
                ($1, $6, 'Gelecek 3', 'PENDING')`,
        [
          studentId,
          addDays(today, -1),
          addDays(today, -2),
          addDays(today, 3),
          addDays(today, 4),
          addDays(today, 5),
        ],
      ),
    );

    const service = app.get(CohortEvidenceService);
    const snapshot = (await service.listCohortSnapshots([studentId], now)).get(studentId)!;
    expect(snapshot.planCompletionRate7d).toBe(0.5);
    const report = await service.getStudentReport(studentId, now);
    expect(report.planCompletionRate7d).toBe(0.5);
  });

  it("does not count today's pending task as missed, so planning a week cannot flag the student", async () => {
    // The coach plans on the day the week starts: today's task is still ahead of the student. A
    // task done today counts, on both sides.
    await asService((client) =>
      client.query(
        `insert into plan_tasks (user_id, task_date, title, status)
         values ($1, $2, 'Bugün bekleyen', 'PENDING')`,
        [studentId, today],
      ),
    );

    const service = app.get(CohortEvidenceService);
    const snapshot = (await service.listCohortSnapshots([studentId], now)).get(studentId)!;
    expect(snapshot.planCompletionRate7d).toBe(0.5);

    await asService((client) =>
      client.query(
        `insert into plan_tasks (user_id, task_date, title, status)
         values ($1, $2, 'Bugün biten', 'DONE')`,
        [studentId, today],
      ),
    );
    const next = (await service.listCohortSnapshots([studentId], now)).get(studentId)!;
    expect(next.planCompletionRate7d).toBeCloseTo(2 / 3);
  });

  it("derives the streak from activity and purchased freezes, past a stale streak_state", async () => {
    // Active t-1..t-3 and t-6; t-4 bought with coins, t-5 bridged by a monthly token → 4 days.
    // Without the purchased day the walk stops at t-4 → 3. The cache below says 9.
    await asService(async (client) => {
      for (const offset of [1, 2, 3, 6]) {
        await client.query(
          `insert into daily_activity (user_id, activity_date, has_session)
           values ($1, $2, true) on conflict (user_id, activity_date) do update set has_session = true`,
          [studentId, addDays(today, -offset)],
        );
      }
      await client.query(
        `insert into streak_freezes (user_id, date) values ($1, $2) on conflict do nothing`,
        [studentId, addDays(today, -4)],
      );
      await client.query(
        `insert into streak_state (user_id, current_streak, longest_streak)
         values ($1, 9, 11)
         on conflict (user_id) do update set current_streak = 9, longest_streak = 11`,
        [studentId],
      );
    });

    const service = app.get(CohortEvidenceService);
    const snapshot = (await service.listCohortSnapshots([studentId], now)).get(studentId)!;
    expect(snapshot.currentStreak).toBe(4);
    const report = await service.getStudentReport(studentId, now);
    expect(report.activity).toMatchObject({ currentStreak: 4, longestStreak: 11 });
  });

  it("names the latest attempt's exam and subjects", async () => {
    const mock = await request(app.getHttpServer())
      .post("/v1/mock-exams")
      .set({ Authorization: `Bearer ${token}` })
      .send({
        examId: exam.id,
        takenAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
        subjects: [
          { subjectRef: "turkce", correct: 20, wrong: 5, blank: 5 },
          { subjectRef: "matematik", correct: 12, wrong: 8, blank: 10 },
        ],
      });
    expect(mock.status).toBe(201);

    const report = await app.get(CohortEvidenceService).getStudentReport(studentId, now);
    expect(report.mockTrend[0]?.examName).toBe(exam.name);
    expect(
      report.latestMockSubjects.map(({ subjectRef, subjectName }) => [subjectRef, subjectName]),
    ).toEqual(
      expect.arrayContaining([
        ["matematik", "Matematik"],
        ["turkce", "Türkçe"],
      ]),
    );
  });
});
