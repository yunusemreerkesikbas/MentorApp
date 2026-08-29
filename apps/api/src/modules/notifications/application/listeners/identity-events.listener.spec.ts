import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdentityEventsListener } from "./identity-events.listener";
import { NotificationCopyKey } from "../../domain/notification-copy";

const makeNotifications = () => ({
  createFromTemplate: vi.fn().mockResolvedValue(undefined),
  pushRealtimeEvent: vi.fn(),
});

describe("IdentityEventsListener", () => {
  let notifications: ReturnType<typeof makeNotifications>;
  let listener: IdentityEventsListener;

  beforeEach(() => {
    notifications = makeNotifications();
    listener = new IdentityEventsListener(notifications as never);
  });

  it("notifies the followee, naming the follower and linking to their profile", async () => {
    await listener.onUserFollowed({
      recipientId: "uB",
      actorId: "uA",
      actorDisplayName: "Alice",
      actorUsername: "alice",
    });
    expect(notifications.createFromTemplate).toHaveBeenCalledWith(
      "uB",
      "FORUM",
      NotificationCopyKey.NEW_FOLLOWER,
      "/community/member/alice",
      expect.objectContaining({ args: { name: "Alice" } }),
    );
  });

  it("omits the link when the follower has no handle", async () => {
    await listener.onUserFollowed({
      recipientId: "uB",
      actorId: "uA",
      actorDisplayName: "Alice",
      actorUsername: null,
    });
    expect(notifications.createFromTemplate).toHaveBeenCalledWith(
      "uB",
      "FORUM",
      NotificationCopyKey.NEW_FOLLOWER,
      undefined,
      expect.objectContaining({ args: { name: "Alice" } }),
    );
  });

  it("never throws when the notification write fails (best-effort)", async () => {
    notifications.createFromTemplate.mockRejectedValueOnce(new Error("db down"));
    await expect(
      listener.onUserFollowed({
        recipientId: "uB",
        actorId: "uA",
        actorDisplayName: "Alice",
        actorUsername: "alice",
      }),
    ).resolves.toBeUndefined();
  });

  const buddyEvent = {
    recipientId: "uB",
    actorId: "uA",
    actorDisplayName: "Alice",
    actorUsername: "alice",
  };

  it("notifies buddy request / accept / nudge, naming the actor and linking to /study-session", async () => {
    await listener.onBuddyRequested(buddyEvent);
    await listener.onBuddyAccepted(buddyEvent);
    await listener.onBuddyNudged(buddyEvent);
    expect(notifications.createFromTemplate).toHaveBeenCalledTimes(3);
    for (const call of notifications.createFromTemplate.mock.calls) {
      expect(call[0]).toBe("uB");
      expect(call[1]).toBe("FORUM");
      expect(call[3]).toBe("/study-session");
      expect(call[4]).toEqual(expect.objectContaining({ args: { name: "Alice" } }));
    }
  });

  it("buddy notifications are best-effort too", async () => {
    notifications.createFromTemplate.mockRejectedValueOnce(new Error("db down"));
    await expect(listener.onBuddyNudged(buddyEvent)).resolves.toBeUndefined();
  });
});
