import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import express from "express";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PHOTO_MAX_BYTES } from "../src/modules/ai/domain/photo-classify.constants";

const RUN = Date.now();
const PREMIUM_PLAN_ID = "9f1c0a10-0000-4000-8000-00000000ai01";

/**
 * W3 photo → subject categorize (e2e, fake vision + fake storage).
 */
describe("ai photo categorize (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let freeToken = "";
  let premiumToken = "";
  let premiumId = "";
  let mockExamId = "";

  const signup = async (label: string) => {
    const email = `photo-${label}-${RUN}@test.local`;
    const res = await request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send({ email, password: "Sifre1234", displayName: `Photo ${label}`, kvkkAccepted: true });
    return { email, ...(res.body as { accessToken: string; user: { id: string } }) };
  };

  /**
   * Premium through a real subscription, not `UserRole.STAFF`. STAFF does grant premium
   * (`entitlement.service.ts`), but it also short-circuits `isMentorV2Enabled`, so a STAFF user is
   * always on Personalized Mentor V2 and its first turn answers with a calibration question
   * instead of calling the LLM. See ai-coach.e2e-spec.ts for the full note.
   */
  const seedSubscription = async (userId: string) => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('app.role','SERVICE',true)");
      await c.query(
        `insert into plans (id,name,period_months,price_minor,currency,trial_days,is_active)
         values ($1,'AI Test Plan',1,19900,'TRY',7,true) on conflict (id) do nothing`,
        [PREMIUM_PLAN_ID],
      );
      await c.query(
        `insert into subscriptions (user_id,plan_id,status,provider,provider_ref,current_period_start,current_period_end)
         values ($1,$2,'ACTIVE','FAKE',$3, now(), now() + interval '30 days')`,
        [userId, PREMIUM_PLAN_ID, `fake_ai_${userId}`],
      );
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

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    process.env.JWT_ACCESS_SECRET ??= "test-secret-test-secret-test-secret!!";
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    app.use(
      "/v1/storage/fake-upload",
      express.raw({ type: ["image/jpeg", "image/png"], limit: PHOTO_MAX_BYTES }),
    );
    await app.init();

    const free = await signup("free");
    freeToken = free.accessToken;

    const premium = await signup("premium");
    premiumId = premium.user.id;
    await seedSubscription(premiumId);
    premiumToken = await login(premium.email);

    const calendar = await request(app.getHttpServer()).get(
      "/v1/content/exams/kpss-lisans-2026/calendar",
    );
    expect(calendar.status).toBe(200);
    const exam = calendar.body.exam as { id: string };
    const create = await request(app.getHttpServer())
      .post("/v1/mock-exams")
      .set({ Authorization: `Bearer ${premiumToken}` })
      .send({
        examId: exam.id,
        subjects: [{ subjectRef: "turkce", correct: 10, wrong: 2, blank: 8 }],
      });
    mockExamId = create.body.id;
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  it("free user GET /coach/photo-access → canCategorize false", async () => {
    const res = await request(app.getHttpServer())
      .get("/v1/coach/photo-access")
      .set({ Authorization: `Bearer ${freeToken}` });
    expect(res.status).toBe(200);
    expect(res.body.canCategorize).toBe(false);
    expect(res.body.reason).toBe("PAYMENT_PREMIUM_REQUIRED");
  });

  it("premium user can upload and categorize photo", async () => {
    const access = await request(app.getHttpServer())
      .get("/v1/coach/photo-access")
      .set({ Authorization: `Bearer ${premiumToken}` });
    expect(access.status).toBe(200);
    expect(access.body.canCategorize).toBe(true);

    const uploadUrlRes = await request(app.getHttpServer())
      .post("/v1/mock-exams/photo-upload-url")
      .set({ Authorization: `Bearer ${premiumToken}` })
      .send({ contentType: "image/jpeg" });
    expect(uploadUrlRes.status).toBe(201);
    const { uploadUrl, key } = uploadUrlRes.body;

    const jpegBytes = Buffer.from(
      "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQACEQADAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUC/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF/9k=",
      "base64",
    );

    const putRes = await request(app.getHttpServer())
      .put(uploadUrl.startsWith("/") ? uploadUrl : uploadUrl.replace(/^https?:\/\/[^/]+/, ""))
      .set("Content-Type", "image/jpeg")
      .send(jpegBytes);
    expect(putRes.status).toBe(200);

    const clientRequestId = "11111111-1111-4111-8111-111111111111";
    const categorize = await request(app.getHttpServer())
      .post(`/v1/mock-exams/${mockExamId}/categorize-photo`)
      .set({ Authorization: `Bearer ${premiumToken}` })
      .send({ storageKey: key, clientRequestId });
    expect(categorize.status).toBe(201);
    expect(categorize.body.subjectRefs.length).toBeGreaterThan(0);
    expect(categorize.body.subjectRefs[0].slug).toBeTruthy();

    // No analysis assertion here on purpose. `photoSubjectSignals` keeps the name but no longer
    // comes from photo categorization: `mock-exam.service.ts` reads it from the mistake notebook
    // now, and the photo-categorize card that fed it was retired. Categorizing a photo therefore
    // cannot move that array, and asserting it did was testing a link that had been cut. The
    // field's shape stays covered by coaching.e2e-spec.ts.

    const retry = await request(app.getHttpServer())
      .post(`/v1/mock-exams/${mockExamId}/categorize-photo`)
      .set({ Authorization: `Bearer ${premiumToken}` })
      .send({ storageKey: key, clientRequestId });
    expect(retry.status).toBe(201);
    expect(retry.body.subjectRefs.length).toBeGreaterThan(0);
  });

  it("free user POST photo-upload-url → 403", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/mock-exams/photo-upload-url")
      .set({ Authorization: `Bearer ${freeToken}` })
      .send({ contentType: "image/jpeg" });
    expect(res.status).toBe(403);
  });

  it("free user POST categorize-photo → 403", async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/mock-exams/${mockExamId}/categorize-photo`)
      .set({ Authorization: `Bearer ${freeToken}` })
      .send({ storageKey: `mock-exams/${premiumId}/bad-key.jpg` });
    expect(res.status).toBe(403);
  });
});
