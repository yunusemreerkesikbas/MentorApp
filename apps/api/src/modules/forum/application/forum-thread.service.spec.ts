import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpStatus } from "@nestjs/common";
import { UserRole, ZoneMemberStatus, ZoneRole, ZoneType } from "@mentor/types";
import { ForumThreadService } from "./forum-thread.service";

const threadRow = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "t1",
  zoneId: "z1",
  authorId: "author",
  authorName: "Author",
  authorUsername: "author",
  authorAvatarStorageKey: null,
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
  setReaction: vi.fn().mockResolvedValue(undefined),
  removeReaction: vi.fn().mockResolvedValue(undefined),
  reactionCountsByThread: vi.fn().mockResolvedValue(new Map()),
  listReactionUsers: vi.fn().mockResolvedValue([]),
  countReactionUsers: vi.fn().mockResolvedValue(0),
  myReactionsByThread: vi.fn().mockResolvedValue(new Map()),
  commentCountsByThread: vi.fn().mockResolvedValue(new Map()),
  recentCommentersByThread: vi.fn().mockResolvedValue(new Map()),
  suggestAuthorsInMemberZones: vi.fn().mockResolvedValue([]),
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
  reactionCountsByPost: vi.fn().mockResolvedValue(new Map()),
  listReactionUsers: vi.fn().mockResolvedValue([]),
  countReactionUsers: vi.fn().mockResolvedValue(0),
  myReactionsByPost: vi.fn().mockResolvedValue(new Map()),
  replyCountsByPost: vi.fn().mockResolvedValue(new Map()),
  setPostReaction: vi.fn().mockResolvedValue(undefined),
  removePostReaction: vi.fn().mockResolvedValue(undefined),
});

const makeAttachmentRepo = () => ({
  insertMany: vi.fn().mockResolvedValue([]),
  listForTargets: vi.fn().mockResolvedValue(new Map()),
  markPending: vi.fn().mockResolvedValue(undefined),
  listExpiredPending: vi.fn().mockResolvedValue([]),
  deletePending: vi.fn().mockResolvedValue(undefined),
});

const makeBookmarkRepo = () => ({
  add: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  myBookmarkedTargets: vi.fn().mockResolvedValue(new Set()),
  listForUser: vi.fn().mockResolvedValue([]),
});

const makeMentionService = () => ({ dispatch: vi.fn().mockResolvedValue(undefined) });
const makeUsersService = () => ({
  findByUsername: vi.fn().mockResolvedValue(undefined),
  suggestCohortPeers: vi.fn().mockResolvedValue([]),
});
const makeFollowService = () => ({ getFolloweeIds: vi.fn().mockResolvedValue([]) });

