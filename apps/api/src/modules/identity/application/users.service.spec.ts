import { HttpStatus } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { usernameSchema } from "@mentor/validation";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { UsersService } from "./users.service";

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
    const service = new UsersService(usersRepo as never, {} as never);

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
    const service = new UsersService(usersRepo as never, storage as never);

    await service.updateMe("user-1", { bio: "merhaba", website: null });
    expect(usersRepo.updateSelf).toHaveBeenCalledWith("user-1", {
      bio: "merhaba",
      website: null,
    });
  });
});
