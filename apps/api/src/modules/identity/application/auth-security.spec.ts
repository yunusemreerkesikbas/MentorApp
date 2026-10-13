import { describe, expect, it, vi } from "vitest";
import { forgotPasswordSchema, googleOAuthStartQuerySchema, loginSchema } from "@mentor/validation";
import { AuthService } from "./auth.service";
import { AuthRateLimitService } from "./auth-rate-limit.service";
import { authRateBucket } from "../presentation/auth-throttler.guard";
import * as argon2 from "argon2";

vi.mock("argon2", () => ({ hash: vi.fn(), verify: vi.fn() }));

function setup() {
  const users = { findByEmailService: vi.fn(async () => undefined) };
  const tokens = { resetPassword: vi.fn() };
  const emailTokens = { inspectReset: vi.fn(async () => "invalid"), create: vi.fn() };
  const turnstile = { assertValid: vi.fn(async () => undefined) };
  const rates = { consumeAccount: vi.fn(async () => ({ allowed: false, retryAfter: 123 })) };
  const service = new AuthService(users as never, emailTokens as never, tokens as never,
    turnstile as never, { get: vi.fn(() => "production") } as never,
    {} as never, {} as never, {} as never, {} as never, rates as never);
  return { service, users, tokens, emailTokens, turnstile, rates };
}

describe("authentication security gates", () => {
  it("checks the login challenge before spending the account quota or reading a password", async () => {
    const { service, users, turnstile, rates } = setup();
    turnstile.assertValid.mockRejectedValue(new Error("challenge"));
    await expect(service.login({ email: "a@test.local", password: "Password1" })).rejects.toThrow("challenge");
    expect(turnstile.assertValid).toHaveBeenCalledWith(undefined, "login");
    expect(rates.consumeAccount).not.toHaveBeenCalled();
    expect(users.findByEmailService).not.toHaveBeenCalled();
  });

  it("returns a retry time before password work when the account limit is spent", async () => {
    const { service, users, rates } = setup();
    await expect(service.login({ email: "a@test.local", password: "Password1" }))
      .rejects.toMatchObject({ httpStatus: 429, details: { retryAfter: 123 } });
    expect(rates.consumeAccount).toHaveBeenCalledWith("login", "a@test.local");
    expect(users.findByEmailService).not.toHaveBeenCalled();
  });

  it.each([undefined, "other@test.local"])("rejects missing/mismatched Access identity before admin password work", async (email) => {
    const { service, users, turnstile, rates } = setup();
    await expect(service.loginAdmin({ email: "a@test.local", password: "Password1" }, email))
      .rejects.toMatchObject({ httpStatus: 403 });
    expect(users.findByEmailService).not.toHaveBeenCalled();
    expect(turnstile.assertValid).not.toHaveBeenCalled();
    expect(rates.consumeAccount).not.toHaveBeenCalled();
  });

  it("silently skips exhausted forgot-password requests after the action-specific challenge", async () => {
    const { service, users, turnstile, emailTokens } = setup();
    await expect(service.forgotPassword({ email: "unknown@test.local", turnstileToken: "valid" })).resolves.toBeUndefined();
    expect(turnstile.assertValid).toHaveBeenCalledWith("valid", "forgot-password");
    expect(users.findByEmailService).not.toHaveBeenCalled();
    expect(emailTokens.create).not.toHaveBeenCalled();
  });

  it("rejects unknown reset tokens before password hashing or locked consumption", async () => {
    const { service, tokens } = setup();
    const hash = vi.mocked(argon2.hash);
    hash.mockClear();
    await expect(service.resetPassword({ token: "unknown", password: "Password1" }))
      .rejects.toMatchObject({ code: "AUTH_TOKEN_INVALID" });
    expect(tokens.resetPassword).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
  });

  it("normalizes account HMAC keys and separates account/IP scopes", async () => {
    const repo = { consume: vi.fn(async (_key: string, _limit: number, _window: number, _gap?: number) => ({ allowed: true, retryAfter: 0 })) };
    const service = new AuthRateLimitService(repo as never,
      { getOrThrow: vi.fn(() => "test-secret-00000000000000000000000") } as never,
      { get: vi.fn(async () => 10) } as never);
    await service.consumeAccount("login", " USER@test.local ");
    await service.consumeAccount("login", "user@test.local");
    await service.consumeIp("login", "user@test.local");
    const keys = repo.consume.mock.calls.map((call) => call[0]);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).not.toBe(keys[2]);
    expect(keys[0]).toMatch(/^[a-f0-9]{64}$/);
  });

  it("retains per-route bucket policies", () => {
    expect(authRateBucket("/auth/admin/login")).toBe("login");
    expect(authRateBucket("/auth/google/status")).toBe("other");
    expect(authRateBucket("/auth/google/start")).toBe("oauth");
    expect(authRateBucket("/auth/verify-email")).toBe("verify");
    expect(authRateBucket("/auth/reset-password")).toBe("reset");
  });

  it("bounds optional challenge tokens and narrowly accepts the existing phone return suffix", () => {
    expect(loginSchema.safeParse({ email: "a@test.local", password: "x", turnstileToken: "x".repeat(2049) }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: "a@test.local", turnstileToken: "x".repeat(2049) }).success).toBe(false);
    expect(googleOAuthStartQuerySchema.safeParse({ returnTo: "/settings?section=phone" }).success).toBe(true);
    for (const returnTo of ["//evil.test", "/\\evil", "/settings?x=phone", "/settings?section=phone&x=1"])
      expect(googleOAuthStartQuerySchema.safeParse({ returnTo }).success).toBe(false);
  });
});
