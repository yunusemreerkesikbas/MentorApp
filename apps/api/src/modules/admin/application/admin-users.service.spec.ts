import { beforeEach, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";
import { ErrorCode } from "../../../common/errors/error-code";
import { DomainError } from "../../../common/errors/domain-error";
import { AdminUsersService } from "./admin-users.service";
import type { AdminUserRow } from "../infrastructure/admin-users.repository";

function makeUser(id: string, roles: string[]): AdminUserRow {
  return {
    id,
    email: `${id}@test.local`,
    passwordHash: "x",
    displayName: id,
    roles,
    organizationId: null,
    examType: null,
    examDate: null,
    emailVerifiedAt: null,
    kvkkAcceptedAt: new Date(),
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as AdminUserRow;
}

/** In-memory fake mirroring the SERVICE-context repo (read-compute-write is atomic here). */
function makeRepoFake(users: Map<string, AdminUserRow>) {
  return {
    search: async () => [...users.values()],
    findById: async (id: string) => users.get(id),
    setRoles: async (id: string, compute: (roles: string[]) => string[]) => {
      const row = users.get(id);
      if (!row) return undefined;
      const before = row.roles;
      const after = compute(before);
      users.set(id, { ...row, roles: after });
      return { before, after };
    },
  };
}

describe("AdminUsersService", () => {
  let users: Map<string, AdminUserRow>;
  let service: AdminUsersService;

  beforeEach(() => {
    users = new Map([["u1", makeUser("u1", [UserRole.STUDENT])]]);
    service = new AdminUsersService(makeRepoFake(users) as never);
  });

  it("grants STAFF and reports the before/after diff", async () => {
    const res = await service.grantStaff("u1");
    expect(res.before).toEqual([UserRole.STUDENT]);
    expect(res.after).toContain(UserRole.STAFF);
    expect(res.user.isStaff).toBe(true);
  });

  it("grant is idempotent (no duplicate STAFF)", async () => {
    await service.grantStaff("u1");
    const res = await service.grantStaff("u1");
    expect(res.after.filter((r) => r === UserRole.STAFF)).toHaveLength(1);
  });

  it("revokes STAFF and keeps other roles", async () => {
    await service.grantStaff("u1");
    const res = await service.revokeStaff("u1");
    expect(res.after).toEqual([UserRole.STUDENT]);
    expect(res.user.isStaff).toBe(false);
  });

  it("revoke is idempotent on a non-staff user", async () => {
    const res = await service.revokeStaff("u1");
    expect(res.after).toEqual([UserRole.STUDENT]);
  });

  it("throws ADMIN_USER_NOT_FOUND for a missing user", async () => {
    await expect(service.grantStaff("missing")).rejects.toMatchObject({
      constructor: DomainError,
      code: ErrorCode.ADMIN_USER_NOT_FOUND,
    });
  });

  it("never exposes the password hash in the view", async () => {
    const res = await service.grantStaff("u1");
    expect(res.user).not.toHaveProperty("passwordHash");
  });
});
