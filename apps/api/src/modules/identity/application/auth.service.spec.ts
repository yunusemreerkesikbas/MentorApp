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
    {} as never,
  );

  return { emailTokenRepo, queue, service };
}

describe("AuthService coach signup gate", () => {
  function makeSignupService(
    open: boolean,
    admission: { pilot: boolean; role?: "student" | "coach" } = { pilot: false },
  ) {
    const usersRepo = {
      findByEmailService: vi.fn(async () => undefined),
      createService: vi.fn(async (input: Record<string, unknown>) => ({
        id: "user-1",
        email: input.email,
        roles: input.roles ?? ["STUDENT"],
        organizationId: null,
        displayName: "Ayşe",
        createdAt: new Date(),
        emailVerifiedAt: null,
      })),
    };
    const invitations = {
      findInvited: vi.fn(async () => (admission.role ? { role: admission.role } : null)),
      deleteByEmail: vi.fn(async () => undefined),
    };
    const configRegistry = {
      get: vi.fn(async (key: string) => {
        if (key === "signup.enabled") return true;
        if (key === "signup.pilot.enabled") return admission.pilot;
        return key === "mentorship.applications.open" ? open : 0;
      }),
    };
    const service = new AuthService(
      usersRepo as never,
      {} as never,
      { issue: vi.fn(async () => ({})) } as never,
      { assertValid: vi.fn(async () => undefined) } as never,
      {} as never,
      configRegistry as never,
      {} as never,
      { getPublicUrl: vi.fn() } as never,
      {} as never,
      {} as never,
      invitations as never,
    );
    (service as unknown as { sendEmailToken: unknown }).sendEmailToken = vi.fn(async () => undefined);
    return { usersRepo, invitations, service };
  }

  const signupInput = {
    email: "ayse@ornek.com",
    password: "Sifre1234",
    displayName: "Ayşe",
    kvkkAccepted: true as const,
    termsAccepted: true as const,
    ageEligibilityConfirmed: true as const,
  };

  it("invited coach becomes COACH while applications are closed", async () => {
    const { usersRepo, service } = makeSignupService(false, { pilot: true, role: "coach" });

    await service.signup(signupInput);

    expect(usersRepo.createService).toHaveBeenCalledWith(
      expect.objectContaining({ roles: ["STUDENT", "COACH"] }),
    );
  });

  it("invited student asking for COACH stays a student", async () => {
    const { usersRepo, service } = makeSignupService(true, { pilot: true, role: "student" });

    await service.signup({ ...signupInput, intent: "COACH" });

    expect(usersRepo.createService.mock.calls[0]![0]).not.toHaveProperty("roles");
  });

  it("open mode keeps the intent and applications rule", async () => {
    const { usersRepo, service } = makeSignupService(false, { pilot: false });

    await expect(service.signup({ ...signupInput, intent: "COACH" })).rejects.toMatchObject({
      code: ErrorCode.MENTORSHIP_APPLICATIONS_CLOSED,
    });
    expect(usersRepo.createService).not.toHaveBeenCalled();
  });

  it("open mode with COACH intent and open applications makes a coach", async () => {
    const { usersRepo, service } = makeSignupService(true, { pilot: false });

    await service.signup({ ...signupInput, intent: "COACH" });

    expect(usersRepo.createService).toHaveBeenCalledWith(
      expect.objectContaining({ roles: ["STUDENT", "COACH"] }),
    );
  });

  it("signup deletes the invitation", async () => {
    const { invitations, service } = makeSignupService(true, { pilot: true, role: "student" });

    await service.signup(signupInput);

    expect(invitations.deleteByEmail).toHaveBeenCalledWith("ayse@ornek.com");
  });

  it("still completes signup when invitation cleanup rejects", async () => {
    const { invitations, service } = makeSignupService(true, { pilot: true, role: "student" });
    invitations.deleteByEmail.mockRejectedValue(new Error("db down"));

    await expect(service.signup(signupInput)).resolves.toMatchObject({ user: { email: "ayse@ornek.com" } });
    expect((service as unknown as { sendEmailToken: ReturnType<typeof vi.fn> }).sendEmailToken).toHaveBeenCalled();
  });

  it("open mode also clears a stale waiting row of the new account", async () => {
    const { invitations, service } = makeSignupService(true, { pilot: false });

    await service.signup(signupInput);

    expect(invitations.deleteByEmail).toHaveBeenCalledWith("ayse@ornek.com");
  });

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

  it("uses atomic tryClaimVerificationResendAttempt to prevent parallel TOCTOU resend bursts", async () => {
    const { emailTokenRepo, queue, service } = makeService(0);
    let claimed = 0;
    const tryClaimVerificationResendAttempt = vi.fn(async () => {
      claimed += 1;
      return claimed === 1 ? ("allowed" as const) : ("rate_limited" as const);
    });
    Object.assign(emailTokenRepo, { tryClaimVerificationResendAttempt });

    const results = await Promise.allSettled([
      service.resendVerificationEmail(USER.id),
      service.resendVerificationEmail(USER.id),
      service.resendVerificationEmail(USER.id),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(2);
    expect(queue.enqueue).toHaveBeenCalledTimes(1);
    expect(tryClaimVerificationResendAttempt).toHaveBeenCalledTimes(3);
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
