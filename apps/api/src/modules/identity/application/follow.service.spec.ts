import { describe, expect, it, vi } from "vitest";
import { DomainError, NotFoundError } from "../../../common/errors/domain-error";
import type { FollowRow } from "../infrastructure/follow.repository";
import { FollowService } from "./follow.service";

const makeFollows = () => ({
  follow: vi.fn().mockResolvedValue(undefined),
  unfollow: vi.fn().mockResolvedValue(undefined),
  isFollowing: vi.fn(),
  countFollowers: vi.fn(),
  countFollowing: vi.fn(),
  getFolloweeIds: vi.fn(),
  listFollowers: vi.fn(),
  listFollowing: vi.fn(),
});
const makeUsers = () => ({ findByUsernameService: vi.fn(), findByIdService: vi.fn() });
const makeEvents = () => ({ emit: vi.fn() });
const storage = { getPublicUrl: (k: string) => `https://cdn/${k}` };

const userRow = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "uB",
  username: "bob",
  displayName: "Bob",
  status: "ACTIVE",
  avatarStorageKey: null,
  createdAt: new Date(),
  ...over,
});

const make = () => {
  const follows = makeFollows();
  const users = makeUsers();
  const events = makeEvents();
  const svc = new FollowService(follows as never, users as never, events as never, storage as never);
  return { svc, follows, users, events };
};

describe("FollowService.follow", () => {
  it("follows a visible user and emits USER_FOLLOWED with the actor's display fields", async () => {
    const { svc, follows, users, events } = make();
    users.findByUsernameService.mockResolvedValue(userRow());
    users.findByIdService.mockResolvedValue({ displayName: "Alice", username: "alice" });

    await svc.follow("uA", "bob");

    expect(follows.follow).toHaveBeenCalledWith("uA", "uB");
    expect(events.emit).toHaveBeenCalledWith("identity.user.followed", {
      recipientId: "uB",
      actorId: "uA",
      actorDisplayName: "Alice",
      actorUsername: "alice",
    });
  });

  it("rejects following yourself (400) and does not write or emit", async () => {
    const { svc, follows, users, events } = make();
    users.findByUsernameService.mockResolvedValue(userRow({ id: "uA", username: "alice" }));
    await expect(svc.follow("uA", "alice")).rejects.toBeInstanceOf(DomainError);
    expect(follows.follow).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("404s on unknown or banned target", async () => {
    const { svc, users } = make();
    users.findByUsernameService.mockResolvedValueOnce(undefined);
    await expect(svc.follow("uA", "ghost")).rejects.toBeInstanceOf(NotFoundError);
    users.findByUsernameService.mockResolvedValueOnce(userRow({ status: "BANNED" }));
    await expect(svc.follow("uA", "bob")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("FollowService.unfollow", () => {
  it("removes the edge for a resolved target", async () => {
    const { svc, follows, users, events } = make();
    users.findByUsernameService.mockResolvedValue(userRow());
    await svc.unfollow("uA", "bob");
    expect(follows.unfollow).toHaveBeenCalledWith("uA", "uB");
    expect(events.emit).not.toHaveBeenCalled(); // unfollow is silent
  });

  it("is a no-op when the target is gone (never throws)", async () => {
    const { svc, follows, users } = make();
    users.findByUsernameService.mockResolvedValue(undefined);
    await expect(svc.unfollow("uA", "ghost")).resolves.toBeUndefined();
    expect(follows.unfollow).not.toHaveBeenCalled();
  });
});

describe("FollowService.getFollowers", () => {
  const row = (over: Partial<FollowRow>): FollowRow => ({
    userId: "u1",
    displayName: "One",
    username: "one",
    avatarStorageKey: null,
    viewerFollows: false,
    createdAt: new Date(),
    ...over,
  });

  it("maps rows to public refs (avatar via storage), drops usernameless users, and pages", async () => {
    const { svc, follows, users } = make();
    users.findByUsernameService.mockResolvedValue(userRow());
    follows.listFollowers.mockResolvedValue([
      row({ userId: "u1", username: "one", avatarStorageKey: "avatars/u1/a.png", viewerFollows: true }),
      row({ userId: "u2", username: null }), // no handle → not linkable → dropped
    ]);

    const res = await svc.getFollowers("bob", "viewer");

    expect(res.items).toEqual([
      {
        userId: "u1",
        displayName: "One",
        username: "one",
        avatarUrl: "https://cdn/avatars/u1/a.png",
        isFollowing: true,
      },
    ]);
    expect(res.nextCursor).toBeNull(); // short page
    expect(follows.listFollowers).toHaveBeenCalledWith("uB", "viewer", {
      limit: 20,
      before: undefined,
    });
  });

  it("404s when the profile owner is unknown", async () => {
    const { svc, users } = make();
    users.findByUsernameService.mockResolvedValue(undefined);
    await expect(svc.getFollowers("ghost", "viewer")).rejects.toBeInstanceOf(NotFoundError);
  });
});
