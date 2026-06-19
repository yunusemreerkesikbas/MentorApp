import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import express from "express";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";
import { PHOTO_MAX_BYTES } from "../src/modules/ai/domain/photo-classify.constants";

const RUN = Date.now();

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

  const grantRole = async (userId: string, role: string) => {
    const c = await pool.connect();
    try {
      await c.query("select set_config('app.role','SERVICE',true)");
      await c.query("update users set roles = array_append(roles,$1) where id=$2", [role, userId]);
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
    await grantRole(premiumId, UserRole.STAFF);
    premiumToken = await login(premium.email);

    const exams = await request(app.getHttpServer()).get("/v1/content/exams?page=1&pageSize=20");
    const exam = exams.body.items.find((e: { slug: string }) => e.slug === "kpss-lisans-2026");
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

    const analysis = await request(app.getHttpServer())
      .get("/v1/coaching/analysis")
      .set({ Authorization: `Bearer ${premiumToken}` });
    expect(analysis.status).toBe(200);
    expect(analysis.body.photoSubjectSignals.length).toBeGreaterThan(0);

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
