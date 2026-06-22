import { describe, expect, it } from "vitest";
import { UserRole, ZoneMemberStatus, ZoneRole, ZoneType } from "@mentor/types";
import {
  canApproveMember,
  canCreateZone,
  canDeleteThread,
  canModerateZone,
  canPostInZone,
  isPlatformStaff,
} from "./forum.policy";

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

  describe("canPostInZone", () => {
    it("CHAT: only an ACTIVE member (or staff) may post", () => {
      const member = actor([UserRole.STUDENT], ZoneRole.MEMBER);
      expect(canPostInZone(member, ZoneType.CHAT, ZoneMemberStatus.ACTIVE)).toBe(true);
      expect(canPostInZone(member, ZoneType.CHAT, ZoneMemberStatus.PENDING)).toBe(false);
      expect(canPostInZone(member, ZoneType.CHAT, null)).toBe(false);
      expect(canPostInZone(actor([UserRole.ADMIN], null), ZoneType.CHAT, null)).toBe(true);
    });

    it("ANNOUNCEMENT: only owner/mod/staff may post; a plain ACTIVE member cannot", () => {
      expect(
        canPostInZone(actor([UserRole.STUDENT], ZoneRole.MEMBER), ZoneType.ANNOUNCEMENT, ZoneMemberStatus.ACTIVE),
      ).toBe(false);
      expect(
        canPostInZone(actor([UserRole.STUDENT], ZoneRole.OWNER), ZoneType.ANNOUNCEMENT, ZoneMemberStatus.ACTIVE),
      ).toBe(true);
      expect(
        canPostInZone(actor([UserRole.MODERATOR], null), ZoneType.ANNOUNCEMENT, null),
      ).toBe(true);
    });
  });

  describe("canDeleteThread", () => {
    it("author may delete own; non-author member may not; owner/staff may delete any", () => {
      expect(canDeleteThread(actor([UserRole.STUDENT], ZoneRole.MEMBER), "u1")).toBe(true); // author
      expect(canDeleteThread(actor([UserRole.STUDENT], ZoneRole.MEMBER), "other")).toBe(false);
      expect(canDeleteThread(actor([UserRole.STUDENT], ZoneRole.OWNER), "other")).toBe(true);
      expect(canDeleteThread(actor([UserRole.ADMIN], null), "other")).toBe(true);
    });
  });
});
