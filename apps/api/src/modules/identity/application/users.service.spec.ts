import { HttpStatus } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { usernameSchema } from "@mentor/validation";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { resolveExamVariantPatch, UsersService } from "./users.service";

describe("usernameSchema", () => {
  it("normalizes valid usernames", () => {
    expect(usernameSchema.parse(" Student_01 ")).toBe("student_01");
  });

  it("rejects unsupported username characters", () => {
    expect(usernameSchema.safeParse("bad-name").success).toBe(false);
  });
});

describe("UsersService.updateMe", () => {
  it("maps duplicate username races to AUTH_USERNAME_IN_USE", async () => {
    const usersRepo = {
      updateSelf: vi.fn(async () => {
        throw Object.assign(new Error("unique"), { code: "23505" });
      }),
    };
    const service = new UsersService(usersRepo as never, {} as never, { emitAsync: vi.fn() } as never);

    await expect(
      service.updateMe("user-1", { username: "taken" }),
    ).rejects.toMatchObject({
      code: ErrorCode.AUTH_USERNAME_IN_USE,
      httpStatus: HttpStatus.CONFLICT,
    } satisfies Partial<DomainError>);
    expect(usersRepo.updateSelf).toHaveBeenCalledWith("user-1", {
      username: "taken",
    });
  });

  it("passes bio + website through to updateSelf (null clears)", async () => {
    const updated = {
      id: "user-1",
      email: "a@b.co",
      displayName: "A",
      username: null,
      avatarStorageKey: null,
      bio: "merhaba",
      website: null,
      roles: ["STUDENT"],
      organizationId: null,
      examType: null,
      examDate: null,
      emailVerifiedAt: null,
      createdAt: new Date(),
    };
    const usersRepo = { updateSelf: vi.fn(async () => updated) };
    const storage = { getPublicUrl: vi.fn() };
    const service = new UsersService(usersRepo as never, storage as never, { emitAsync: vi.fn() } as never);

    await service.updateMe("user-1", { bio: "merhaba", website: null });
    expect(usersRepo.updateSelf).toHaveBeenCalledWith("user-1", {
      bio: "merhaba",
      website: null,
    });
  });

  it("updates email and resets emailVerifiedAt to null when email changes", async () => {
    const current = {
      id: "user-1",
      email: "old@example.com",
      displayName: "Old",
      username: "olduser",
      avatarStorageKey: null,
      bio: null,
      website: null,
      roles: ["STUDENT"],
      organizationId: null,
      examType: null,
      examDate: null,
      emailVerifiedAt: new Date(),
      createdAt: new Date(),
    };
    const updated = { ...current, email: "new@example.com", emailVerifiedAt: null };
    const usersRepo = {
      findSelf: vi.fn(async () => current),
      findByEmailService: vi.fn(async () => undefined),
      updateSelf: vi.fn(async () => updated),
    };
    const storage = { getPublicUrl: vi.fn() };
    const calls: string[] = [];
    const authService = {
      invalidateOutstandingVerification: vi.fn(async () => {
        calls.push("invalidate");
      }),
      resendVerificationEmail: vi.fn(async () => {
        calls.push("resend");
      }),
    };
    const service = new UsersService(
      usersRepo as never,
      storage as never,
      { emitAsync: vi.fn() } as never,
      authService as never,
    );

    const res = await service.updateMe("user-1", { email: "new@example.com" });
    expect(res.email).toBe("new@example.com");
    expect(res.emailVerified).toBe(false);
    expect(usersRepo.updateSelf).toHaveBeenCalledWith("user-1", {
      email: "new@example.com",
      emailVerifiedAt: null,
    });
    expect(calls).toEqual(["invalidate", "resend"]);
  });

  it("rejects duplicate email with AUTH_EMAIL_IN_USE (409)", async () => {
    const current = {
      id: "user-1",
      email: "old@example.com",
      displayName: "Old",
      username: "olduser",
      roles: ["STUDENT"],
    };
    const usersRepo = {
      findSelf: vi.fn(async () => current),
      findByEmailService: vi.fn(async () => ({ id: "user-2", email: "taken@example.com" })),
      updateSelf: vi.fn(),
    };
    const service = new UsersService(usersRepo as never, {} as never, { emitAsync: vi.fn() } as never);

    await expect(
      service.updateMe("user-1", { email: "taken@example.com" }),
    ).rejects.toMatchObject({
      code: ErrorCode.AUTH_EMAIL_IN_USE,
      httpStatus: HttpStatus.CONFLICT,
    } satisfies Partial<DomainError>);
    expect(usersRepo.updateSelf).not.toHaveBeenCalled();
  });

  it("does not reset emailVerifiedAt or send verification when email is unchanged", async () => {
    const current = {
      id: "user-1",
      email: "same@example.com",
      displayName: "Same",
      username: "sameuser",
      avatarStorageKey: null,
      bio: null,
      website: null,
      roles: ["STUDENT"],
      organizationId: null,
      examType: null,
      examDate: null,
      emailVerifiedAt: new Date(),
      createdAt: new Date(),
    };
    const updated = { ...current, displayName: "Updated Name" };
    const usersRepo = {
      findSelf: vi.fn(async () => current),
      findByEmailService: vi.fn(),
      updateSelf: vi.fn(async () => updated),
    };
    const authService = {
      invalidateOutstandingVerification: vi.fn(),
      resendVerificationEmail: vi.fn(),
    };
    const service = new UsersService(
      usersRepo as never,
      { getPublicUrl: vi.fn() } as never,
      { emitAsync: vi.fn() } as never,
      authService as never,
    );

    await service.updateMe("user-1", { displayName: "Updated Name", email: "same@example.com" });
    expect(usersRepo.updateSelf).toHaveBeenCalledWith("user-1", {
      displayName: "Updated Name",
    });
    expect(usersRepo.findByEmailService).not.toHaveBeenCalled();
    expect(authService.invalidateOutstandingVerification).not.toHaveBeenCalled();
    expect(authService.resendVerificationEmail).not.toHaveBeenCalled();
  });
});

describe("resolveExamVariantPatch", () => {
  it("keeps the variant when the family is KPSS", () => {
    expect(
      resolveExamVariantPatch({ examType: "KPSS", examVariant: "ORTAOGRETIM" }, null),
    ).toEqual({ examVariant: "ORTAOGRETIM" });
  });

  it("clears the variant when switching to a family that has none", () => {
    // The leak this guards: KPSS → YKS → KPSS would otherwise keep an ORTAOGRETIM marker that
    // silently narrows the countdown and the vacancy map, with nothing in the UI showing it.
    expect(resolveExamVariantPatch({ examType: "YKS" }, "KPSS")).toEqual({
      examVariant: null,
    });
    expect(
      resolveExamVariantPatch({ examType: "LGS", examVariant: "LISANS" }, "KPSS"),
    ).toEqual({ examVariant: null });
  });

  it("resolves a lone variant change against the stored family", () => {
    expect(resolveExamVariantPatch({ examVariant: "ONLISANS" }, "KPSS")).toEqual({
      examVariant: "ONLISANS",
    });
    expect(resolveExamVariantPatch({ examVariant: "ONLISANS" }, "YKS")).toEqual({
      examVariant: null,
    });
  });

  it("leaves the column alone when neither field is being written", () => {
    expect(resolveExamVariantPatch({}, "YKS")).toEqual({});
    expect(resolveExamVariantPatch({}, "KPSS")).toEqual({});
  });
});
