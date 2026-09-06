import { beforeAll, describe, expect, it, vi } from "vitest";
import * as argon2 from "argon2";
import { googleOAuthStartQuerySchema } from "@mentor/validation";
import { ErrorCode } from "../../../common/errors/error-code";
import { GoogleLinkingService, GOOGLE_LINK_TTL_MS } from "./google-linking.service";
import type { GoogleLinkState } from "./google-oauth-state";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const SESSION_ID = "00000000-0000-4000-8000-000000000002";
const principal = { id: USER_ID, sessionId: SESSION_ID, roles: ["STUDENT"], orgId: null };
let passwordHash: string;
beforeAll(async () => { passwordHash = await argon2.hash("password123"); });

function setup() {
  const user = { id: USER_ID, email: "student@example.com", passwordHash, status: "ACTIVE", emailVerifiedAt: new Date() };
  const users = { findByIdService: vi.fn(async () => user), updateService: vi.fn() };
  const accounts = {
    findByUserProvider: vi.fn<() => Promise<unknown>>(async () => undefined),
    findByProviderSubject: vi.fn<() => Promise<unknown>>(async () => undefined),
  };
  const intents = { create: vi.fn(), consume: vi.fn(async () => true), linkActiveSession: vi.fn(async () => true) };
  const tokens = { validateSession: vi.fn(async () => principal), issue: vi.fn() };
  const service = new GoogleLinkingService(users as never, accounts as never, intents as never, tokens as never);
  const profile = { sub: "google-1", email: user.email, emailVerified: true, displayName: "Student" };
  const load = vi.fn(async () => profile);
  const state: GoogleLinkState = { mode: "link", nonce: "nonce-for-explicit-link", userId: USER_ID,
    sessionId: SESSION_ID, locale: "en", returnTo: "/en/settings", expiresAt: Date.now() + GOOGLE_LINK_TTL_MS };
  return { service, user, users, accounts, intents, tokens, profile, load, state };
}

describe("explicit Google link start", () => {
  it("rejects link mode on the public login/signup start contract", () => {
    expect(googleOAuthStartQuerySchema.safeParse({ mode: "link" }).success).toBe(false);
  });

  it("requires the current password before issuing a bound five-minute intent", async () => {
    const { service, intents, tokens } = setup();
    const state = await service.start(principal, { password: "password123", locale: "tr" });
    expect(state).toMatchObject({ mode: "link", userId: USER_ID, sessionId: SESSION_ID, returnTo: "/ayarlar" });
    expect(state.expiresAt - Date.now()).toBeLessThanOrEqual(GOOGLE_LINK_TTL_MS);
    expect(tokens.validateSession).toHaveBeenCalledWith(SESSION_ID, USER_ID);
    expect(intents.create).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_ID, sessionId: SESSION_ID }));
    expect(intents.create.mock.calls[0]?.[0]).not.toHaveProperty("nonce");
  });

  it("rejects a wrong password without creating state", async () => {
    const { service, intents } = setup();
    await expect(service.start(principal, { password: "wrong", locale: "tr" })).rejects.toMatchObject({ code: ErrorCode.AUTH_INVALID_CREDENTIALS });
    expect(intents.create).not.toHaveBeenCalled();
  });

  it("rejects an unverified password account without changing its verification", async () => {
    const { service, user, users, intents } = setup();
    Object.assign(user, { emailVerifiedAt: null });
    await expect(service.start(principal, { password: "password123", locale: "tr" })).rejects.toMatchObject({ code: ErrorCode.AUTH_GOOGLE_LINK_UNAVAILABLE });
    expect(users.updateService).not.toHaveBeenCalled();
    expect(intents.create).not.toHaveBeenCalled();
  });

  it("rejects an already linked account", async () => {
    const { service, accounts, intents } = setup();
    accounts.findByUserProvider.mockResolvedValue({ providerSubject: "existing" });
    await expect(service.start(principal, { password: "password123", locale: "tr" })).rejects.toMatchObject({ code: ErrorCode.AUTH_GOOGLE_LINK_CONFLICT });
    expect(intents.create).not.toHaveBeenCalled();
  });
});

