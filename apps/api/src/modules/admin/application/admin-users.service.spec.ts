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
    updateStatus: async (id: string, status: string) => {
      const row = users.get(id);
      if (!row) return undefined;
      const before = row.status;
      users.set(id, { ...row, status });
      return { before, after: status };
    },
    anonymize: async (id: string) => {
      const row = users.get(id);
      if (!row) return undefined;
      const before = { email: row.email, displayName: row.displayName, status: row.status };
      const after = {
        email: `deleted+${id}@anonymized.local`,
        displayName: "Silinmiş Kullanıcı",
        status: "BANNED",
      };
      users.set(id, { ...row, ...after, examType: null, examDate: null });
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

  it("getDetail returns identity fields without secrets", async () => {
    const d = await service.getDetail("u1");
    expect(d.email).toBe("u1@test.local");
    expect(d).not.toHaveProperty("passwordHash");
    expect(d.emailVerified).toBe(false);
  });

  it("setStatus changes status with before/after", async () => {
    const res = await service.setStatus("admin", "u1", "SUSPENDED");
    expect(res.before).toBe("ACTIVE");
    expect(res.after).toBe("SUSPENDED");
    expect(res.user.status).toBe("SUSPENDED");
  });

  it("setStatus rejects acting on self (ADMIN_CANNOT_MODIFY_SELF)", async () => {
    await expect(service.setStatus("u1", "u1", "BANNED")).rejects.toMatchObject({
      constructor: DomainError,
      code: ErrorCode.ADMIN_CANNOT_MODIFY_SELF,
    });
  });

  it("anonymize scrubs PII and bans, rejecting self", async () => {
    const res = await service.anonymize("admin", "u1");
    expect(res.after).toMatchObject({ status: "BANNED", displayName: "Silinmiş Kullanıcı" });
    expect(res.user.email).toContain("anonymized.local");
    expect(res.user.status).toBe("BANNED");
    await expect(service.anonymize("u1", "u1")).rejects.toMatchObject({
      code: ErrorCode.ADMIN_CANNOT_MODIFY_SELF,
    });
  });
});
