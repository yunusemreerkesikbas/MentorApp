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
  commentCountsByThread: vi.fn().mockResolvedValue(new Map()),
  recentCommentersByThread: vi.fn().mockResolvedValue(new Map()),
});

const makePostRepo = () => ({
  createAnswer: vi.fn().mockResolvedValue({ id: "p1" }),
  findById: vi.fn().mockResolvedValue({
    id: "p1",
    threadId: "t1",
    parentPostId: null,
    authorId: "u1",
    authorName: "u1",
    body: "yorum",
    isAccepted: false,
    createdAt: new Date("2026-06-22T10:05:00Z"),
  }),
  listByThread: vi.fn().mockResolvedValue([]),
  listTopLevel: vi.fn().mockResolvedValue([]),
  listReplies: vi.fn().mockResolvedValue([]),
  likeCountsByPost: vi.fn().mockResolvedValue(new Map()),
  myLikedPosts: vi.fn().mockResolvedValue(new Set()),
  replyCountsByPost: vi.fn().mockResolvedValue(new Map()),
  addPostReaction: vi.fn().mockResolvedValue(undefined),
  removePostReaction: vi.fn().mockResolvedValue(undefined),
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
const storage = { getPublicUrl: vi.fn((key: string) => `/v1/storage/fake-object?key=${encodeURIComponent(key)}`) };

const actor = (roles: string[]) => ({ id: "u1", roles });

describe("ForumThreadService", () => {
  let threadRepo: ReturnType<typeof makeThreadRepo>;

  beforeEach(() => {
    threadRepo = makeThreadRepo();
    events.emit.mockClear();
  });

  let postRepo: ReturnType<typeof makePostRepo>;

  const svc = (zoneRepo: ReturnType<typeof makeZoneRepo>) => {
    postRepo = makePostRepo();
    return new ForumThreadService(
      threadRepo as never,
      zoneRepo as never,
      postRepo as never,
      enabledConfig as never,
      events as never,
      storage as never,
    );
  };

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
    const feed = await svc(zoneRepo).listFeed("u1", "z1", { limit: 2, sort: "recent" });
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

  it("lets an ACTIVE member comment on a CHAT thread", async () => {
    const zoneRepo = makeZoneRepo(ZoneType.CHAT, ZoneMemberStatus.ACTIVE);
    const view = await svc(zoneRepo).comment(actor([UserRole.STUDENT]), "t1", { body: "yorum" });
    expect(view.id).toBe("p1");
    expect(postRepo.createAnswer).toHaveBeenCalledWith({
      threadId: "t1",
      authorId: "u1",
      body: "yorum",
    });
  });

  it("lets an ACTIVE member comment on an ANNOUNCEMENT thread (discussion is open)", async () => {
    const zoneRepo = makeZoneRepo(ZoneType.ANNOUNCEMENT, ZoneMemberStatus.ACTIVE);
    const view = await svc(zoneRepo).comment(actor([UserRole.STUDENT]), "t1", { body: "yorum" });
    expect(view.id).toBe("p1");
  });

  it("rejects a non-member commenting on a CHAT thread", async () => {
    const zoneRepo = makeZoneRepo(ZoneType.CHAT, null);
    await expect(
      svc(zoneRepo).comment(actor([UserRole.STUDENT]), "t1", { body: "yorum" }),
    ).rejects.toMatchObject({ httpStatus: HttpStatus.FORBIDDEN });
    expect(postRepo.createAnswer).not.toHaveBeenCalled();
  });

  it("rejects commenting on a QA thread (answers path only)", async () => {
    const zoneRepo = makeZoneRepo(ZoneType.QA, ZoneMemberStatus.ACTIVE);
    await expect(
      svc(zoneRepo).comment(actor([UserRole.STUDENT]), "t1", { body: "yorum" }),
    ).rejects.toMatchObject({ httpStatus: HttpStatus.BAD_REQUEST });
  });

  it("lets an ACTIVE member reply to a comment (nested), carrying the root thread id", async () => {
    const zoneRepo = makeZoneRepo(ZoneType.CHAT, ZoneMemberStatus.ACTIVE);
    const service = svc(zoneRepo);
    const view = await service.replyToComment(actor([UserRole.STUDENT]), "parent-post", { body: "yanıt" });
    expect(view.id).toBe("p1");
    expect(postRepo.createAnswer).toHaveBeenCalledWith({
      threadId: "t1",
      authorId: "u1",
      body: "yanıt",
      parentPostId: "parent-post",
    });
  });

  it("rejects a non-member replying to a comment", async () => {
    const zoneRepo = makeZoneRepo(ZoneType.CHAT, null);
    await expect(
      svc(zoneRepo).replyToComment(actor([UserRole.STUDENT]), "parent-post", { body: "yanıt" }),
    ).rejects.toMatchObject({ httpStatus: HttpStatus.FORBIDDEN });
    expect(postRepo.createAnswer).not.toHaveBeenCalled();
  });

  it("likes and unlikes a comment", async () => {
    const zoneRepo = makeZoneRepo(ZoneType.CHAT, ZoneMemberStatus.ACTIVE);
    const service = svc(zoneRepo);
    await service.likePost("u1", "p1");
    expect(postRepo.addPostReaction).toHaveBeenCalledWith("p1", "u1", expect.any(String));
    await service.unlikePost("u1", "p1");
    expect(postRepo.removePostReaction).toHaveBeenCalledWith("p1", "u1", expect.any(String));
  });

  it("getCommentDetail returns the focused comment + its direct replies", async () => {
    const zoneRepo = makeZoneRepo(ZoneType.CHAT, ZoneMemberStatus.ACTIVE);
    const service = svc(zoneRepo);
    postRepo.listReplies.mockResolvedValue([
      {
        id: "r1",
        threadId: "t1",
        parentPostId: "p1",
        authorId: "u2",
        authorName: "u2",
        body: "yanıt",
        isAccepted: false,
        createdAt: new Date("2026-06-22T11:00:00Z"),
      },
    ]);
    const detail = await service.getCommentDetail("u1", "p1");
    expect(detail.comment.id).toBe("p1");
    expect(detail.replies).toHaveLength(1);
    expect(detail.replies[0]!.id).toBe("r1");
  });
});
