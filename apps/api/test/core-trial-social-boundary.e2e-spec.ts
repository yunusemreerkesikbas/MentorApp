import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConfigRegistryService } from "../src/common/config/config-registry.service";
import { createTestApp } from "./app-harness";
import request from "./browser-request";
import { inArray } from "drizzle-orm";
import { DRIZZLE } from "../src/database/database.constants";
import type { Database } from "../src/database/drizzle";
import { withServiceContext } from "../src/database/rls";
import { configOverrides } from "../src/database/schema";

const run = Date.now();
const previousAdminMode = process.env.ADMIN_ACCESS_MODE;
const previousDatabaseUrl = process.env.DATABASE_URL;
const touchedFlags = ["community.social.enabled", "coaching.study_rooms.enabled", "forum.enabled",
  "community.leaderboard.enabled", "mentorship.enabled", "mentorship.applications.open",
  "economy.enabled", "ai.enabled", "payments.web.enabled", "payments.mobile.enabled", "ads.enabled",
  "community.achievements.enabled"] as const;

describe("core-trial social boundary (real HTTP and Postgres)", () => {
  let app: INestApplication;
  let config: ConfigRegistryService;
  let db: Database;
  let previousOverrides: (typeof configOverrides.$inferSelect)[] | undefined;
  const readOverrides = () => withServiceContext(db, tx => tx.select().from(configOverrides)
    .where(inArray(configOverrides.key, [...touchedFlags])).orderBy(configOverrides.key));
  let a: { id: string; token: string; username: string };
  let b: { id: string; token: string; username: string };
  let roomId: string;
  let existingSessionId: string;
  const auth = () => ({ Authorization: `Bearer ${a.token}` });

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    process.env.ADMIN_ACCESS_MODE = "disabled";
    const { AppModule } = await import("../src/app.module");
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = createTestApp(module, { authRateLimits: false });
    await app.init();
    config = app.get(ConfigRegistryService);
    db = app.get(DRIZZLE);
    previousOverrides = await readOverrides();
    const signup = async (label: string) => {
      const response = await request(app.getHttpServer()).post("/v1/auth/signup").send({
        email: `core-${label}-${run}@test.local`, password: "Sifre1234", displayName: `Core ${label}`,
        kvkkAccepted: true, termsAccepted: true, ageEligibilityConfirmed: true,
      });
      expect(response.status).toBe(201);
      const username = `core${label}${String(run).slice(-8)}`;
      const updated = await request(app.getHttpServer()).patch("/v1/users/me")
        .set({ Authorization: `Bearer ${response.body.accessToken}` }).send({ username, examType: "KPSS" });
      expect(updated.status).toBe(200);
      return { id: response.body.user.id as string, token: response.body.accessToken as string, username };
    };
    a = await signup("a");
    b = await signup("b");
    await config.set(a.id, "community.social.enabled", true);
    await config.set(a.id, "coaching.study_rooms.enabled", true);
    expect((await request(app.getHttpServer()).put(`/v1/users/${b.username}/follow`).set(auth())).status).toBe(200);
    const room = await request(app.getHttpServer()).post("/v1/study-rooms").set(auth())
      .send({ name: "Trial preparation", theme: "LIBRARY", capacity: 2 });
    expect(room.status).toBe(201);
    roomId = room.body.id;
    const session = await request(app.getHttpServer()).post("/v1/study-sessions").set(auth())
      .send({ preset: "25_5", roomId });
    expect(session.status).toBe(201);
    existingSessionId = session.body.id;
    for (const key of ["community.social.enabled", "coaching.study_rooms.enabled", "forum.enabled",
      "community.leaderboard.enabled", "mentorship.enabled", "mentorship.applications.open",
      "economy.enabled", "ai.enabled", "payments.web.enabled", "payments.mobile.enabled", "ads.enabled"] as const) {
      await config.set(a.id, key, false);
    }
    await config.set(a.id, "community.achievements.enabled", true);
  }, 90_000);

  afterAll(async () => {
    try {
      const restoreRows = previousOverrides;
      if (restoreRows) {
        await withServiceContext(db, async tx => {
          await tx.delete(configOverrides).where(inArray(configOverrides.key, [...touchedFlags]));
          if (restoreRows.length) await tx.insert(configOverrides).values(restoreRows);
        });
        expect(await readOverrides()).toEqual(restoreRows);
      }
    } finally {
      try { await app?.close(); } finally {
        if (previousAdminMode === undefined) delete process.env.ADMIN_ACCESS_MODE;
        else process.env.ADMIN_ACCESS_MODE = previousAdminMode;
        if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = previousDatabaseUrl;
      }
    }
  });

  it("publishes only non-secret closed capabilities without requiring a session", async () => {
    const response = await request(app.getHttpServer()).get("/v1/app/availability");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.body).toMatchObject({ social: false, forum: false, studyRooms: false,
      humanCoaching: false, aiCoach: false, studentPurchases: false, invites: false, studentSignup: true });
    expect(Object.values(response.body).every(value => typeof value === "boolean")).toBe(true);
  });

  it("denies direct social calls and other-user reads while preserving own progress", async () => {
    const server = app.getHttpServer();
    for (const response of [
      await request(server).put(`/v1/users/${b.username}/follow`).set(auth()),
      await request(server).delete(`/v1/users/${b.username}/follow`).set(auth()),
      await request(server).get(`/v1/users/${b.username}/followers`).set(auth()),
      await request(server).get("/v1/buddy").set(auth()),
      await request(server).get("/v1/buddy/suggestions").set(auth()),
      await request(server).post(`/v1/buddy/requests/${b.username}`).set(auth()),
      await request(server).get(`/v1/community/profile/${b.username}`).set(auth()),
      await request(server).get(`/v1/community/profile/${b.username}/achievements`).set(auth()),
    ]) expect(response.status).toBe(404);
    expect((await request(server).get(`/v1/community/profile/${a.username}`).set(auth())).status).toBe(200);
    const achievements = await request(server).get(`/v1/community/profile/${a.username}/achievements`).set(auth());
    expect(achievements.status).toBe(200);
    expect(achievements.body.ownerView).toBe(true);
    expect((await request(server).get("/v1/community/summary").set(auth())).status).toBe(200);
    expect((await request(server).get("/v1/users/me").set(auth())).status).toBe(200);
    expect((await request(server).get("/v1/admin/config").set(auth())).status).toBe(403);
  });

  it("refuses known room membership while allowing existing completion and solo sessions", async () => {
    const server = app.getHttpServer();
    const blocked = await request(server).post("/v1/study-sessions").set(auth()).send({ preset: "25_5", roomId });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("COACHING_ROOM_DISABLED");
    const completed = await request(server).patch(`/v1/study-sessions/${existingSessionId}`).set(auth())
      .send({ status: "COMPLETED", actualFocusSeconds: 600 });
    expect(completed.status).toBe(200);
    const solo = await request(server).post("/v1/study-sessions").set(auth()).send({ preset: "25_5" });
    expect(solo.status).toBe(201);
    expect(solo.body.roomId).toBeNull();
  });

  it("preserves manual plan and notebook creation", async () => {
    const server = app.getHttpServer();
    const plan = await request(server).post("/v1/plan-tasks").set(auth())
      .send({ title: "Kısa tekrar", taskDate: new Date().toISOString().slice(0, 10) });
    expect(plan.status).toBe(201);
    const notebook = await request(server).post("/v1/coaching/notebooks").set(auth()).send({ title: "Tekrar" });
    expect(notebook.status).toBe(201);
  });
});
