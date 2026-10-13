import { describe, expect, it, vi } from "vitest";
import { UserStatus } from "../domain/identity.constants";
import { DomainError } from "../../../common/errors/domain-error";
import { AuthService } from "./auth.service";
import { GoogleAuthService, type GoogleOAuthProfile, type GoogleOAuthState } from "./google-auth.service";

const user = {
  id: "student-id", email: "student@example.com", displayName: "Student", roles: ["STUDENT"],
  status: UserStatus.ACTIVE, organizationId: null, emailVerifiedAt: null,
  examType: null, examVariant: null, examDate: null, username: null, avatarStorageKey: null,
  createdAt: new Date(),
};
const state: GoogleOAuthState = {
  nonce: "nonce", mode: "signup", locale: "tr", returnTo: "/dashboard",
  kvkkAccepted: true, termsAccepted: true, ageEligibilityConfirmed: true,
  expiresAt: Date.now() + 60_000,
};

function fixture(open: boolean, pilot: boolean, emails: string[] = [], linked = false) {
  const values: Record<string, boolean | number> = {
    "signup.enabled": open, "signup.pilot.enabled": pilot, "signup.pilot.max_invited_emails": 50,
    "identity.google_oauth.enabled": true, "identity.verification_email.token_ttl_seconds": 180,
    "mentorship.applications.open": true,
  };
  const registry = {
    get: vi.fn(async (key: string) => values[key]),
  };
  const config = { get: vi.fn(() => "http://localhost:3000"), getOrThrow: vi.fn(() => emails) };
  const repo = {
    findByEmailService: vi.fn(async () => undefined), findByIdService: vi.fn(async () => user),
    createService: vi.fn(async () => user),
  };
  const tokens = { issue: vi.fn(async () => ({ accessToken: "access", refreshToken: "refresh" })) };
  const captcha = { assertValid: vi.fn(async () => undefined) };
  const emailTokens = { create: vi.fn(async () => undefined) };
  const storage = { getPublicUrl: vi.fn(() => "/avatar") };
  const accounts = {
    findByProviderSubject: vi.fn(async () => linked ? { userId: user.id } : undefined),
    create: vi.fn(async () => undefined),
  };
  const password = new AuthService(repo as never, emailTokens as never, tokens as never, captcha as never,
    config as never, registry as never, {} as never, storage as never, {} as never, {} as never);
  const google = new GoogleAuthService(config as never, registry as never, repo as never,
    accounts as never, tokens as never, storage as never, {} as never);
  (google as unknown as { exchangeCode: () => Promise<GoogleOAuthProfile> }).exchangeCode = async () => ({
    sub: "google-sub", email: user.email, emailVerified: true, displayName: user.displayName,
  });
  return { repo, tokens, captcha, emailTokens, accounts, google,
    passwordSignup: () => password.signup({ email: user.email, password: "Password123", displayName: user.displayName,
      kvkkAccepted: true, termsAccepted: true, ageEligibilityConfirmed: true }) };
}

describe.each(["password", "google"] as const)("%s account admission", (flow) => {
  it.each([
    { open: false, pilot: false, emails: [], error: "AUTH_SIGNUP_CLOSED" },
    { open: false, pilot: true, emails: [user.email], error: "AUTH_SIGNUP_CLOSED" },
    { open: true, pilot: true, emails: [], error: "AUTH_PILOT_INVITATION_REQUIRED" },
    { open: true, pilot: true, emails: ["other@example.com"], error: "AUTH_PILOT_INVITATION_REQUIRED" },
  ])("refuses $error before account/token side effects", async ({ open, pilot, emails, error }) => {
    const f = fixture(open, pilot, emails);
    await expect(flow === "password" ? f.passwordSignup() : f.google.callback("code", state))
      .rejects.toMatchObject({ code: error, httpStatus: 403 });
    expect(f.repo.createService).not.toHaveBeenCalled();
    expect(f.tokens.issue).not.toHaveBeenCalled();
    expect(f.emailTokens.create).not.toHaveBeenCalled();
    expect(f.accounts.create).not.toHaveBeenCalled();
    if (flow === "password") expect(f.captcha.assertValid).toHaveBeenCalledOnce();
  });

  it.each([false, true])("accepts an eligible account when pilot=%s", async (pilot) => {
    const f = fixture(true, pilot, pilot ? [user.email] : []);
    await expect(flow === "password" ? f.passwordSignup() : f.google.callback("code", state))
      .resolves.toMatchObject({ user: { email: user.email } });
    expect(f.repo.createService).toHaveBeenCalledOnce();
    expect(f.tokens.issue).toHaveBeenCalledOnce();
    if (flow === "password") expect(f.emailTokens.create).toHaveBeenCalledOnce();
  });
});

it("preserves existing Google login when admission is closed and the address is not invited", async () => {
  const f = fixture(false, true, [], true);
  await expect(f.google.callback("code", { ...state, mode: "login" })).resolves.toMatchObject({ user: { email: user.email } });
  expect(f.repo.createService).not.toHaveBeenCalled();
  expect(f.accounts.create).not.toHaveBeenCalled();
});

it("an invitation never bypasses the password CAPTCHA boundary", async () => {
  const f = fixture(true, true, [user.email]);
  f.captcha.assertValid.mockRejectedValue(new DomainError("AUTH_TURNSTILE_FAILED", 403));
  await expect(f.passwordSignup()).rejects.toMatchObject({ code: "AUTH_TURNSTILE_FAILED" });
  expect(f.repo.createService).not.toHaveBeenCalled();
  expect(f.tokens.issue).not.toHaveBeenCalled();
});
