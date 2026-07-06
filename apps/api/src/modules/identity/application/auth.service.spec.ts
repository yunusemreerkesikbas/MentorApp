import { HttpStatus } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
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
  };
  const emailTokenRepo = {
    countVerificationResendAttemptsSince: vi.fn(async () => count),
    createVerificationResendAttempt: vi.fn(async () => undefined),
    create: vi.fn(async (input) => ({ id: "token-1", ...input })),
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
    enqueue: vi.fn(async () => undefined),
  };
  const storage = {
    getPublicUrl: vi.fn((key: string) => `/storage/${key}`),
  };

  const service = new AuthService(
    usersRepo as never,
    emailTokenRepo as never,
    {} as never,
    {} as never,
    config as never,
    configRegistry as never,
    queue as never,
    storage as never,
  );

  return { emailTokenRepo, queue, service };
}

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
      );
      expect(queue.enqueue).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
