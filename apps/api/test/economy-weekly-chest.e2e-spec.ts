import { disableAuthRateLimits } from "./app-harness";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "./browser-request";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, isoWeekKey, isoWeekStart, todayIso } from "../src/modules/coaching/domain/date.util";

const RUN = Date.now();

/**
 * Weekly chest (e2e, real Postgres + RLS): last week's completed, unopened chest is shown first with
 * numbers counted from real sessions and tasks; only its owner can open it; opening is stamped once
 * and the chest then moves on to this week.
 */
describe("economy weekly chest (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let ownerToken = "";
  let ownerId = "";
  let otherToken = "";

  const lastMonday = addDays(isoWeekStart(todayIso()), -7);
  const lastWeek = isoWeekKey(lastMonday);
  const thisWeek = isoWeekKey(todayIso());

  const signup = async (label: string) => {
    const res = await request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send({
        email: `wc-${label}-${RUN}@test.local`,
        password: "Sifre1234",
        displayName: `WC ${label}`,
        kvkkAccepted: true,
        termsAccepted: true,
        ageEligibilityConfirmed: true,
      });
    return res.body as { accessToken: string; user: { id: string } };
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

  /** Last week Mon–Fri active; sessions Mon–Wed (30 + 20 + 10 min), done tasks Thu–Fri; chest completed. */
  const seedLastWeek = (userId: string) =>
    svc(async (c) => {
      for (let i = 0; i < 5; i++) {
        await c.query(
          "insert into daily_activity (user_id, activity_date, has_session, tasks_done) values ($1, $2, $3, $4)",
          [userId, addDays(lastMonday, i), i < 3, i < 3 ? 0 : 1],
        );
      }
      for (const [i, seconds] of [[0, 1800], [1, 1200], [2, 600]] as const) {
        const start = `${addDays(lastMonday, i)}T09:00:00Z`;
        await c.query(
          `insert into study_sessions (user_id, started_at, ended_at, preset, actual_focus_seconds, status)
           values ($1, $2, $2::timestamptz + interval '1 hour', 'POMODORO_25', $3, 'COMPLETED')`,
          [userId, start, seconds],
        );
      }
      for (const i of [3, 4]) {
        await c.query("insert into plan_tasks (user_id, task_date, title, status) values ($1, $2, 'Görev', 'DONE')", [
          userId,
          addDays(lastMonday, i),
        ]);
      }
      await c.query(
        "insert into user_quest_progress (user_id, quest_id, period_key) values ($1, 'weekly.effort-allowance', $2)",
        [userId, lastWeek],
      );
    });

  const revealedAt = async (userId: string): Promise<Date | null> => {
    let value: Date | null = null;
    await svc(async (c) => {
      const res = await c.query(
        "select revealed_at from user_quest_progress where user_id = $1 and quest_id = 'weekly.effort-allowance' and period_key = $2",
        [userId, lastWeek],
      );
      value = res.rows[0]?.revealed_at ?? null;
    });
    return value;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    disableAuthRateLimits(moduleRef);
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    await app.init();

    const owner = await signup("owner");
    const other = await signup("other");
    ownerToken = owner.accessToken;
    ownerId = owner.user.id;
    otherToken = other.accessToken;
    await seedLastWeek(ownerId);
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  it("shows last week's unopened chest first, with the week's real numbers", async () => {
    const res = await request(app.getHttpServer()).get("/v1/economy/weekly-chest").set(as(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      state: "READY",
      periodKey: lastWeek,
      carriedOver: true,
      current: 5,
      summary: { activeDays: 5, focusSessions: 3, planTasks: 2, focusMinutes: 60 },
    });
    expect(res.body.days).toHaveLength(7);
    expect(res.body.days[0]).toEqual({ date: lastMonday, active: true });
    expect(res.body.days[5]).toEqual({ date: addDays(lastMonday, 5), active: false });
  });

  it("does not let another user open it, and rejects a malformed week", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/economy/weekly-chest/open")
      .set(as(otherToken))
      .send({ periodKey: lastWeek });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("WEEKLY_CHEST_NOT_FOUND");
    expect(await revealedAt(ownerId)).toBeNull();

    const bad = await request(app.getHttpServer())
      .post("/v1/economy/weekly-chest/open")
      .set(as(ownerToken))
      .send({ periodKey: "last-week" });
    expect(bad.status).toBe(400);
  });

  it("opens once for its owner, repeats safely, then moves on to this week", async () => {
    const open = () =>
      request(app.getHttpServer()).post("/v1/economy/weekly-chest/open").set(as(ownerToken)).send({ periodKey: lastWeek });
    const first = await open();
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ state: "OPENED", periodKey: lastWeek, summary: { activeDays: 5 } });
    const stamped = await revealedAt(ownerId);
    expect(stamped).toBeInstanceOf(Date);

    const again = await open();
    expect(again.body).toEqual(first.body);
    expect(await revealedAt(ownerId)).toEqual(stamped);

    const next = await request(app.getHttpServer()).get("/v1/economy/weekly-chest").set(as(ownerToken));
    expect(next.body).toMatchObject({ state: "PROGRESS", periodKey: thisWeek, carriedOver: false });
  });
});
