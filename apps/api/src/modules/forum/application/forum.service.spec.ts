import { HttpStatus } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole, ZoneJoinPolicy, ZoneMemberStatus, ZoneRole, ZoneType } from "@mentor/types";
import { ForumService } from "./forum.service";

const makeRepo = () => ({
  createZone: vi.fn().mockResolvedValue({
    id: "z1", type: "QA", title: "Genel", slug: "genel-abc", description: null,
    visibility: "PUBLIC", joinPolicy: "OPEN", examType: null, isArchived: false,
    createdAt: new Date("2026-06-22T00:00:00Z"),
  }),
  findById: vi.fn(),
  findBySlug: vi.fn(),
  listPublic: vi.fn(),
  upsertMember: vi.fn().mockResolvedValue({}),
  findMembership: vi.fn().mockResolvedValue(null),
  findMembershipPrivileged: vi.fn().mockResolvedValue(null),
  listMembers: vi.fn(),
  searchActiveMembers: vi.fn().mockResolvedValue([]),
  setMemberStatus: vi.fn(),
  deleteMember: vi.fn(),
  memberCount: vi.fn().mockResolvedValue(0),
  listOwnerAndMods: vi.fn().mockResolvedValue([]),
  zoneSlug: vi.fn().mockResolvedValue(null),
});

const config = { get: vi.fn().mockResolvedValue(true) };
const events = { emit: vi.fn() };
const posts = { authorActivityStats: vi.fn() };
const storage = { getPublicUrl: vi.fn((key: string) => `https://cdn/${key}`) };

