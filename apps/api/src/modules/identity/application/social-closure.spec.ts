import { describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../../../common/errors/domain-error";
import { BuddyService } from "./buddy.service";
import { FollowService } from "./follow.service";

function closedPolicy() {
  return {
    isEnabled: vi.fn().mockResolvedValue(false),
    assertEnabled: vi.fn().mockRejectedValue(new NotFoundError()),
  };
}

function fixture() {
  const users = {
    findByUsernameService: vi.fn().mockResolvedValue({ id: "other", username: "other", status: "ACTIVE" }),
    findByIdService: vi.fn().mockResolvedValue({ id: "viewer", username: "viewer", displayName: "Viewer" }),
  };
  const follows = {
    follow: vi.fn(), unfollow: vi.fn(), listFollowers: vi.fn().mockResolvedValue([]),
    listFollowing: vi.fn().mockResolvedValue([]), isFollowing: vi.fn(),
    countFollowers: vi.fn(), countFollowing: vi.fn(), getFolloweeIds: vi.fn(),
  };
  const pairs = {
    findActiveByUser: vi.fn().mockResolvedValue({ id: "pair", otherUserId: "other" }),
    findOutgoingPending: vi.fn(), listIncomingPending: vi.fn().mockResolvedValue([]),
    findBetween: vi.fn(), findPendingById: vi.fn(), insertPending: vi.fn(),
    acceptInTx: vi.fn(), deleteRequest: vi.fn(), deleteActive: vi.fn(), recordNudge: vi.fn(),
    hasActiveOrPending: vi.fn().mockResolvedValue(false), tryInsertPending: vi.fn().mockResolvedValue({ id: "pair" }),
  };
  const events = { emit: vi.fn() };
  const policy = closedPolicy();
  const follow = new FollowService(follows as never, users as never, events as never, {} as never, policy as never);
  const buddy = new BuddyService(pairs as never, users as never, events as never, policy as never);
  const expectUntouched = () => {
    for (const spy of [...Object.values(users), ...Object.values(follows), ...Object.values(pairs), events.emit]) {
      expect(spy).not.toHaveBeenCalled();
    }
  };
  return { follow, buddy, expectUntouched };
}

describe("closed social interactions", () => {
  it.each(["follow", "unfollow", "getFollowers", "getFollowing"] as const)("denies %s before identity or relation access", async (method) => {
    const f = fixture();
    await expect(f.follow[method]("viewer", "other")).rejects.toMatchObject({ code: "NOT_FOUND" });
    f.expectUntouched();
  });

  it("cannot create mutual follows through an invitation", async () => {
    const f = fixture();
    await expect(f.follow.followEachOtherSilently("viewer", "other")).rejects.toMatchObject({ code: "NOT_FOUND" });
    f.expectUntouched();
  });

  it.each(["request", "accept", "deleteRequest", "requestFromInvite"] as const)("denies buddy %s before relation access", async (method) => {
    const f = fixture();
    await expect(f.buddy[method]("viewer", "other")).rejects.toMatchObject({ code: "NOT_FOUND" });
    f.expectUntouched();
  });

  it.each(["end", "nudge"] as const)("denies buddy %s without writes or events", async (method) => {
    const f = fixture();
    await expect(f.buddy[method]("viewer")).rejects.toMatchObject({ code: "NOT_FOUND" });
    f.expectUntouched();
  });

  it("does not expose an existing buddy to passive consumers", async () => {
    const f = fixture();
    expect(await f.buddy.getActivePair("viewer")).toBeUndefined();
    f.expectUntouched();
  });

  it("keeps personal profile relation totals empty without querying the closed graph", async () => {
    const f = fixture();
    expect(await f.follow.countFollowers("viewer")).toBe(0);
    expect(await f.follow.countFollowing("viewer")).toBe(0);
    f.expectUntouched();
  });
});
