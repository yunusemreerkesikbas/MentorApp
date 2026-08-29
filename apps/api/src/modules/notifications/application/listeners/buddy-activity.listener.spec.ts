import { beforeEach, describe, expect, it, vi } from "vitest";
import { BuddyActivityListener } from "./buddy-activity.listener";

/** withServiceContext runs db.transaction, then SET LOCAL via tx.execute. */
const fakeDb = {
  transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> =>
    cb({ execute: async () => undefined }),
} as never;

const activePair = () => ({
  id: "pair1",
  requesterId: "actor",
  addresseeId: "partner",
  status: "ACTIVE",
  otherUserId: "partner",
  otherDisplayName: "Bob",
  otherUsername: "bob",
  otherAvatarStorageKey: null,
});

describe("BuddyActivityListener.onBuddyFirstSession", () => {
  let notifications: { createFromTemplate: ReturnType<typeof vi.fn> };
  let buddy: { getActivePair: ReturnType<typeof vi.fn> };
  let usersRepo: { findByIdService: ReturnType<typeof vi.fn> };
  let deliveries: { tryRecord: ReturnType<typeof vi.fn> };
  let listener: BuddyActivityListener;

  beforeEach(() => {
    notifications = { createFromTemplate: vi.fn().mockResolvedValue(undefined) };
    buddy = { getActivePair: vi.fn().mockResolvedValue(activePair()) };
    usersRepo = { findByIdService: vi.fn().mockResolvedValue({ displayName: "Elif" }) };
    deliveries = { tryRecord: vi.fn().mockResolvedValue(true) };
    listener = new BuddyActivityListener(
      notifications as never,
      buddy as never,
      usersRepo as never,
      deliveries as never,
      fakeDb,
    );
  });

  it("notifies the partner, naming the actor and linking to /study-session (effort only)", async () => {
    await listener.onBuddyFirstSession({ userId: "actor" });
    expect(deliveries.tryRecord).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: "partner", channel: "IN_APP" }),
    );
    expect(notifications.createFromTemplate).toHaveBeenCalledWith(
      "partner",
      "FORUM",
      expect.any(String),
      "/study-session",
      expect.objectContaining({ args: { name: "Elif" } }),
    );
  });

  it("does nothing when the actor has no active buddy", async () => {
    buddy.getActivePair.mockResolvedValue(undefined);
    await listener.onBuddyFirstSession({ userId: "actor" });
    expect(deliveries.tryRecord).not.toHaveBeenCalled();
    expect(usersRepo.findByIdService).not.toHaveBeenCalled();
    expect(notifications.createFromTemplate).not.toHaveBeenCalled();
  });

  it("skips when already deduped for the day (tryRecord false)", async () => {
    deliveries.tryRecord.mockResolvedValue(false);
    await listener.onBuddyFirstSession({ userId: "actor" });
    expect(usersRepo.findByIdService).not.toHaveBeenCalled();
    expect(notifications.createFromTemplate).not.toHaveBeenCalled();
  });

  it("skips when the actor can't be resolved (no name)", async () => {
    usersRepo.findByIdService.mockResolvedValue(undefined);
    await listener.onBuddyFirstSession({ userId: "actor" });
    expect(notifications.createFromTemplate).not.toHaveBeenCalled();
  });

  it("never throws when the notification write fails (best-effort)", async () => {
    notifications.createFromTemplate.mockRejectedValueOnce(new Error("db down"));
    await expect(listener.onBuddyFirstSession({ userId: "actor" })).resolves.toBeUndefined();
  });
});
