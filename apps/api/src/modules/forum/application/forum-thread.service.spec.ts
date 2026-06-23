import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpStatus } from "@nestjs/common";
import { UserRole, ZoneMemberStatus, ZoneRole, ZoneType } from "@mentor/types";
import { ForumThreadService } from "./forum-thread.service";

const threadRow = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "t1",
  zoneId: "z1",
  authorId: "author",
  title: null,
  body: "merhaba",
  status: "OPEN",
  acceptedPostId: null,
  isPinned: false,
  deletedAt: null,
  deletedBy: null,
  createdAt: new Date("2026-06-22T10:00:00Z"),
  updatedAt: new Date("2026-06-22T10:00:00Z"),
  ...over,
});

const makeThreadRepo = () => ({
  createThread: vi.fn().mockResolvedValue(threadRow()),
  listFeed: vi.fn().mockResolvedValue([]),
  findById: vi.fn().mockResolvedValue(threadRow()),
  setPinned: vi.fn().mockResolvedValue(undefined),
  softDelete: vi.fn().mockResolvedValue(undefined),
  addReaction: vi.fn().mockResolvedValue(undefined),
  removeReaction: vi.fn().mockResolvedValue(undefined),
  reactionCountsByThread: vi.fn().mockResolvedValue(new Map()),
  myReactionsByThread: vi.fn().mockResolvedValue(new Map()),
});

const makeZoneRepo = (
  zoneType: ZoneType = ZoneType.CHAT,
  memberStatus: string | null = ZoneMemberStatus.ACTIVE,
) => ({
  findById: vi.fn().mockResolvedValue({ id: "z1", type: zoneType }),
  findMembership: vi
    .fn()
    .mockResolvedValue(memberStatus ? { role: ZoneRole.MEMBER, status: memberStatus } : null),
});

const enabledConfig = { get: vi.fn().mockResolvedValue(true) };
const events = { emit: vi.fn() };

const actor = (roles: string[]) => ({ id: "u1", roles });

describe("ForumThreadService", () => {
  let threadRepo: ReturnType<typeof makeThreadRepo>;

  beforeEach(() => {
    threadRepo = makeThreadRepo();
    events.emit.mockClear();
  });

  const svc = (zoneRepo: ReturnType<typeof makeZoneRepo>) =>
    new ForumThreadService(threadRepo as never, zoneRepo as never, enabledConfig as never, events as never);

  it("rejects a non-member posting in a CHAT zone", async () => {
    const zoneRepo = makeZoneRepo(ZoneType.CHAT, null);
    await expect(
      svc(zoneRepo).postThread(actor([UserRole.STUDENT]), "z1", { body: "hi" }),
    ).rejects.toMatchObject({ httpStatus: HttpStatus.FORBIDDEN });
    expect(threadRepo.createThread).not.toHaveBeenCalled();
  });

  it("lets an ACTIVE member post in CHAT and emits THREAD_POSTED", async () => {
    const zoneRepo = makeZoneRepo(ZoneType.CHAT, ZoneMemberStatus.ACTIVE);
    const view = await svc(zoneRepo).postThread(actor([UserRole.STUDENT]), "z1", { body: "hi" });
    expect(view.id).toBe("t1");
    expect(threadRepo.createThread).toHaveBeenCalledWith({
      zoneId: "z1",
      authorId: "u1",
      body: "hi",
      title: null,
    });
    expect(events.emit).toHaveBeenCalledWith("forum.thread.posted", expect.objectContaining({ threadId: "t1" }));
  });

  it("rejects a plain member posting in an ANNOUNCEMENT zone", async () => {
    const zoneRepo = makeZoneRepo(ZoneType.ANNOUNCEMENT, ZoneMemberStatus.ACTIVE);
    await expect(
      svc(zoneRepo).postThread(actor([UserRole.STUDENT]), "z1", { body: "duyuru" }),
    ).rejects.toMatchObject({ httpStatus: HttpStatus.FORBIDDEN });
  });

  it("lets staff post in an ANNOUNCEMENT zone even without membership", async () => {
    const zoneRepo = makeZoneRepo(ZoneType.ANNOUNCEMENT, null);
    const view = await svc(zoneRepo).postThread(actor([UserRole.ADMIN]), "z1", { body: "duyuru" });
    expect(view.id).toBe("t1");
  });

  it("listFeed folds in reaction counts + my reactions and returns nextCursor when full", async () => {
    const zoneRepo = makeZoneRepo();
    threadRepo.listFeed.mockResolvedValue([threadRow({ id: "t1" }), threadRow({ id: "t2" })]);
    threadRepo.reactionCountsByThread.mockResolvedValue(new Map([["t1", { "👍": 3 }]]));
    threadRepo.myReactionsByThread.mockResolvedValue(new Map([["t1", ["👍"]]]));
    const feed = await svc(zoneRepo).listFeed("u1", "z1", { limit: 2 });
    expect(feed.items).toHaveLength(2);
    expect(feed.items[0]!.reactionCounts).toEqual({ "👍": 3 });
    expect(feed.items[0]!.myReactions).toEqual(["👍"]);
    expect(feed.nextCursor).toBe(feed.items[1]!.createdAt); // limit reached → there may be more
  });

  it("blocks delete by a non-author non-mod, allows the author", async () => {
    const zoneRepo = makeZoneRepo(ZoneType.CHAT, ZoneMemberStatus.ACTIVE);
    threadRepo.findById.mockResolvedValue(threadRow({ authorId: "someoneElse" }));
    await expect(
      svc(zoneRepo).remove(actor([UserRole.STUDENT]), "t1"),
    ).rejects.toMatchObject({ httpStatus: HttpStatus.FORBIDDEN });

    threadRepo.findById.mockResolvedValue(threadRow({ authorId: "u1" }));
    await svc(zoneRepo).remove(actor([UserRole.STUDENT]), "t1");
    expect(threadRepo.softDelete).toHaveBeenCalledWith("t1", "u1");
  });
});
