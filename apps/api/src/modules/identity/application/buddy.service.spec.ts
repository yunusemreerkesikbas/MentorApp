import { describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { BUDDY_NUDGE_COOLDOWN_MS, BuddyService } from "./buddy.service";

const makePairs = () => ({
  findActiveByUser: vi.fn().mockResolvedValue(undefined),
  findOutgoingPending: vi.fn().mockResolvedValue(undefined),
  listIncomingPending: vi.fn().mockResolvedValue([]),
  findBetween: vi.fn().mockResolvedValue(undefined),
  findPendingById: vi.fn().mockResolvedValue(undefined),
  insertPending: vi.fn().mockResolvedValue({ id: "p1" }),
  acceptInTx: vi.fn().mockResolvedValue(true),
  deleteRequest: vi.fn().mockResolvedValue(undefined),
  deleteActive: vi.fn().mockResolvedValue(undefined),
  recordNudge: vi.fn().mockResolvedValue(undefined),
  listRelatedOrActivelyPairedIds: vi.fn().mockResolvedValue([]),
});
const makeUsers = () => ({
  findByUsernameService: vi.fn(),
  findByIdService: vi.fn().mockResolvedValue({ displayName: "Alice", username: "alice" }),
  suggestCohortPeers: vi.fn().mockResolvedValue([]),
});
const makeEvents = () => ({ emit: vi.fn() });

const userRow = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "uB",
  username: "bob",
  displayName: "Bob",
  status: "ACTIVE",
  ...over,
});

const activePair = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "pair1",
  requesterId: "uA",
  addresseeId: "uB",
  status: "ACTIVE",
  acceptedAt: new Date(),
  requesterLastNudgeAt: null,
  addresseeLastNudgeAt: null,
  createdAt: new Date(),
  otherUserId: "uB",
  otherDisplayName: "Bob",
  otherUsername: "bob",
  otherAvatarStorageKey: null,
  ...over,
});

const make = () => {
  const pairs = makePairs();
  const users = makeUsers();
  const events = makeEvents();
  const svc = new BuddyService(pairs as never, users as never, events as never);
  return { svc, pairs, users, events };
};

