import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * W0 identity e2e — full auth lifecycle against a real Postgres (RLS active).
 * Covers: signup → me → patch me → refresh rotation → reuse detection → logout,
 * plus enumeration-safety and guard behaviour.
 */
describe("identity (e2e)", () => {
  let app: INestApplication;
  const email = `w0-${Date.now()}@test.local`;
  const password = "Sifre1234";
  let accessToken = "";
  let refreshCookie = "";

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
  });

  afterAll(async () => {
    await app?.close();
  });

  it("signs up: returns access token + user, sets the httpOnly refresh cookie", async () => {
    const res = await request(app.getHttpServer()).post("/v1/auth/signup").send({
      email,
      password,
      displayName: "W0 Test",
      kvkkAccepted: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.roles).toEqual(["STUDENT"]);
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");

    const setCookie = res.headers["set-cookie"]?.[0] ?? "";
    expect(setCookie).toContain("mentor_refresh=");
    expect(setCookie.toLowerCase()).toContain("httponly");
    accessToken = res.body.accessToken;
    refreshCookie = setCookie.split(";")[0]!;
  });

  it("rejects a duplicate email with 409 AUTH_EMAIL_IN_USE", async () => {
    const res = await request(app.getHttpServer()).post("/v1/auth/signup").send({
      email: email.toUpperCase(), // case-insensitive uniqueness
      password,
      displayName: "Dup",
      kvkkAccepted: true,
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("AUTH_EMAIL_IN_USE");
  });

  it("rejects signup without KVKK consent (validation)", async () => {
    const res = await request(app.getHttpServer()).post("/v1/auth/signup").send({
      email: `x${email}`,
      password,
      displayName: "NoKvkk",
      kvkkAccepted: false,
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("GET /users/me requires auth (401 without token)", async () => {
    const res = await request(app.getHttpServer()).get("/v1/users/me");
    expect(res.status).toBe(401);
  });

  it("GET /users/me returns the profile with a valid token (RLS self-read)", async () => {
    const res = await request(app.getHttpServer())
      .get("/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
  });

  it("PATCH /users/me updates the minimal onboarding profile", async () => {
    const res = await request(app.getHttpServer())
      .patch("/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ examType: "KPSS", examDate: "2026-07-26" });
    expect(res.status).toBe(200);
    expect(res.body.examType).toBe("KPSS");
    expect(res.body.examDate).toBe("2026-07-26");
  });

  it("unknown email and wrong password return the SAME generic 401 (no enumeration)", async () => {
    const wrongPass = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email, password: "WrongPass1" });
    const unknown = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: "ghost@test.local", password: "WrongPass1" });
    expect(wrongPass.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPass.body.code).toBe(unknown.body.code);
    expect(wrongPass.body.message).toBe(unknown.body.message);
  });

  it("refresh rotates the token; the old cookie is then rejected (reuse → 401)", async () => {
    const first = await request(app.getHttpServer())
      .post("/v1/auth/refresh")
      .set("Cookie", refreshCookie);
    expect(first.status).toBe(200);
    const newCookie = (first.headers["set-cookie"]?.[0] ?? "").split(";")[0]!;
    expect(newCookie).not.toBe(refreshCookie);

    // Replay the OLD cookie → reuse detection kicks in.
    const replay = await request(app.getHttpServer())
      .post("/v1/auth/refresh")
      .set("Cookie", refreshCookie);
    expect(replay.status).toBe(401);

    // Family revoked → even the NEW cookie is now dead.
    const afterTheft = await request(app.getHttpServer())
      .post("/v1/auth/refresh")
      .set("Cookie", newCookie);
    expect(afterTheft.status).toBe(401);
  });

  it("login → logout revokes the refresh cookie (idempotent)", async () => {
    const login = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email, password });
    expect(login.status).toBe(200);
    const cookie = (login.headers["set-cookie"]?.[0] ?? "").split(";")[0]!;

    const out = await request(app.getHttpServer()).post("/v1/auth/logout").set("Cookie", cookie);
    expect(out.status).toBe(204);

    const reuse = await request(app.getHttpServer())
      .post("/v1/auth/refresh")
      .set("Cookie", cookie);
    expect(reuse.status).toBe(401);

    // Logout without a cookie is still 204 (idempotent).
    const again = await request(app.getHttpServer()).post("/v1/auth/logout");
    expect(again.status).toBe(204);
  });

  it("forgot-password always returns 200 (no enumeration)", async () => {
    const known = await request(app.getHttpServer())
      .post("/v1/auth/forgot-password")
      .send({ email });
    const unknown = await request(app.getHttpServer())
      .post("/v1/auth/forgot-password")
      .send({ email: "ghost@test.local" });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
  });

  it("health stays public", async () => {
    const res = await request(app.getHttpServer()).get("/v1/health");
    expect(res.status).toBe(200);
  });
});
