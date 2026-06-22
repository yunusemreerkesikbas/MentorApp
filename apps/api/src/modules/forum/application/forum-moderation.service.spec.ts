import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpStatus } from "@nestjs/common";
import { ModerationTargetType, ReportReason, UserRole, ZoneRole } from "@mentor/types";
import { ForumModerationService } from "./forum-moderation.service";

const report = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  targetType: ModerationTargetType.POST,
  targetId: "p1",
  zoneId: "z1",
  reporterId: "reporter",
  reason: ReportReason.SPAM,
  note: null,
  status: "OPEN",
  resolvedBy: null,
  resolvedAt: null,
  createdAt: new Date("2026-06-22T10:00:00Z"),
  ...over,
});

const makeReports = () => ({
  create: vi.fn().mockResolvedValue(undefined),
  findById: vi.fn().mockResolvedValue(report()),
  listByZone: vi.fn().mockResolvedValue([report()]),
  listAll: vi.fn().mockResolvedValue([report()]),
  setResolved: vi.fn().mockResolvedValue(undefined),
  appendAction: vi.fn().mockResolvedValue(undefined),
});
const makeThreads = () => ({
  findById: vi.fn().mockResolvedValue({ id: "t1", zoneId: "z1" }),
  findByIdIncludingDeleted: vi.fn().mockResolvedValue({ id: "t1", zoneId: "z1" }),
  softDelete: vi.fn().mockResolvedValue(undefined),
  restore: vi.fn().mockResolvedValue(undefined),
});
const makePosts = () => ({
  findById: vi.fn().mockResolvedValue({ id: "p1", threadId: "t1" }),
  findByIdIncludingDeleted: vi.fn().mockResolvedValue({ id: "p1", threadId: "t1" }),
  softDelete: vi.fn().mockResolvedValue(undefined),
  restore: vi.fn().mockResolvedValue(undefined),
});
const makeZones = (role: ZoneRole | null) => ({
  findMembership: vi.fn().mockResolvedValue(role ? { role, status: "ACTIVE" } : null),
});
const config = { get: vi.fn().mockResolvedValue(true) };
const actor = (id: string, roles: string[] = [UserRole.STUDENT]) => ({ id, roles });

describe("ForumModerationService", () => {
  let reports: ReturnType<typeof makeReports>;
  let threads: ReturnType<typeof makeThreads>;
  let posts: ReturnType<typeof makePosts>;

  beforeEach(() => {
    reports = makeReports();
    threads = makeThreads();
    posts = makePosts();
  });

  const svc = (role: ZoneRole | null) =>
    new ForumModerationService(
      reports as never,
      threads as never,
      posts as never,
      makeZones(role) as never,
      config as never,
    );

  it("report resolves the target's zone and creates (idempotent)", async () => {
    await svc(null).report(actor("u1"), {
      targetType: ModerationTargetType.POST,
      targetId: "p1",
      reason: ReportReason.SPAM,
    });
    expect(reports.create).toHaveBeenCalledWith(
      expect.objectContaining({ targetId: "p1", zoneId: "z1", reporterId: "u1" }),
    );
  });

  it("a non-moderator cannot read the zone queue", async () => {
    await expect(
      svc(ZoneRole.MEMBER).listZoneReports(actor("u1"), "z1", { page: 1, pageSize: 20 }),
    ).rejects.toMatchObject({ httpStatus: HttpStatus.FORBIDDEN });
  });

  it("a zone owner reads the zone queue", async () => {
    const res = await svc(ZoneRole.OWNER).listZoneReports(actor("u1"), "z1", { page: 1, pageSize: 20 });
    expect(res.items).toHaveLength(1);
  });

  it("only platform staff read the global queue", async () => {
    await expect(
      svc(null).listAllReports(actor("u1"), { page: 1, pageSize: 20 }),
    ).rejects.toMatchObject({ httpStatus: HttpStatus.FORBIDDEN });
    const res = await svc(null).listAllReports(actor("admin", [UserRole.ADMIN]), { page: 1, pageSize: 20 });
    expect(res.items).toHaveLength(1);
  });

  it("resolve HIDE soft-deletes the target, logs HIDE, and marks RESOLVED", async () => {
    await svc(ZoneRole.OWNER).resolve(actor("owner"), "r1", { action: "HIDE" });
    expect(posts.softDelete).toHaveBeenCalledWith("p1", "owner");
    expect(reports.appendAction).toHaveBeenCalledWith(expect.objectContaining({ action: "HIDE", actorScope: "ROOM" }));
    expect(reports.setResolved).toHaveBeenCalledWith("r1", "RESOLVED", "owner");
  });

  it("resolve DISMISS logs DISMISS and marks DISMISSED without hiding", async () => {
    await svc(ZoneRole.OWNER).resolve(actor("owner"), "r1", { action: "DISMISS" });
    expect(posts.softDelete).not.toHaveBeenCalled();
    expect(reports.appendAction).toHaveBeenCalledWith(expect.objectContaining({ action: "DISMISS" }));
    expect(reports.setResolved).toHaveBeenCalledWith("r1", "DISMISSED", "owner");
  });

  it("a non-moderator cannot resolve", async () => {
    await expect(
      svc(ZoneRole.MEMBER).resolve(actor("u1"), "r1", { action: "HIDE" }),
    ).rejects.toMatchObject({ httpStatus: HttpStatus.FORBIDDEN });
  });

  it("platform staff resolve logs PLATFORM scope", async () => {
    await svc(null).resolve(actor("admin", [UserRole.ADMIN]), "r1", { action: "HIDE" });
    expect(reports.appendAction).toHaveBeenCalledWith(expect.objectContaining({ actorScope: "PLATFORM" }));
  });

  it("restore reverses a hidden post and logs RESTORE", async () => {
    await svc(ZoneRole.OWNER).restore(actor("owner"), ModerationTargetType.POST, "p1");
    expect(posts.restore).toHaveBeenCalledWith("p1");
    expect(reports.appendAction).toHaveBeenCalledWith(expect.objectContaining({ action: "RESTORE" }));
  });
});
