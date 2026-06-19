import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";
import { buildGhostPrompt, buildMoodReflectionPrompt } from "../src/modules/ai/domain/ai.constants";

const RUN = Date.now();

/**
 * W3 mood-reflection + ghost-narration (e2e, fake LLM): premium gate, idempotent cache replay.
 * Real Postgres (RLS active). §4 #1 refusal verified on both prompt builders.
 */
describe("ai mood-reflection + ghost-narration (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let freeToken = "";
  let premiumToken = "";
  let premiumId = "";
  let examId = "";

  const signup = async (label: string) => {
    const email = `mg-${label}-${RUN}@test.local`;
    const res = await request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send({ email, password: "Sifre1234", displayName: `MG ${label}`, kvkkAccepted: true });
    return { email, ...(res.body as { accessToken: string; user: { id: string } }) };
  };

  const grantRole = async (userId: string, role: string) => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('app.role','SERVICE',true)");
      await c.query("update users set roles = array_append(roles,$1) where id=$2", [role, userId]);
      await c.query("commit");
    } finally {
      c.release();
    }
  };

  const login = async (email: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email, password: "Sifre1234" });
    return res.body.accessToken;
  };

  const createMockExam = (token: string, correct: number) =>
    request(app.getHttpServer())
      .post("/v1/mock-exams")
      .set({ Authorization: `Bearer ${token}` })
      .send({
        examId,
        subjects: [{ subjectRef: "turkce", correct, wrong: 4, blank: 6 }],
      });

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

    const free = await signup("free");
    freeToken = free.accessToken;

    const premium = await signup("premium");
    premiumId = premium.user.id;
    await grantRole(premiumId, UserRole.STAFF);
    premiumToken = await login(premium.email);

    const exams = await request(app.getHttpServer()).get("/v1/content/exams?page=1&pageSize=20");
    const exam = exams.body.items.find((e: { slug: string }) => e.slug === "kpss-lisans-2026");
    examId = exam.id;
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  const moodReflect = (token: string) =>
    request(app.getHttpServer())
      .post("/v1/coach/mood-reflection")
      .set({ Authorization: `Bearer ${token}` });

  const ghostNarrate = (token: string) =>
    request(app.getHttpServer())
      .post("/v1/coach/ghost-narration")
      .set({ Authorization: `Bearer ${token}` });

  it("§4 #1: mood and ghost prompts forbid generating official info", () => {
    const mood = buildMoodReflectionPrompt(
      { examType: "KPSS", daysRemaining: 90, examDateLabel: null, moodLevel: 3, struggleNote: null },
      3,
      null,
    );
    expect(mood.system).toMatch(/Resmî bilgi/);
    expect(mood.system).toContain("/bilgi");

    const ghost = buildGhostPrompt({
      latest: { id: "m1", takenAt: "2026-06-19T10:00:00.000Z", totalNet: "42.00", examName: "KPSS" },
      previousNet: "39.00",
      previousDelta: "+3.00",
      beatPrevious: true,
      bestPreviousNet: "40.00",
      recordDelta: "+2.00",
      isNewRecord: true,
      headline: "Yeni rekor!",
      subjects: [],
      aiNarration: null,
    });
    expect(ghost.system).toMatch(/Resmî bilgi/);
    expect(ghost.system).toContain("/bilgi");
  });

  it("free user → 403 on mood-reflection and ghost-narration", async () => {
    expect((await moodReflect(freeToken)).status).toBe(403);
    expect((await ghostNarrate(freeToken)).status).toBe(403);
  });

  it("mood-reflection → 400 when no check-in today", async () => {
    const res = await moodReflect(premiumToken);
    expect(res.status).toBe(400);
  });

  it("premium mood-reflection generates and replays from cache", async () => {
    const upsert = await request(app.getHttpServer())
      .post("/v1/coaching/mood-checkins")
      .set({ Authorization: `Bearer ${premiumToken}` })
      .send({ mood: 3, struggleNote: "matematik" });
    expect(upsert.status).toBe(200);

    const first = await moodReflect(premiumToken);
    expect(first.status).toBe(200);
    expect(typeof first.body.reflection).toBe("string");
    expect(first.body.reflection.length).toBeGreaterThan(0);
    expect(first.body.model).toBe("fake");

    const second = await moodReflect(premiumToken);
    expect(second.status).toBe(200);
    expect(second.body.reflection).toBe(first.body.reflection);
    expect(second.body.model).toBe("cache");
  });

  it("ghost-narration → 400 with fewer than two mock exams", async () => {
    const res = await ghostNarrate(premiumToken);
    expect(res.status).toBe(400);
  });

  it("premium ghost-narration generates and replays from cache", async () => {
    expect((await createMockExam(premiumToken, 15)).status).toBe(201);
    expect((await createMockExam(premiumToken, 20)).status).toBe(201);

    const analysis = await request(app.getHttpServer())
      .get("/v1/coaching/analysis")
      .set({ Authorization: `Bearer ${premiumToken}` });
    expect(analysis.status).toBe(200);
    expect(analysis.body.ghost).toBeTruthy();
    expect(analysis.body.ghost.latest.totalNet).toBe("19.00");

    const first = await ghostNarrate(premiumToken);
    expect(first.status).toBe(200);
    expect(typeof first.body.narration).toBe("string");
    expect(first.body.narration.length).toBeGreaterThan(0);
    expect(first.body.model).toBe("fake");

    const second = await ghostNarrate(premiumToken);
    expect(second.status).toBe(200);
    expect(second.body.narration).toBe(first.body.narration);
    expect(second.body.model).toBe("cache");

    const analysisAfter = await request(app.getHttpServer())
      .get("/v1/coaching/analysis")
      .set({ Authorization: `Bearer ${premiumToken}` });
    expect(analysisAfter.body.ghost.aiNarration).toBe(first.body.narration);
  });
});
