import { describe, expect, it } from "vitest";
import { UserRole, ZoneMemberStatus, ZoneRole, ZoneType } from "@mentor/types";
import {
  canAcceptAnswer,
  canApproveMember,
  canCommentInZone,
  canCreateZone,
  canDeleteThread,
  canLeaveZone,
  canModerateZone,
  canPostInZone,
  canRemoveMember,
  canSearchMembers,
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

  describe("canCommentInZone", () => {
    it("CHAT + ANNOUNCEMENT: any ACTIVE member (or staff) may comment; announcement discussion is open", () => {
      const member = actor([UserRole.STUDENT], ZoneRole.MEMBER);
      expect(canCommentInZone(member, ZoneType.CHAT, ZoneMemberStatus.ACTIVE)).toBe(true);
      // Unlike posting, a plain member CAN comment on an announcement.
      expect(canCommentInZone(member, ZoneType.ANNOUNCEMENT, ZoneMemberStatus.ACTIVE)).toBe(true);
      expect(canCommentInZone(member, ZoneType.CHAT, ZoneMemberStatus.PENDING)).toBe(false);
      expect(canCommentInZone(member, ZoneType.CHAT, null)).toBe(false);
      expect(canCommentInZone(actor([UserRole.ADMIN], null), ZoneType.ANNOUNCEMENT, null)).toBe(true);
    });

    it("QA is not a comment surface (answers path only)", () => {
      expect(
        canCommentInZone(actor([UserRole.STUDENT], ZoneRole.MEMBER), ZoneType.QA, ZoneMemberStatus.ACTIVE),
      ).toBe(false);
    });
  });

  describe("canPostInZone — QA", () => {
    it("QA needs an ACTIVE member (or staff), like CHAT", () => {
      const member = actor([UserRole.STUDENT], ZoneRole.MEMBER);
      expect(canPostInZone(member, ZoneType.QA, ZoneMemberStatus.ACTIVE)).toBe(true);
      expect(canPostInZone(member, ZoneType.QA, ZoneMemberStatus.PENDING)).toBe(false);
      expect(canPostInZone(member, ZoneType.QA, null)).toBe(false);
      expect(canPostInZone(actor([UserRole.ADMIN], null), ZoneType.QA, null)).toBe(true);
    });
  });

  describe("canSearchMembers", () => {
    it("any ACTIVE member may search; pending/non-members may not", () => {
      const member = actor([UserRole.STUDENT], ZoneRole.MEMBER);
      expect(canSearchMembers(member, ZoneMemberStatus.ACTIVE)).toBe(true);
      expect(canSearchMembers(member, ZoneMemberStatus.PENDING)).toBe(false);
      expect(canSearchMembers(actor([UserRole.STUDENT], null), null)).toBe(false);
    });

    it("platform staff may search without membership (override)", () => {
      expect(canSearchMembers(actor([UserRole.ADMIN], null), null)).toBe(true);
    });
  });

  describe("canAcceptAnswer", () => {
    it("only the question author may accept (no staff override)", () => {
      expect(canAcceptAnswer(actor([UserRole.STUDENT]), "u1", "answerer")).toBe(true); // actor.userId === "u1"
      expect(canAcceptAnswer(actor([UserRole.STUDENT]), "someoneElse", "answerer")).toBe(false);
      expect(canAcceptAnswer(actor([UserRole.ADMIN]), "someoneElse", "answerer")).toBe(false);
    });

    it("rejects accepting your own answer (self-accept XP farm)", () => {
      // Asker "u1" answered their own question — accept must be denied.
      expect(canAcceptAnswer(actor([UserRole.STUDENT]), "u1", "u1")).toBe(false);
    });
  });

  describe("canLeaveZone", () => {
    it("member/mod/non-member may leave; OWNER may not (zone must not go ownerless)", () => {
      expect(canLeaveZone(ZoneRole.MEMBER)).toBe(true);
      expect(canLeaveZone(ZoneRole.MODERATOR)).toBe(true);
      expect(canLeaveZone(null)).toBe(true); // pending requester canceling
      expect(canLeaveZone(ZoneRole.OWNER)).toBe(false);
    });
  });

  describe("canRemoveMember", () => {
    it("OWNER cannot be removed by anyone", () => {
      expect(canRemoveMember(actor([UserRole.ADMIN], null), ZoneRole.OWNER)).toBe(false);
      expect(canRemoveMember(actor([UserRole.STUDENT], ZoneRole.OWNER), ZoneRole.OWNER)).toBe(false);
    });

    it("zone owner/mod can remove a regular MEMBER", () => {
      expect(canRemoveMember(actor([UserRole.STUDENT], ZoneRole.OWNER), ZoneRole.MEMBER)).toBe(true);
      expect(canRemoveMember(actor([UserRole.STUDENT], ZoneRole.MODERATOR), ZoneRole.MEMBER)).toBe(true);
    });

    it("platform staff can remove a MEMBER or MODERATOR", () => {
      expect(canRemoveMember(actor([UserRole.ADMIN], null), ZoneRole.MEMBER)).toBe(true);
      expect(canRemoveMember(actor([UserRole.ADMIN], null), ZoneRole.MODERATOR)).toBe(true);
    });

    it("a plain MEMBER cannot remove anyone", () => {
      expect(canRemoveMember(actor([UserRole.STUDENT], ZoneRole.MEMBER), ZoneRole.MEMBER)).toBe(false);
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
