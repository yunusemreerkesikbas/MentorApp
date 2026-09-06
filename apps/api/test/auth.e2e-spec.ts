import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FeatureFlag } from "../src/common/config/config.catalog";
import { ConfigRegistryService } from "../src/common/config/config-registry.service";
import { AVATAR_MAX_BYTES } from "../src/modules/identity/domain/avatar";
import { PG_POOL } from "../src/database/database.constants";
import type { Pool } from "pg";

/**
 * W0 identity e2e — full auth lifecycle against a real Postgres (RLS active).
 * Covers: signup → me → patch me → refresh rotation → reuse detection → logout,
 * plus enumeration-safety and guard behaviour.
 */
describe("identity (e2e)", () => {
  let app: INestApplication;
  const runId = Date.now();
  const email = `w0-${runId}@test.local`;
  const username = `w0_${runId}`;
  const password = "Sifre1234";
  let userId = "";
  let accessToken = "";
  let refreshCookie = "";

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    process.env.JWT_ACCESS_SECRET ??= "test-secret-test-secret-test-secret!!";
    process.env.GOOGLE_OAUTH_CLIENT_ID ??= "google-client-id.test";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ??= "google-client-secret.test";
    process.env.GOOGLE_OAUTH_REDIRECT_URI ??=
      "http://localhost:3001/v1/auth/google/callback";

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
      username,
      kvkkAccepted: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.username).toBe(username);
    expect(res.body.user.roles).toEqual(["STUDENT"]);
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");

    userId = res.body.user.id;
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
      username: `w0_dup_${runId}`,
      kvkkAccepted: true,
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("AUTH_EMAIL_IN_USE");
  });

  it("rejects a duplicate username with 409 AUTH_USERNAME_IN_USE", async () => {
    const res = await request(app.getHttpServer()).post("/v1/auth/signup").send({
      email: `username-${email}`,
      password,
      displayName: "Dup Username",
      username: username.toUpperCase(),
      kvkkAccepted: true,
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("AUTH_USERNAME_IN_USE");
  });

  it("allows signup without username (web collects it in onboarding)", async () => {
    const res = await request(app.getHttpServer()).post("/v1/auth/signup").send({
      email: `nousername-${email}`,
      password,
      displayName: "No Username",
      kvkkAccepted: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.user.username).toBeNull();
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

  it("avatar upload URL requires auth", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/users/me/avatar-upload-url")
      .send({ contentType: "image/png" });
    expect(res.status).toBe(401);
  });

  it("rejects unsupported avatar image types", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/users/me/avatar-upload-url")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ contentType: "image/gif" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("removes the legacy direct fake-storage upload route", async () => {
    const res = await request(app.getHttpServer())
      .put("/v1/storage/fake-upload?key=avatars/test/bad.gif&contentType=image/gif")
      .set("Content-Type", "image/png")
      .send(Buffer.from("bad"));
    expect(res.status).toBe(404);
  });

  it("uploads, saves, serves, and removes the current user's avatar", async () => {
    const uploadUrlRes = await request(app.getHttpServer())
      .post("/v1/users/me/avatar-upload-url")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ contentType: "image/png" });
    expect(uploadUrlRes.status).toBe(201);
    expect(uploadUrlRes.body.key).toMatch(/^avatars\/.+\/.+\.png$/);
    expect(uploadUrlRes.body.maxBytes).toBe(2 * 1024 * 1024);

    const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7WQAAAAASUVORK5CYII=", "base64");
    const putRes = await request(app.getHttpServer())
      .put(uploadUrlRes.body.uploadUrl)
      .set("Content-Type", "image/png")
      .send(bytes);
    expect(putRes.status).toBe(204);

    const saved = await request(app.getHttpServer())
      .patch("/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ avatarStorageKey: uploadUrlRes.body.key });
    expect(saved.status).toBe(200);
    expect(saved.body.avatarUrl).toContain("/v1/storage/fake-object");

    const objectPath = saved.body.avatarUrl.replace(/^https?:\/\/[^/]+/, "");
    const objectRes = await request(app.getHttpServer()).get(objectPath);
    expect(objectRes.status).toBe(200);
    expect(objectRes.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(objectRes.headers["content-type"]).toContain("image/png");

    const replay = await request(app.getHttpServer()).put(uploadUrlRes.body.uploadUrl)
      .set("Content-Type", "image/png").send(bytes);
    expect(replay.status).toBe(401);

    const removed = await request(app.getHttpServer())
      .patch("/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ avatarStorageKey: null });
    expect(removed.status).toBe(200);
    expect(removed.body.avatarUrl).toBeNull();
  });

  it("rejects disguised and oversized uploads before storage publication", async () => {
    const issue = () => request(app.getHttpServer()).post("/v1/users/me/avatar-upload-url")
      .set("Authorization", `Bearer ${accessToken}`).send({ contentType: "image/png" });
    const disguisedTicket = await issue();
    expect(disguisedTicket.status).toBe(201);
    const disguised = await request(app.getHttpServer()).put(disguisedTicket.body.uploadUrl)
      .set("Content-Type", "image/png").send(Buffer.from("<script>alert(1)</script>"));
    expect(disguised.status).toBe(400);

    const oversizedTicket = await issue();
    expect(oversizedTicket.status).toBe(201);
    const oversized = await request(app.getHttpServer()).put(oversizedTicket.body.uploadUrl)
      .set("Content-Type", "image/png").send(Buffer.alloc(AVATAR_MAX_BYTES + 1));
    expect(oversized.status).toBe(413);
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

  it("parallel refresh treats the loser as replay and leaves no valid descendant", async () => {
    const login = await request(app.getHttpServer()).post("/v1/auth/login").send({ email, password });
    expect(login.status).toBe(200);
    const cookie = (login.headers["set-cookie"]?.[0] ?? "").split(";")[0]!;
    const [a, b] = await Promise.all([
      request(app.getHttpServer()).post("/v1/auth/refresh").set("Cookie", cookie),
      request(app.getHttpServer()).post("/v1/auth/refresh").set("Cookie", cookie),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 401]);
    const winner = a.status === 200 ? a : b;
    const successor = (winner.headers["set-cookie"]?.[0] ?? "").split(";")[0]!;
    expect((await request(app.getHttpServer()).get("/v1/users/me")
      .set("Authorization", `Bearer ${winner.body.accessToken}`)).status).toBe(401);
    expect((await request(app.getHttpServer()).post("/v1/auth/refresh").set("Cookie", successor)).status).toBe(401);
  });

  it("suspension immediately invalidates an already-issued access token", async () => {
    const login = await request(app.getHttpServer()).post("/v1/auth/login").send({ email, password });
    const pool = app.get<Pool>(PG_POOL);
    await pool.query("update users set status = 'SUSPENDED' where id = $1", [userId]);
    try {
      expect((await request(app.getHttpServer()).get("/v1/users/me")
        .set("Authorization", `Bearer ${login.body.accessToken}`)).status).toBe(401);
    } finally {
      await pool.query("update users set status = 'ACTIVE' where id = $1", [userId]);
    }
  });

  it("role removal immediately blocks an access token carrying the old admin role", async () => {
    const pool = app.get<Pool>(PG_POOL);
    await pool.query("update users set roles = array['ADMIN']::text[] where id = $1", [userId]);
    try {
      const login = await request(app.getHttpServer()).post("/v1/auth/login").send({ email, password });
      expect(login.status).toBe(200);
      expect((await request(app.getHttpServer()).get("/v1/admin/users?page=1&pageSize=1")
        .set("Authorization", `Bearer ${login.body.accessToken}`)).status).toBe(200);

      await pool.query("update users set roles = array['STUDENT']::text[] where id = $1", [userId]);
      expect((await request(app.getHttpServer()).get("/v1/admin/users?page=1&pageSize=1")
        .set("Authorization", `Bearer ${login.body.accessToken}`)).status).toBe(403);
    } finally {
      await pool.query("update users set roles = array['STUDENT']::text[] where id = $1", [userId]);
    }
  });

  it("starts Google OAuth with state cookie and Google redirect", async () => {
    await app
      .get(ConfigRegistryService)
      .set(userId, FeatureFlag.GOOGLE_OAUTH_ENABLED, true);

    const status = await request(app.getHttpServer()).get("/v1/auth/google/status");
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({ enabled: true });

    const res = await request(app.getHttpServer()).get(
      "/v1/auth/google/start?mode=login&locale=tr&returnTo=/panel",
    );
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("accounts.google.com");
    expect(res.headers.location).toContain("scope=openid%20email%20profile");
    expect(res.headers["set-cookie"]?.[0]).toContain("mentor_google_oauth=");
  });

  it("rejects Google OAuth callback without the signed state cookie", async () => {
    const res = await request(app.getHttpServer()).get(
      "/v1/auth/google/callback?code=x&state=y1234567890123456",
    );
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("googleError=");
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

  it("password reset atomically revokes sessions and every unused sibling reset link", async () => {
    const login = await request(app.getHttpServer()).post("/v1/auth/login").send({ email, password });
    expect(login.status).toBe(200);
    await request(app.getHttpServer()).post("/v1/auth/forgot-password").send({ email }).expect(200);
    const pool = app.get<Pool>(PG_POOL);
    const result = await pool.query<{ payload: { variables?: { link?: string } } }>(
      "select payload from jobs where name = 'notifications.send-email' and payload->>'to' = $1 order by created_at desc limit 2",
      [email],
    );
    expect(result.rows).toHaveLength(2);
    const tokens = result.rows.map((row) => new URL(row.payload.variables!.link!).searchParams.get("token")!);
    const nextPassword = "YeniSifre1234";
    await request(app.getHttpServer()).post("/v1/auth/reset-password")
      .send({ token: tokens[0], password: nextPassword }).expect(200);
    const sibling = await request(app.getHttpServer()).post("/v1/auth/reset-password")
      .send({ token: tokens[1], password: "BaskaSifre1234" });
    expect(sibling.status).toBe(400);
    expect((await request(app.getHttpServer()).get("/v1/users/me")
      .set("Authorization", `Bearer ${login.body.accessToken}`)).status).toBe(401);
    expect((await request(app.getHttpServer()).post("/v1/auth/login")
      .send({ email, password })).status).toBe(401);
    expect((await request(app.getHttpServer()).post("/v1/auth/login")
      .send({ email, password: nextPassword })).status).toBe(200);
  });

  it("health stays public", async () => {
    const res = await request(app.getHttpServer()).get("/v1/health");
    expect(res.status).toBe(200);
  });
});
