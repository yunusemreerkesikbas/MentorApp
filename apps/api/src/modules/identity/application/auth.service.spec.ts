import { HttpStatus } from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { signupSchema } from "@mentor/validation";
import { EmailTokenType } from "../domain/identity.constants";
import { AuthService } from "./auth.service";

const USER = {
  id: "user-1",
  email: "student@example.com",
  displayName: "Student",
  emailVerifiedAt: null,
};

function makeService(count: number) {
  const usersRepo = {
    findByIdService: vi.fn(async () => USER),
    findByEmailService: vi.fn(async () => USER),
  };
  const emailTokenRepo = {
    countVerificationResendAttemptsSince: vi.fn(async () => count),
    createVerificationResendAttempt: vi.fn(async () => undefined),
    create: vi.fn(async (input, _email, enqueue) => { await enqueue({}); return { id: "token-1", ...input }; }),
    consume: vi.fn(async () => undefined),
  };
  const config = {
    get: vi.fn(() => "http://localhost:3000"),
  };
  const configRegistry = {
    get: vi.fn(async (key: string) => {
      if (key === "identity.verification_email.resend_limit") return 1;
      if (key === "identity.verification_email.resend_window_seconds") return 180;
      if (key === "identity.verification_email.token_ttl_seconds") return 180;
      return 0;
    }),
  };
  const queue = {
    enqueue: vi.fn(async (_name: string, _payload: unknown) => undefined),
  };
  const storage = {
    getPublicUrl: vi.fn((key: string) => `/storage/${key}`),
  };

  const service = new AuthService(
    usersRepo as never,
    emailTokenRepo as never,
    {} as never,
    { assertValid: vi.fn(async () => undefined) } as never,
    config as never,
    configRegistry as never,
    queue as never,
    storage as never,
    {} as never, { consumeAccount: vi.fn(async () => ({ allowed: true })) } as never,
  );

  return { emailTokenRepo, queue, service };
}

