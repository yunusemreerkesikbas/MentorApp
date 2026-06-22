import { describe, expect, it } from "vitest";
import { UserRole, ZoneRole } from "@mentor/types";
import { canApproveMember, canCreateZone, canModerateZone, isPlatformStaff } from "./forum.policy";

const actor = (platformRoles: string[], zoneRole: ZoneRole | null = null) => ({
  userId: "u1",
  platformRoles,
  zoneRole,
});

describe("forum.policy", () => {
  it("only platform staff create zones (curated)", () => {
    expect(canCreateZone([UserRole.ADMIN])).toBe(true);
    expect(canCreateZone([UserRole.MODERATOR])).toBe(true);
    expect(canCreateZone([UserRole.EDITOR])).toBe(true);
    expect(canCreateZone([UserRole.STUDENT])).toBe(false);
  });

  it("zone owner/mod can moderate their own zone; member cannot", () => {
    expect(canModerateZone(actor([UserRole.STUDENT], ZoneRole.OWNER))).toBe(true);
    expect(canModerateZone(actor([UserRole.STUDENT], ZoneRole.MODERATOR))).toBe(true);
    expect(canModerateZone(actor([UserRole.STUDENT], ZoneRole.MEMBER))).toBe(false);
    expect(canModerateZone(actor([UserRole.STUDENT], null))).toBe(false);
  });

  it("platform staff moderate any zone regardless of zone membership (override)", () => {
    expect(canModerateZone(actor([UserRole.ADMIN], null))).toBe(true);
    expect(canApproveMember(actor([UserRole.SUPER_ADMIN], null))).toBe(true);
  });

  it("isPlatformStaff excludes plain students", () => {
    expect(isPlatformStaff([UserRole.STUDENT])).toBe(false);
    expect(isPlatformStaff([UserRole.STUDENT, UserRole.EDITOR])).toBe(true);
  });
});