describe("ForumService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let svc: ForumService;

  beforeEach(() => {
    vi.clearAllMocks();
    config.get.mockResolvedValue(true);
    repo = makeRepo();
    svc = new ForumService(repo as never, posts as never, config as never, events as never, storage as never);
  });

  it("404s when the feature flag is off", async () => {
    config.get.mockResolvedValue(false);
    await expect(svc.listZones("u1", [], { page: 1, pageSize: 20 } as never)).rejects.toMatchObject({
      httpStatus: HttpStatus.NOT_FOUND,
    });
  });

  it("blocks zone creation for non-staff", async () => {
    await expect(
      svc.createZone([UserRole.STUDENT], "u1", {
        type: ZoneType.QA, title: "Genel", joinPolicy: ZoneJoinPolicy.OPEN,
      } as never),
    ).rejects.toMatchObject({ httpStatus: HttpStatus.FORBIDDEN });
  });

  it("staff creates a zone", async () => {
    const view = await svc.createZone([UserRole.ADMIN], "u1", {
      type: ZoneType.QA, title: "Genel", joinPolicy: ZoneJoinPolicy.OPEN,
    } as never);
    expect(repo.createZone).toHaveBeenCalledOnce();
    expect(view.id).toBe("z1");
  });

  it("OPEN join is immediately ACTIVE, no event", async () => {
    const r = await svc.join("z1", "u2", ZoneJoinPolicy.OPEN);
    expect(r.status).toBe(ZoneMemberStatus.ACTIVE);
    expect(repo.upsertMember).toHaveBeenCalledWith("z1", "u2", "MEMBER", ZoneMemberStatus.ACTIVE);
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("REQUEST join is PENDING and emits member.requested with resolved recipients", async () => {
    repo.zoneSlug.mockResolvedValue("genel-abc");
    repo.listOwnerAndMods.mockResolvedValue(["owner1", "mod1"]);
    const r = await svc.join("z1", "u2", ZoneJoinPolicy.REQUEST);
    expect(r.status).toBe(ZoneMemberStatus.PENDING);
    expect(events.emit).toHaveBeenCalledWith("forum.member.requested", {
      zoneId: "z1",
      slug: "genel-abc",
      requesterId: "u2",
      moderatorIds: ["owner1", "mod1"],
    });
  });

  it("an already-ACTIVE member re-joining is a no-op", async () => {
    repo.findMembership.mockResolvedValue({ status: ZoneMemberStatus.ACTIVE });
    const r = await svc.join("z1", "u2", ZoneJoinPolicy.REQUEST);
    expect(r.status).toBe(ZoneMemberStatus.ACTIVE);
    expect(repo.upsertMember).not.toHaveBeenCalled();
  });

  it("non-staff non-owner cannot approve members", async () => {
    await expect(
      svc.approveMember({ userId: "u1", platformRoles: [UserRole.STUDENT], zoneRole: null }, "z1", "u2", true),
    ).rejects.toMatchObject({ httpStatus: HttpStatus.FORBIDDEN });
  });

  it("approveMember(false) deletes the membership row instead of setting PENDING", async () => {
    await svc.approveMember({ userId: "u1", platformRoles: [UserRole.ADMIN], zoneRole: null }, "z1", "u2", false);
    expect(repo.deleteMember).toHaveBeenCalledWith("z1", "u2");
    expect(repo.setMemberStatus).not.toHaveBeenCalled();
  });

  describe("searchMembers (@mention autocomplete)", () => {
    const zone = { id: "z1", type: ZoneType.CHAT };

    it("rejects a non-member (and never hits the repo)", async () => {
      repo.findById.mockResolvedValue(zone);
      await expect(
        svc.searchMembers({ userId: "u1", platformRoles: [UserRole.STUDENT], zoneRole: null }, null, "z1", "em"),
      ).rejects.toMatchObject({ httpStatus: HttpStatus.FORBIDDEN });
      expect(repo.searchActiveMembers).not.toHaveBeenCalled();
    });

    it("404s on an unknown zone", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        svc.searchMembers({ userId: "u1", platformRoles: [UserRole.ADMIN], zoneRole: null }, null, "zX", "em"),
      ).rejects.toMatchObject({ httpStatus: HttpStatus.NOT_FOUND });
    });

    it("ACTIVE member searches; avatar keys resolve to public URLs", async () => {
      repo.findById.mockResolvedValue(zone);
      repo.searchActiveMembers.mockResolvedValue([
        { username: "emre", displayName: "Emre E.", avatarStorageKey: "a/emre.webp" },
        { username: "emel", displayName: "Emel K.", avatarStorageKey: null },
      ]);
      const out = await svc.searchMembers(
        { userId: "u1", platformRoles: [UserRole.STUDENT], zoneRole: ZoneRole.MEMBER },
        ZoneMemberStatus.ACTIVE,
        "z1",
        "em",
      );
      expect(repo.searchActiveMembers).toHaveBeenCalledWith("z1", "em");
      expect(out).toEqual([
        { username: "emre", displayName: "Emre E.", avatarUrl: "https://cdn/a/emre.webp" },
        { username: "emel", displayName: "Emel K.", avatarUrl: null },
      ]);
    });

    it("platform staff may search without membership", async () => {
      repo.findById.mockResolvedValue(zone);
      repo.searchActiveMembers.mockResolvedValue([]);
      await expect(
        svc.searchMembers({ userId: "u1", platformRoles: [UserRole.ADMIN], zoneRole: null }, null, "z1", "em"),
      ).resolves.toEqual([]);
    });
  });

  describe("removeMember", () => {
    it("returns NOT_FOUND when target is not a member", async () => {
      repo.findMembershipPrivileged.mockResolvedValue(null);
      await expect(
        svc.removeMember({ userId: "u1", platformRoles: [UserRole.ADMIN], zoneRole: null }, "z1", "u2"),
      ).rejects.toMatchObject({ httpStatus: HttpStatus.NOT_FOUND });
    });

    it("returns FORBIDDEN when target is OWNER", async () => {
      repo.findMembershipPrivileged.mockResolvedValue({ role: ZoneRole.OWNER, status: "ACTIVE" });
      await expect(
        svc.removeMember({ userId: "u1", platformRoles: [UserRole.ADMIN], zoneRole: null }, "z1", "u2"),
      ).rejects.toMatchObject({ httpStatus: HttpStatus.FORBIDDEN });
    });

    it("removes a regular member successfully", async () => {
      repo.findMembershipPrivileged.mockResolvedValue({ role: ZoneRole.MEMBER, status: "ACTIVE" });
      await svc.removeMember({ userId: "u1", platformRoles: [UserRole.ADMIN], zoneRole: null }, "z1", "u2");
      expect(repo.deleteMember).toHaveBeenCalledWith("z1", "u2");
    });
  });
});