const makeZoneRepo = (
  zoneType: ZoneType = ZoneType.CHAT,
  memberStatus: string | null = ZoneMemberStatus.ACTIVE,
) => ({
  findById: vi.fn().mockResolvedValue({ id: "z1", type: zoneType }),
  findMembership: vi
    .fn()
    .mockResolvedValue(memberStatus ? { role: ZoneRole.MEMBER, status: memberStatus } : null),
  findMembershipsByZone: vi.fn().mockResolvedValue(
    new Map(
      memberStatus
        ? [["z1", { role: ZoneRole.MEMBER, status: memberStatus }]]
        : [],
    ),
  ),
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
    storage.getPublicUrl.mockClear();
  });

  let postRepo: ReturnType<typeof makePostRepo>;
  let mentions: ReturnType<typeof makeMentionService>;
  let usersService: ReturnType<typeof makeUsersService>;
  let follow: ReturnType<typeof makeFollowService>;

  const svc = (zoneRepo: ReturnType<typeof makeZoneRepo>) => {
    postRepo = makePostRepo();
    mentions = makeMentionService();
    usersService = makeUsersService();
    follow = makeFollowService();
    return new ForumThreadService(
      threadRepo as never,
      zoneRepo as never,
      postRepo as never,
      makeAttachmentRepo() as never,
      makeBookmarkRepo() as never,
      enabledConfig as never,
      events as never,
      storage as never,
      mentions as never,
      usersService as never,
      follow as never,
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

  it("maps author avatar storage key to authorAvatarUrl", async () => {
    threadRepo.findById.mockResolvedValue(
      threadRow({ authorAvatarStorageKey: "avatars/u1/a.png" }),
    );
    const view = await svc(makeZoneRepo()).postThread(actor([UserRole.STUDENT]), "z1", { body: "hi" });
    expect(view.authorAvatarUrl).toBe("/v1/storage/fake-object?key=avatars%2Fu1%2Fa.png");
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

  it("listFeed exposes owner edit and delete capabilities from server policy", async () => {
    const zoneRepo = makeZoneRepo();
    const now = new Date();
    threadRepo.listFeed.mockResolvedValue([
      threadRow({ authorId: "u1", createdAt: now, updatedAt: now }),
    ]);
    const service = svc(zoneRepo);

    const feed = await service.listFeed("u1", "z1", { limit: 20, sort: "recent" }, [
      UserRole.STUDENT,
    ]);

    expect(feed.items[0]!.capabilities).toMatchObject({
      canEdit: true,
      canDelete: true,
      canModerate: false,
    });
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
    expect(events.emit).toHaveBeenCalledWith("forum.thread.commented", {
      threadId: "t1",
      recipientId: "author",
      actorId: "u1",
    });
    // @mentions dispatched with the thread author excluded (already gets the comment notification).
    expect(mentions.dispatch).toHaveBeenCalledWith("yorum", "u1", "/community/message/t1", ["author"]);
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
    expect(events.emit).toHaveBeenCalledWith("forum.comment.replied", {
      parentPostId: "parent-post",
      recipientId: "u1",
      actorId: "u1",
    });
  });

  it("rejects a non-member replying to a comment", async () => {
    const zoneRepo = makeZoneRepo(ZoneType.CHAT, null);
    await expect(
      svc(zoneRepo).replyToComment(actor([UserRole.STUDENT]), "parent-post", { body: "yanıt" }),
    ).rejects.toMatchObject({ httpStatus: HttpStatus.FORBIDDEN });
    expect(postRepo.createAnswer).not.toHaveBeenCalled();
  });

  it("sets or replaces a comment reaction and removes the selected emoji", async () => {
    const zoneRepo = makeZoneRepo(ZoneType.CHAT, ZoneMemberStatus.ACTIVE);
    const service = svc(zoneRepo);
    await service.reactPost("u1", "p1", "💪");
    expect(postRepo.setPostReaction).toHaveBeenCalledWith("p1", "u1", "💪");
    await service.unreactPost("u1", "p1", "💪");
    expect(postRepo.removePostReaction).toHaveBeenCalledWith("p1", "u1", "💪");
  });

  it("sets or replaces a thread reaction through the single-reaction repository contract", async () => {
    const zoneRepo = makeZoneRepo(ZoneType.CHAT, ZoneMemberStatus.ACTIVE);
    const service = svc(zoneRepo);
    await service.react("u1", "t1", "❤️");
    expect(threadRepo.setReaction).toHaveBeenCalledWith("t1", "u1", "❤️");
    await service.unreact("u1", "t1", "❤️");
    expect(threadRepo.removeReaction).toHaveBeenCalledWith("t1", "u1", "❤️");
  });

  it("lists visible thread reaction users with emoji filtering and public avatar URLs", async () => {
    const service = svc(makeZoneRepo());
    threadRepo.listReactionUsers.mockResolvedValue([
      {
        userId: "u2",
        displayName: "Ayşe",
        username: "ayse",
        avatarStorageKey: "avatars/u2.webp",
        emoji: "❤️",
        reactedAt: new Date("2026-08-10T20:00:00Z"),
      },
    ]);
    threadRepo.countReactionUsers.mockResolvedValue(1);

    const result = await service.listThreadReactionUsers("u1", "t1", {
      page: 2,
      pageSize: 20,
      emoji: "❤️",
    });

    expect(threadRepo.findById.mock.invocationCallOrder[0]).toBeLessThan(
      threadRepo.listReactionUsers.mock.invocationCallOrder[0]!,
    );
    expect(threadRepo.listReactionUsers).toHaveBeenCalledWith("t1", {
      page: 2,
      pageSize: 20,
      emoji: "❤️",
    });
    expect(result).toEqual({
      items: [
        {
          userId: "u2",
          displayName: "Ayşe",
          username: "ayse",
          avatarUrl: "/v1/storage/fake-object?key=avatars%2Fu2.webp",
          emoji: "❤️",
          reactedAt: "2026-08-10T20:00:00.000Z",
        },
      ],
      total: 1,
      page: 2,
      pageSize: 20,
    });
  });

  it("lists visible post reaction users through the post repository", async () => {
    const service = svc(makeZoneRepo());
    postRepo.listReactionUsers.mockResolvedValue([
      {
        userId: "u3",
        displayName: "Can",
        username: null,
        avatarStorageKey: null,
        emoji: "👍",
        reactedAt: new Date("2026-08-10T20:05:00Z"),
      },
    ]);
    postRepo.countReactionUsers.mockResolvedValue(1);

    const result = await service.listPostReactionUsers("u1", "p1", {
      page: 1,
      pageSize: 20,
    });

    expect(postRepo.findById.mock.invocationCallOrder[0]).toBeLessThan(
      postRepo.listReactionUsers.mock.invocationCallOrder[0]!,
    );
    expect(result.items[0]).toMatchObject({ userId: "u3", avatarUrl: null, emoji: "👍" });
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

  it("createAttachmentUploadUrl mints a key and records it pending (orphan-cleanup)", async () => {
    const attachments = makeAttachmentRepo();
    const storageMock = {
      getPublicUrl: vi.fn(),
      createUploadUrl: vi
        .fn()
        .mockResolvedValue({ url: "signed", key: "forum-attachments/u1/x.png", expiresAt: "e" }),
    };
    const service = new ForumThreadService(
      makeThreadRepo() as never,
      makeZoneRepo() as never,
      makePostRepo() as never,
      attachments as never,
      makeBookmarkRepo() as never,
      enabledConfig as never,
      events as never,
      storageMock as never,
      makeMentionService() as never,
      makeUsersService() as never,
    );
    const res = await service.createAttachmentUploadUrl("u1", "image/png");
    expect(res.key).toBe("forum-attachments/u1/x.png");
    expect(attachments.markPending).toHaveBeenCalledWith("forum-attachments/u1/x.png", "u1");
  });

  it("cleanupOrphanAttachments deletes expired pending objects then drops their rows", async () => {
    const keys = ["forum-attachments/u1/a.png", "forum-attachments/u1/b.png"];
    const attachments = makeAttachmentRepo();
    attachments.listExpiredPending.mockResolvedValue(keys);
    const storageMock = { getPublicUrl: vi.fn(), deleteObject: vi.fn().mockResolvedValue(undefined) };
    const service = new ForumThreadService(
      makeThreadRepo() as never,
      makeZoneRepo() as never,
      makePostRepo() as never,
      attachments as never,
      makeBookmarkRepo() as never,
      enabledConfig as never,
      events as never,
      storageMock as never,
      makeMentionService() as never,
      makeUsersService() as never,
    );
    const res = await service.cleanupOrphanAttachments();
    expect(res.deleted).toBe(2);
    expect(storageMock.deleteObject).toHaveBeenCalledTimes(2);
    expect(attachments.deletePending).toHaveBeenCalledWith(keys);
  });

  it("bookmarkThread / unbookmarkThread toggle the ledger via the repo", async () => {
    const bookmarks = makeBookmarkRepo();
    const service = new ForumThreadService(
      makeThreadRepo() as never,
      makeZoneRepo() as never,
      makePostRepo() as never,
      makeAttachmentRepo() as never,
      bookmarks as never,
      enabledConfig as never,
      events as never,
      storage as never,
      makeMentionService() as never,
      makeUsersService() as never,
    );
    await service.bookmarkThread("u1", "t1");
    expect(bookmarks.add).toHaveBeenCalledWith("u1", "THREAD", "t1");
    await service.unbookmarkThread("u1", "t1");
    expect(bookmarks.remove).toHaveBeenCalledWith("u1", "THREAD", "t1");
  });

  it("getMyBookmarks interleaves saved threads + posts in save order, dropping deleted targets", async () => {
    const now = new Date("2026-07-01T10:00:00Z");
    const bookmarks = {
      ...makeBookmarkRepo(),
      listForUser: vi.fn().mockResolvedValue([
        { targetType: "THREAD", targetId: "t1", createdAt: now },
        { targetType: "POST", targetId: "p1", createdAt: now },
        { targetType: "THREAD", targetId: "gone", createdAt: now }, // deleted → dropped
      ]),
    };
    const threadRepo = {
      ...makeThreadRepo(),
      findManyByIds: vi.fn().mockResolvedValue([threadRow({ id: "t1" })]), // "gone" not returned
    };
    const postRepo = {
      ...makePostRepo(),
      findManyByIds: vi.fn().mockResolvedValue([
        {
          id: "p1",
          threadId: "t1",
          parentPostId: null,
          authorId: "u2",
          authorName: "u2",
          authorUsername: null,
          authorAvatarStorageKey: null,
          body: "kayıtlı yorum",
          isAccepted: false,
          createdAt: now,
        },
      ]),
    };
    const service = new ForumThreadService(
      threadRepo as never,
      makeZoneRepo() as never,
      postRepo as never,
      makeAttachmentRepo() as never,
      bookmarks as never,
      enabledConfig as never,
      events as never,
      storage as never,
      makeMentionService() as never,
      makeUsersService() as never,
    );
    const res = await service.getMyBookmarks("u1");
    expect(res.items.map((i) => i.type)).toEqual(["thread", "comment"]);
    expect(res.items[0]!.type === "thread" && res.items[0]!.thread.id).toBe("t1");
    expect(res.items[1]!.type === "comment" && res.items[1]!.comment.id).toBe("p1");
  });

  it("getUserActivity interleaves a user's threads + posts newest-first (resolved by username)", async () => {
    const users = { findByUsername: vi.fn().mockResolvedValue({ id: "uAuthor" }) };
    const threadRepo = {
      ...makeThreadRepo(),
      listByAuthor: vi.fn().mockResolvedValue([
        {
          ...threadRow({ id: "t1", createdAt: new Date("2026-07-02T10:00:00Z") }),
          zoneTitle: "KPSS Genel",
          zoneSlug: "kpss-genel",
        },
      ]),
    };
    const postRepo = {
      ...makePostRepo(),
      listByAuthor: vi.fn().mockResolvedValue([
        {
          id: "p1",
          threadId: "t1",
          parentPostId: null,
          authorId: "uAuthor",
          authorName: "A",
          authorUsername: null,
          authorAvatarStorageKey: null,
          body: "yanıt",
          isAccepted: false,
          createdAt: new Date("2026-07-03T10:00:00Z"), // newer than the thread
          zoneTitle: "KPSS Genel",
          zoneSlug: "kpss-genel",
        },
      ]),
    };
    const service = new ForumThreadService(
      threadRepo as never,
      makeZoneRepo() as never,
      postRepo as never,
      makeAttachmentRepo() as never,
      makeBookmarkRepo() as never,
      enabledConfig as never,
      events as never,
      storage as never,
      makeMentionService() as never,
      users as never,
    );
    const res = await service.getUserActivity("viewer", "author");
    expect(users.findByUsername).toHaveBeenCalledWith("author");
    expect(threadRepo.listByAuthor).toHaveBeenCalledWith("uAuthor", "viewer", expect.any(Object));
    expect(res.items.map((i) => i.type)).toEqual(["comment", "thread"]); // p1 (Jul 3) before t1 (Jul 2)
    expect(res.items[0]!.zone.title).toBe("KPSS Genel"); // zone context carried through
  });

  it("getUserActivity 404s for an unknown username", async () => {
    const service = new ForumThreadService(
      makeThreadRepo() as never,
      makeZoneRepo() as never,
      makePostRepo() as never,
      makeAttachmentRepo() as never,
      makeBookmarkRepo() as never,
      enabledConfig as never,
      events as never,
      storage as never,
      makeMentionService() as never,
      { findByUsername: vi.fn().mockResolvedValue(undefined) } as never,
    );
    await expect(service.getUserActivity("viewer", "nobody")).rejects.toMatchObject({
      httpStatus: HttpStatus.NOT_FOUND,
    });
  });

  it("getFollowSuggestions: zone authors first, cohort fallback for the rest, excluding self+followed", async () => {
    const service = svc(makeZoneRepo());
    follow.getFolloweeIds.mockResolvedValue(["followed1"]);
    threadRepo.suggestAuthorsInMemberZones.mockResolvedValue([
      { userId: "a1", displayName: "A1", username: "a1", avatarStorageKey: "avatars/a1.png" },
    ]);
    usersService.suggestCohortPeers.mockResolvedValue([
      { userId: "c1", displayName: "C1", username: "c1", avatarStorageKey: null },
    ]);

    const res = await service.getFollowSuggestions("u1", 10);

    // Primary excludes self + already-followed.
    expect(threadRepo.suggestAuthorsInMemberZones).toHaveBeenCalledWith("u1", ["u1", "followed1"], 10);
    // Fallback also excludes the primary results, asks only for the remaining slots.
    expect(usersService.suggestCohortPeers).toHaveBeenCalledWith("u1", ["u1", "followed1", "a1"], 9);
    expect(res).toEqual([
      {
        userId: "a1",
        displayName: "A1",
        username: "a1",
        avatarUrl: "/v1/storage/fake-object?key=avatars%2Fa1.png",
        isFollowing: false,
      },
      { userId: "c1", displayName: "C1", username: "c1", avatarUrl: null, isFollowing: false },
    ]);
  });

  it("getFollowSuggestions: skips the cohort fallback when zone authors already fill the limit", async () => {
    const service = svc(makeZoneRepo());
    threadRepo.suggestAuthorsInMemberZones.mockResolvedValue([
      { userId: "a1", displayName: "A1", username: "a1", avatarStorageKey: null },
      { userId: "a2", displayName: "A2", username: "a2", avatarStorageKey: null },
    ]);
    const res = await service.getFollowSuggestions("u1", 2);
    expect(usersService.suggestCohortPeers).not.toHaveBeenCalled();
    expect(res.map((r) => r.userId)).toEqual(["a1", "a2"]);
  });
});
