import { describe, expect, it, vi } from "vitest";
import { ErrorCode } from "../../../common/errors/error-code";
import { AuthProvider, UserStatus } from "../domain/identity.constants";
import {
  GoogleAuthService,
  type GoogleOAuthProfile,
  signGoogleOAuthState,
  type GoogleOAuthState,
  verifyGoogleOAuthState,
} from "./google-auth.service";

const STATE: GoogleOAuthState = {
  nonce: "nonce-1234567890",
  mode: "signup",
  locale: "tr",
  returnTo: "/dashboard",
  kvkkAccepted: true,
  expiresAt: Date.now() + 60_000,
};

describe("Google OAuth state", () => {
  it("round-trips signed state", () => {
    const cookie = signGoogleOAuthState(STATE, "secret");

    expect(verifyGoogleOAuthState(cookie, "secret")).toEqual(STATE);
  });

  it("rejects tampered state", () => {
    const cookie = signGoogleOAuthState(STATE, "secret");

    expect(verifyGoogleOAuthState(`${cookie}x`, "secret")).toBeNull();
  });
});

describe("Google OAuth status", () => {
  it("requires the admin flag and credentials", async () => {
    const service = new GoogleAuthService(
      { get: () => "configured" } as never,
      { get: async () => false } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.status()).resolves.toEqual({
      enabled: false,
      flagEnabled: false,
      configured: true,
    });
  });

  it("explains when credentials are missing", async () => {
    const service = new GoogleAuthService(
      { get: () => undefined } as never,
      { get: async () => true } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.status()).resolves.toEqual({
      enabled: false,
      flagEnabled: true,
      configured: false,
    });
  });

  it("is enabled when the admin flag and credentials are present", async () => {
    const service = new GoogleAuthService(
      { get: () => "configured" } as never,
      { get: async () => true } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.status()).resolves.toEqual({
      enabled: true,
      flagEnabled: true,
      configured: true,
    });
  });

  it("rejects callback while the admin flag is disabled", async () => {
    const service = new GoogleAuthService(
      { get: () => "configured" } as never,
      { get: async () => false } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const exchangeCode = vi.fn();
    (
      service as unknown as {
        exchangeCode: typeof exchangeCode;
      }
    ).exchangeCode = exchangeCode;

    await expect(service.callback("code", STATE)).rejects.toMatchObject({
      code: ErrorCode.AUTH_GOOGLE_UNAVAILABLE,
    });
    expect(exchangeCode).not.toHaveBeenCalled();
  });

  it("maps Google token exchange failures to an auth error", async () => {
    const service = new GoogleAuthService(
      { get: () => "configured" } as never,
      { get: async () => true } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    (
      service as unknown as {
        client: () => { getToken: () => Promise<never> };
      }
    ).client = () => ({
      getToken: async () => {
        throw new Error("invalid_grant");
      },
    });

    await expect(
      (
        service as unknown as {
          exchangeCode: (code: string) => Promise<GoogleOAuthProfile>;
        }
      ).exchangeCode("code"),
    ).rejects.toMatchObject({
      code: ErrorCode.AUTH_GOOGLE_STATE_INVALID,
    });
  });
});

describe("Google OAuth linking", () => {
  it("rejects when the email account is already linked to another Google subject", async () => {
    const user = {
      id: "user-1",
      email: "student@test.local",
      displayName: "Student",
      roles: ["STUDENT"],
      status: UserStatus.ACTIVE,
      organizationId: null,
      emailVerifiedAt: new Date(),
      examType: null,
      examDate: null,
      avatarStorageKey: null,
      username: null,
      kvkkAcceptedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const unique = Object.assign(new Error("unique"), { code: "23505" });
    const service = new GoogleAuthService(
      { get: () => "configured" } as never,
      { get: async () => true } as never,
      { findByEmailService: vi.fn(async () => user) } as never,
      {
        findByProviderSubject: vi.fn(async () => undefined),
        findByUserProvider: vi.fn(async () => ({
          userId: user.id,
          provider: AuthProvider.GOOGLE,
          providerSubject: "other-sub",
        })),
        create: vi.fn(async () => {
          throw unique;
        }),
      } as never,
      { issue: vi.fn() } as never,
      {} as never,
    );
    (
      service as unknown as {
        exchangeCode: (code: string) => Promise<GoogleOAuthProfile>;
      }
    ).exchangeCode = async () => ({
      sub: "new-sub",
      email: user.email,
      emailVerified: true,
      displayName: user.displayName,
    });

    await expect(service.callback("code", STATE)).rejects.toMatchObject({
      code: ErrorCode.AUTH_GOOGLE_ACCOUNT_NOT_FOUND,
    });
  });
});

describe("Google OAuth redirect", () => {
  it("keeps users without usernames in onboarding", () => {
    const service = new GoogleAuthService(
      { get: () => "http://localhost:3000" } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    expect(
      service.redirectUrl(STATE, {
        examType: "KPSS",
        username: null,
      } as never),
    ).toBe("http://localhost:3000/baslangic");
  });
});