describe("explicit Google link callback", () => {
  it("links only the password-confirmed owner and creates no login session", async () => {
    const { service, state, load, intents, tokens } = setup();
    await service.complete(state, load);
    expect(intents.consume).toHaveBeenCalledWith(expect.any(String), USER_ID, SESSION_ID);
    expect(intents.linkActiveSession).toHaveBeenCalledWith({ userId: USER_ID, sessionId: SESSION_ID, providerSubject: "google-1", providerEmail: "student@example.com" });
    expect(tokens.issue).not.toHaveBeenCalled();
  });

  it("consumes state once and rejects replay before contacting Google", async () => {
    const { service, state, load, intents } = setup();
    intents.consume.mockResolvedValueOnce(true).mockResolvedValue(false);
    await service.complete(state, load);
    await expect(service.complete(state, load)).rejects.toMatchObject({ code: ErrorCode.AUTH_GOOGLE_STATE_INVALID });
    expect(load).toHaveBeenCalledTimes(1);
    expect(intents.linkActiveSession).toHaveBeenCalledTimes(1);
  });

  it("rejects expired state", async () => {
    const { service, state, load, intents } = setup();
    state.expiresAt = Date.now() - 1;
    await expect(service.complete(state, load)).rejects.toMatchObject({ code: ErrorCode.AUTH_GOOGLE_STATE_INVALID });
    expect(intents.consume).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  });

  it("rejects cross-user state and session mismatch", async () => {
    const { service, state, load, intents } = setup();
    intents.consume.mockResolvedValue(false);
    state.userId = "00000000-0000-4000-8000-000000000003";
    await expect(service.complete(state, load)).rejects.toMatchObject({ code: ErrorCode.AUTH_GOOGLE_STATE_INVALID });
    expect(load).not.toHaveBeenCalled();
  });

  it("rejects a session revoked after password confirmation", async () => {
    const { service, state, load, intents, tokens } = setup();
    tokens.validateSession.mockRejectedValue(new Error("revoked"));
    await expect(service.complete(state, load)).rejects.toThrow("revoked");
    expect(load).not.toHaveBeenCalled();
    expect(intents.linkActiveSession).not.toHaveBeenCalled();
  });

  it.each(["email", "provider-verification", "owner-verification"])("rejects mismatched or unverified %s", async (change) => {
    const { service, state, load, profile, user, users, intents } = setup();
    if (change === "email") profile.email = "other@example.com";
    if (change === "provider-verification") profile.emailVerified = false;
    if (change === "owner-verification") Object.assign(user, { emailVerifiedAt: null });
    await expect(service.complete(state, load)).rejects.toMatchObject({ code: ErrorCode.AUTH_GOOGLE_LINK_EMAIL_MISMATCH });
    expect(intents.linkActiveSession).not.toHaveBeenCalled();
    expect(users.updateService).not.toHaveBeenCalled();
  });

  it("rejects an identity already linked to another user", async () => {
    const { service, state, load, accounts, intents } = setup();
    accounts.findByProviderSubject.mockResolvedValue({ userId: "another-user" });
    await expect(service.complete(state, load)).rejects.toMatchObject({ code: ErrorCode.AUTH_GOOGLE_LINK_CONFLICT });
    expect(intents.linkActiveSession).not.toHaveBeenCalled();
  });

  it("rejects a session revoked during provider exchange", async () => {
    const { service, state, load, intents } = setup();
    intents.linkActiveSession.mockResolvedValue(false);
    await expect(service.complete(state, load)).rejects.toMatchObject({ code: ErrorCode.AUTH_GOOGLE_LINK_UNAVAILABLE });
  });

  it("maps a concurrent provider-identity claim to a safe conflict", async () => {
    const { service, state, load, intents } = setup();
    intents.linkActiveSession.mockRejectedValue(Object.assign(new Error("unique"), { code: "23505" }));
    await expect(service.complete(state, load)).rejects.toMatchObject({ code: ErrorCode.AUTH_GOOGLE_LINK_CONFLICT });
  });
});
