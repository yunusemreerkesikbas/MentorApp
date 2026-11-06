import { randomBytes } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import * as argon2 from "argon2";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigRegistryService } from "../src/common/config/config-registry.service";
import type { Env } from "../src/config/env.validation";
import { PG_POOL } from "../src/database/database.constants";
import { GoogleAuthService, signGoogleOAuthState, type GoogleOAuthProfile, type GoogleOAuthState } from "../src/modules/identity/application/google-auth.service";
import { CURRENT_TERMS_VERSION, GOOGLE_OAUTH_STATE_COOKIE } from "../src/modules/identity/domain/identity.constants";
import { SignupInvitationRepository } from "../src/modules/identity/infrastructure/signup-invitation.repository";
import { UsersRepository } from "../src/modules/identity/infrastructure/users.repository";
import { createTestApp } from "./app-harness";
import request from "./browser-request";

describe("invited signup boundary (real PostgreSQL)", () => {
  let app: INestApplication;
  let registry: ConfigRegistryService;
  let config: ConfigService<Env, true>;
  let pool: Pool;
  let actorId: string;
  let invitations: SignupInvitationRepository;
  let users: UsersRepository;
  let exchange: ReturnType<typeof vi.fn>;
  const runId = Date.now();
  const passwordEmail = `pilot-password-${runId}@test.local`;
  const googleEmail = `pilot-google-${runId}@test.local`;
  const password = "Password123";
  const coachEmail = `pilot-coach-${runId}@test.local`;
  const legal = { kvkkAccepted: true, termsAccepted: true, ageEligibilityConfirmed: true };
  const body = (email: string) => ({ email, password, displayName: "Pilot Student", ...legal });

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    const { AppModule } = await import("../src/app.module");
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = createTestApp(module, { authRateLimits: false });
    config = module.get(ConfigService);
    pool = module.get(PG_POOL);
    registry = module.get(ConfigRegistryService);
    invitations = module.get(SignupInvitationRepository);
    users = module.get(UsersRepository);
    actorId = (await users.createService({
      email: `pilot-operator-${runId}@test.local`, displayName: "Pilot Fixture",
      passwordHash: "unused-fixture-hash",
      kvkkAcceptedAt: new Date(), termsAcceptedAt: new Date(), termsVersion: CURRENT_TERMS_VERSION,
      ageEligibilityConfirmedAt: new Date(),
    })).id;
    exchange = vi.fn();
    const google = module.get(GoogleAuthService) as unknown as { exchangeCode: (code: string) => Promise<GoogleOAuthProfile> };
    google.exchangeCode = exchange;
    await app.init();
  }, 90_000);

  beforeEach(async () => {
    await registry.set(actorId, "signup.enabled", true);
    await registry.set(actorId, "signup.pilot.enabled", true);
    await registry.set(actorId, "signup.pilot.max_invited_emails", 50);
    await registry.set(actorId, "identity.google_oauth.enabled", true);
    await registry.set(actorId, "mentorship.applications.open", true);
    await pool.query("DELETE FROM signup_invitations WHERE email = ANY($1)", [[passwordEmail, googleEmail, coachEmail]]);
    for (const email of [passwordEmail, googleEmail]) {
      await invitations.upsertInvited({ email, role: "student", locale: "tr", invitedBy: actorId });
    }
    exchange.mockReset();
  });

  afterAll(async () => {
    if (registry && actorId) {
      await registry.set(actorId, "signup.enabled", true);
      await registry.set(actorId, "signup.pilot.enabled", false);
      await registry.set(actorId, "signup.pilot.max_invited_emails", 50);
      await registry.set(actorId, "identity.google_oauth.enabled", false);
    }
    await pool?.query("DELETE FROM signup_invitations WHERE email = ANY($1)", [[passwordEmail, googleEmail, coachEmail]]);
    await app?.close();
  });

  async function expectNoAccount(email: string): Promise<void> {
    const result = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    expect(result.rows).toEqual([]);
  }

  function oauth(email: string, locale: "tr" | "en", verified = true) {
    const nonce = "pilot-fixture-nonce-1234567890";
    const state: GoogleOAuthState = { nonce, mode: "signup", locale,
      returnTo: "/dashboard", ...legal, expiresAt: Date.now() + 60_000 };
    exchange.mockResolvedValue({ sub: `pilot-sub-${email}`, email, emailVerified: verified, displayName: "Pilot Google" });
    return request(app.getHttpServer()).get(`/v1/auth/google/callback?code=fixture-code&state=${nonce}`)
      .set("Cookie", `${GOOGLE_OAUTH_STATE_COOKIE}=${signGoogleOAuthState(state, config.get("JWT_ACCESS_SECRET", { infer: true }))}`);
  }

  it("global closure rejects even an invited password signup without a session", async () => {
    await registry.set(actorId, "signup.enabled", false);
    const result = await request(app.getHttpServer()).post("/v1/auth/signup").send(body(passwordEmail));
    expect(result.status).toBe(403);
    expect(result.body.code).toBe("AUTH_SIGNUP_CLOSED");
    expect(result.headers["set-cookie"]).toBeUndefined();
    await expectNoAccount(passwordEmail);
  });

  it.each(["tr", "en"] as const)("pilot password signup has a generic localized %s error", async (locale) => {
    const email = `outsider-${locale}-${runId}@test.local`;
    const result = await request(app.getHttpServer()).post("/v1/auth/signup").set("Accept-Language", locale).send(body(email));
    expect(result.status).toBe(403);
    expect(result.body.code).toBe("AUTH_SIGNUP_CLOSED");
    expect(result.body.message).toContain(locale === "tr" ? "Yeni kayıtlar" : "New registrations");
    expect(JSON.stringify(result.body)).not.toContain(passwordEmail);
    expect(result.headers["set-cookie"]).toBeUndefined();
    await expectNoAccount(email);
  });

  it("does not create an account or session for an invited email without mailbox proof", async () => {
    const result = await request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send(body(passwordEmail));

    expect(result.status).toBe(403);
    expect(result.body.code).toBe("AUTH_SIGNUP_CLOSED");
    expect(result.headers["set-cookie"]).toBeUndefined();
    await expectNoAccount(passwordEmail);
    expect(await invitations.findInvited(passwordEmail)).toMatchObject({ role: "student" });
  });

  it("an address without an invited row admits nobody", async () => {
    await pool.query("DELETE FROM signup_invitations WHERE email = $1", [passwordEmail]);
    const result = await request(app.getHttpServer()).post("/v1/auth/signup").send(body(passwordEmail));
    expect(result.body.code).toBe("AUTH_SIGNUP_CLOSED");
    await expectNoAccount(passwordEmail);
  });

  it("a waiting row does not admit", async () => {
    await pool.query("DELETE FROM signup_invitations WHERE email = $1", [coachEmail]);
    await invitations.insertWaiting({ email: coachEmail, role: "student", locale: "tr" });
    const result = await request(app.getHttpServer()).post("/v1/auth/signup").send(body(coachEmail));
    expect(result.body.code).toBe("AUTH_SIGNUP_CLOSED");
    await expectNoAccount(coachEmail);
  });

  it("normalizes open password signup and retains email verification", async () => {
    await registry.set(actorId, "signup.pilot.enabled", false);
    const result = await request(app.getHttpServer()).post("/v1/auth/signup").send(body(` ${passwordEmail.toUpperCase()} `));
    expect(result.status).toBe(201);
    expect(result.body.user).toMatchObject({ email: passwordEmail, emailVerified: false });
    expect(result.headers["set-cookie"]?.join(";")).toContain("HttpOnly");
    const left = await pool.query("SELECT 1 FROM signup_invitations WHERE email = $1", [passwordEmail]);
    expect(left.rows).toEqual([]);
  });

  it("an invited coach cannot claim a pilot account with just a password", async () => {
    await registry.set(actorId, "mentorship.applications.open", false);
    await invitations.upsertInvited({ email: coachEmail, role: "coach", locale: "tr", invitedBy: actorId });
    const result = await request(app.getHttpServer()).post("/v1/auth/signup").send(body(coachEmail));
    expect(result.status).toBe(403);
    expect(result.body.code).toBe("AUTH_SIGNUP_CLOSED");
    await expectNoAccount(coachEmail);
  });

  it("a prepared tester can set a password through email and sign in with registration closed", async () => {
    await registry.set(actorId, "signup.enabled", false);
    const email = `pilot-prepared-${runId}@test.local`;
    const acceptedAt = new Date();
    await users.createService({
      email, displayName: "Prepared Pilot Tester",
      passwordHash: await argon2.hash(randomBytes(32).toString("base64url")),
      kvkkAcceptedAt: acceptedAt, termsAcceptedAt: acceptedAt, termsVersion: CURRENT_TERMS_VERSION,
      ageEligibilityConfirmedAt: acceptedAt,
    });
    expect(await invitations.findInvited(email)).toBeNull();
    await request(app.getHttpServer()).post("/v1/auth/forgot-password").send({ email }).expect(200);
    const { rows: [job] } = await pool.query<{ payload: { variables: { link: string } } }>(
      "select payload from jobs where name = 'notifications.send-email' and payload->>'to' = $1 order by created_at desc limit 1",
      [email],
    );
    const token = job && new URL(job.payload.variables.link).searchParams.get("token");
    expect(token).toBeTruthy();
    await request(app.getHttpServer()).post("/v1/auth/reset-password").send({ token, password }).expect(200);
    const result = await request(app.getHttpServer()).post("/v1/auth/login").send({ email, password });
    expect(result.status).toBe(200);
    expect(result.body.user.email).toBe(email);
  });

  it.each(["tr", "en"] as const)("uninvited Google creation redirects with a safe localized %s message", async (locale) => {
    const email = `google-outsider-${locale}-${runId}@test.local`;
    const result = await oauth(email, locale);
    expect(result.status).toBe(302);
    const location = new URL(result.headers.location);
    expect(location.pathname).toBe(locale === "tr" ? "/kayit" : "/en/signup");
    expect(location.searchParams.get("davet")).toBe("1");
    expect(location.searchParams.get("googleErrorCode")).toBe("AUTH_PILOT_INVITATION_REQUIRED");
    expect(location.searchParams.get("googleError")).toContain(locale === "tr" ? "davet listesinde" : "invitation");
    expect(location.toString()).not.toContain(passwordEmail);
    expect(result.headers["set-cookie"]?.join(";")).not.toContain("mentor_web_refresh");
    await expectNoAccount(email);
  });

  it("closed registration also blocks invited Google creation", async () => {
    await registry.set(actorId, "signup.enabled", false);
    const result = await oauth(googleEmail, "tr");
    expect(new URL(result.headers.location).searchParams.get("googleErrorCode")).toBe("AUTH_SIGNUP_CLOSED");
    await expectNoAccount(googleEmail);
  });

  it("an invited address cannot bypass Google email verification", async () => {
    const result = await oauth(googleEmail, "tr", false);
    expect(new URL(result.headers.location).searchParams.get("googleErrorCode")).toBe("AUTH_GOOGLE_EMAIL_UNVERIFIED");
    await expectNoAccount(googleEmail);
  });

  it("admits a verified invited Google identity and permits its later login with admission shut", async () => {
    const created = await oauth(googleEmail, "tr");
    expect(new URL(created.headers.location).pathname).toBe("/baslangic");
    expect(created.headers["set-cookie"]?.join(";")).toContain("mentor_web_refresh");
    await registry.set(actorId, "signup.enabled", false);
    const login = await oauth(googleEmail, "tr");
    expect(login.headers["set-cookie"]?.join(";")).toContain("mentor_web_refresh");
  });

  it("the invitation list is absent from admin config and public auth status", async () => {
    expect(JSON.stringify(await registry.list())).not.toContain(passwordEmail);
    const result = await request(app.getHttpServer()).get("/v1/auth/google/status");
    expect(JSON.stringify(result.body)).not.toContain(passwordEmail);
    expect(JSON.stringify(result.body)).not.toContain("PILOT_INVITED_EMAILS");
  });
});