describe("AuthService coach signup gate", () => {
  function makeSignupService(open: boolean) {
    const usersRepo = {
      findByEmailService: vi.fn(async () => undefined),
      createService: vi.fn(),
    };
    const configRegistry = {
      get: vi.fn(async (key: string) => {
        if (key === "signup.enabled") return true;
        if (key === "signup.pilot.enabled") return false;
        return key === "mentorship.applications.open" ? open : 0;
      }),
    };
    const service = new AuthService(
      usersRepo as never,
      {} as never,
      {} as never,
      { assertValid: vi.fn(async () => undefined) } as never,
      {} as never,
      configRegistry as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { usersRepo, service };
  }

  it("refuses a coach signup while the intake is shut, before any account exists", async () => {
    const { usersRepo, service } = makeSignupService(false);

    await expect(
      service.signup({
        email: "koc@example.com",
        password: "Sifre1234",
        displayName: "Koç",
        kvkkAccepted: true,
        termsAccepted: true,
        ageEligibilityConfirmed: true,
        intent: "COACH",
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.MENTORSHIP_APPLICATIONS_CLOSED,
      httpStatus: HttpStatus.FORBIDDEN,
    } satisfies Partial<DomainError>);
    expect(usersRepo.findByEmailService).not.toHaveBeenCalled();
    expect(usersRepo.createService).not.toHaveBeenCalled();
  });

  it("reports the intake the way the signup screen reads it", async () => {
    await expect(makeSignupService(true).service.coachSignupStatus()).resolves.toEqual({ open: true });
    await expect(makeSignupService(false).service.coachSignupStatus()).resolves.toEqual({ open: false });
  });
});

describe("signup legal acknowledgements", () => {
  const base = {
    email: "student@example.com",
    password: "Sifre1234",
    displayName: "Student",
    kvkkAccepted: true as const,
  };

  it("rejects signup when terms acceptance is missing", () => {
    expect(signupSchema.safeParse({ ...base, ageEligibilityConfirmed: true }).success).toBe(false);
  });

  it("rejects signup when the 13+ eligibility declaration is missing", () => {
    expect(signupSchema.safeParse({ ...base, termsAccepted: true }).success).toBe(false);
  });

  it("accepts signup only when both legal declarations are affirmative", () => {
    expect(
      signupSchema.safeParse({
        ...base,
        termsAccepted: true,
        ageEligibilityConfirmed: true,
      }).success,
    ).toBe(true);
  });
});

describe("AuthService.verifyEmail", () => {
  it("does not mark the address verified when the token is already closed", async () => {
    const usersRepo = { updateService: vi.fn() };
    const events = { emitAsync: vi.fn() };
    const service = new AuthService(
      usersRepo as never,
      { verify: vi.fn(async () => ({ status: "invalid" })) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      events as never,
      {} as never,
    );

    await expect(service.verifyEmail({ token: "stale" })).rejects.toMatchObject({
      code: ErrorCode.AUTH_TOKEN_INVALID,
      httpStatus: HttpStatus.BAD_REQUEST,
    } satisfies Partial<DomainError>);
    expect(usersRepo.updateService).not.toHaveBeenCalled();
    expect(events.emitAsync).not.toHaveBeenCalled();
  });
});

describe("AuthService.resendVerificationEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects when the configured resend window limit is reached", async () => {
    const { emailTokenRepo, queue, service } = makeService(1);

    await expect(service.resendVerificationEmail(USER.id)).rejects.toMatchObject({
      code: ErrorCode.AUTH_VERIFICATION_EMAIL_RATE_LIMITED,
      httpStatus: HttpStatus.TOO_MANY_REQUESTS,
    } satisfies Partial<DomainError>);
    expect(emailTokenRepo.createVerificationResendAttempt).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("records an attempt and sends a verification link when under limit", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-05T10:00:00.000Z"));
    const { emailTokenRepo, queue, service } = makeService(0);

    try {
      await service.resendVerificationEmail(USER.id);

      expect(emailTokenRepo.createVerificationResendAttempt).toHaveBeenCalledWith(
        USER.id,
      );
      expect(emailTokenRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER.id,
          type: EmailTokenType.VERIFY_EMAIL,
          expiresAt: new Date("2026-07-05T10:03:00.000Z"),
        }),
        USER.email,
        expect.any(Function),
      );
      expect(queue.enqueue).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("AuthService queued email locale", () => {
  it.each([
    { locale: "en", lang: "en", path: "/en/verify-email" },
    { locale: "en-US", lang: "en", path: "/en/verify-email" },
    { locale: "tr", lang: "tr", path: "/eposta-dogrula" },
    { locale: undefined, lang: "tr", path: "/eposta-dogrula" },
  ])("preserves $locale for verification copy and its destination", async ({ locale, lang, path }) => {
    const context = vi.spyOn(I18nContext, "current").mockReturnValue(
      locale ? { lang: locale } as never : undefined,
    );
    const { queue, service } = makeService(0);
    try {
      await service.resendVerificationEmail(USER.id);
      const payload = queue.enqueue.mock.calls[0]?.[1] as unknown as {
        variables: { lang: string; link: string };
      };
      expect(payload.variables.lang).toBe(lang);
      expect(new URL(payload.variables.link).pathname).toBe(path);
      expect(new URL(payload.variables.link).searchParams.get("token")).toBeTruthy();
    } finally {
      context.mockRestore();
    }
  });

  it("keeps an English reset email on the English reset page", async () => {
    const context = vi.spyOn(I18nContext, "current").mockReturnValue({ lang: "en" } as never);
    const { queue, service } = makeService(0);
    try {
      await service.forgotPassword({ email: USER.email });
      const payload = queue.enqueue.mock.calls[0]?.[1] as unknown as {
        template: string;
        variables: { lang: string; link: string };
      };
      expect(payload.template).toBe("identity.reset-password");
      expect(payload.variables.lang).toBe("en");
      expect(new URL(payload.variables.link).pathname).toBe("/en/reset-password");
    } finally {
      context.mockRestore();
    }
  });
});