describe("BuddyService.request", () => {
  it("creates a pending request and emits BUDDY_REQUESTED with actor fields", async () => {
    const { svc, pairs, users, events } = make();
    users.findByUsernameService.mockResolvedValue(userRow());

    await svc.request("uA", "bob");

    expect(pairs.insertPending).toHaveBeenCalledWith("uA", "uB");
    expect(events.emit).toHaveBeenCalledWith("identity.buddy.requested", {
      recipientId: "uB",
      actorId: "uA",
      actorDisplayName: "Alice",
      actorUsername: "alice",
    });
  });

  it("rejects self-request (400) without writing", async () => {
    const { svc, pairs, users } = make();
    users.findByUsernameService.mockResolvedValue(userRow({ id: "uA", username: "alice" }));
    await expect(svc.request("uA", "alice")).rejects.toMatchObject({
      code: ErrorCode.SOCIAL_BUDDY_SELF,
    });
    expect(pairs.insertPending).not.toHaveBeenCalled();
  });

  it("404s on unknown or banned target", async () => {
    const { svc, users } = make();
    users.findByUsernameService.mockResolvedValueOnce(undefined);
    await expect(svc.request("uA", "ghost")).rejects.toBeInstanceOf(NotFoundError);
    users.findByUsernameService.mockResolvedValueOnce(userRow({ status: "BANNED" }));
    await expect(svc.request("uA", "bob")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("409s when the requester already has an active buddy", async () => {
    const { svc, pairs, users } = make();
    users.findByUsernameService.mockResolvedValue(userRow());
    pairs.findActiveByUser.mockResolvedValue(activePair());
    await expect(svc.request("uA", "bob")).rejects.toMatchObject({
      code: ErrorCode.SOCIAL_BUDDY_ALREADY_ACTIVE,
    });
  });

  it("409s when the requester already has an outgoing pending request", async () => {
    const { svc, pairs, users } = make();
    users.findByUsernameService.mockResolvedValue(userRow());
    pairs.findOutgoingPending.mockResolvedValue(activePair({ status: "PENDING" }));
    await expect(svc.request("uA", "bob")).rejects.toMatchObject({
      code: ErrorCode.SOCIAL_BUDDY_REQUEST_EXISTS,
    });
  });

  it("409s when a reverse pending request already exists between the two", async () => {
    const { svc, pairs, users } = make();
    users.findByUsernameService.mockResolvedValue(userRow());
    pairs.findBetween.mockResolvedValue({
      id: "p9",
      requesterId: "uB",
      addresseeId: "uA",
      status: "PENDING",
    });
    await expect(svc.request("uA", "bob")).rejects.toMatchObject({
      code: ErrorCode.SOCIAL_BUDDY_REQUEST_EXISTS,
    });
    expect(pairs.insertPending).not.toHaveBeenCalled();
  });
});

describe("BuddyService.accept", () => {
  it("accepts as the addressee and notifies the original requester", async () => {
    const { svc, pairs, events } = make();
    pairs.findPendingById.mockResolvedValue({
      id: "p1",
      requesterId: "uB",
      addresseeId: "uA",
      status: "PENDING",
    });

    await svc.accept("uA", "p1");

    expect(pairs.acceptInTx).toHaveBeenCalledWith("p1", "uB", "uA");
    expect(events.emit).toHaveBeenCalledWith(
      "identity.buddy.accepted",
      expect.objectContaining({ recipientId: "uB", actorId: "uA" }),
    );
  });

  it("404s when the caller is not the addressee", async () => {
    const { svc, pairs } = make();
    pairs.findPendingById.mockResolvedValue({
      id: "p1",
      requesterId: "uA", // caller is the requester, not the addressee
      addresseeId: "uB",
      status: "PENDING",
    });
    await expect(svc.accept("uA", "p1")).rejects.toBeInstanceOf(NotFoundError);
    expect(pairs.acceptInTx).not.toHaveBeenCalled();
  });

  it("409s when either party got paired meanwhile (tx re-check failed)", async () => {
    const { svc, pairs, events } = make();
    pairs.findPendingById.mockResolvedValue({
      id: "p1",
      requesterId: "uB",
      addresseeId: "uA",
      status: "PENDING",
    });
    pairs.acceptInTx.mockResolvedValue(false);
    await expect(svc.accept("uA", "p1")).rejects.toMatchObject({
      code: ErrorCode.SOCIAL_BUDDY_ALREADY_ACTIVE,
    });
    expect(events.emit).not.toHaveBeenCalled();
  });
});

describe("BuddyService.nudge", () => {
  it("records the nudge on the caller's side and emits BUDDY_NUDGED to the partner", async () => {
    const { svc, pairs, events } = make();
    pairs.findActiveByUser.mockResolvedValue(activePair());

    await svc.nudge("uA");

    expect(pairs.recordNudge).toHaveBeenCalledWith("pair1", "requester", expect.any(Date));
    expect(events.emit).toHaveBeenCalledWith(
      "identity.buddy.nudged",
      expect.objectContaining({ recipientId: "uB", actorId: "uA" }),
    );
  });

  it("429s inside the 4h cooldown", async () => {
    const { svc, pairs, events } = make();
    pairs.findActiveByUser.mockResolvedValue(
      activePair({ requesterLastNudgeAt: new Date(Date.now() - BUDDY_NUDGE_COOLDOWN_MS / 2) }),
    );
    await expect(svc.nudge("uA")).rejects.toMatchObject({
      code: ErrorCode.SOCIAL_BUDDY_NUDGE_COOLDOWN,
    });
    expect(pairs.recordNudge).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("nudges again once the cooldown has passed, on the correct side as addressee", async () => {
    const { svc, pairs } = make();
    pairs.findActiveByUser.mockResolvedValue(
      activePair({
        requesterId: "uB",
        addresseeId: "uA",
        addresseeLastNudgeAt: new Date(Date.now() - BUDDY_NUDGE_COOLDOWN_MS - 1000),
      }),
    );
    await svc.nudge("uA");
    expect(pairs.recordNudge).toHaveBeenCalledWith("pair1", "addressee", expect.any(Date));
  });

  it("404s when there is no active pairing", async () => {
    const { svc } = make();
    await expect(svc.nudge("uA")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("BuddyService.end / deleteRequest", () => {
  it("ends silently and deletes requests scoped to the caller", async () => {
    const { svc, pairs, events } = make();
    await svc.end("uA");
    await svc.deleteRequest("uA", "p1");
    expect(pairs.deleteActive).toHaveBeenCalledWith("uA");
    expect(pairs.deleteRequest).toHaveBeenCalledWith("p1", "uA");
    expect(events.emit).not.toHaveBeenCalled();
  });
});

describe("BuddyService.getSuggestionCandidates", () => {
  const peer = (id: string) => ({
    userId: id,
    displayName: id,
    username: id,
    avatarStorageKey: null,
  });

  it("returns cohort peers filtered by the buddy-relation exclusion set", async () => {
    const { svc, pairs, users } = make();
    users.findByIdService.mockResolvedValue({ examType: "KPSS" });
    users.suggestCohortPeers.mockResolvedValue([peer("a"), peer("b"), peer("c")]);
    pairs.listRelatedOrActivelyPairedIds.mockResolvedValue(["b"]); // b already related/active

    const result = await svc.getSuggestionCandidates("viewer", 5);

    expect(users.suggestCohortPeers).toHaveBeenCalledWith("KPSS", ["viewer"], 20); // limit*4 buffer
    expect(result.map((p) => p.userId)).toEqual(["a", "c"]);
  });

  it("caps the result at the requested limit", async () => {
    const { svc, users } = make();
    users.suggestCohortPeers.mockResolvedValue([peer("a"), peer("b"), peer("c")]);
    const result = await svc.getSuggestionCandidates("viewer", 2);
    expect(result).toHaveLength(2);
  });

  it("returns empty when the viewer already has an active buddy", async () => {
    const { svc, pairs, users } = make();
    pairs.findActiveByUser.mockResolvedValue(activePair());
    const result = await svc.getSuggestionCandidates("viewer", 5);
    expect(result).toEqual([]);
    expect(users.suggestCohortPeers).not.toHaveBeenCalled();
  });

  it("passes a null examType when the viewer has none", async () => {
    const { svc, users } = make();
    users.findByIdService.mockResolvedValue({ examType: null });
    users.suggestCohortPeers.mockResolvedValue([]);
    await svc.getSuggestionCandidates("viewer", 5);
    expect(users.suggestCohortPeers).toHaveBeenCalledWith(null, ["viewer"], 20);
  });
});

describe("BuddyService.getStatusBetween", () => {
  it("maps the pair row to the viewer-relative status", async () => {
    const { svc, pairs } = make();
    pairs.findBetween.mockResolvedValue({
      id: "p1",
      requesterId: "uA",
      addresseeId: "uB",
      status: "PENDING",
    });
    expect(await svc.getStatusBetween("uA", "uB")).toBe("pending_outgoing");
    expect(await svc.getStatusBetween("uB", "uA")).toBe("pending_incoming");
  });

  it("returns unavailable when the viewer is active with someone else", async () => {
    const { svc, pairs } = make();
    pairs.findBetween.mockResolvedValue(undefined);
    pairs.findActiveByUser.mockResolvedValue(activePair({ otherUserId: "uC" }));
    expect(await svc.getStatusBetween("uA", "uB")).toBe("unavailable");
  });

  it("returns none when there is no relation at all", async () => {
    const { svc } = make();
    expect(await svc.getStatusBetween("uA", "uB")).toBe("none");
  });
});
