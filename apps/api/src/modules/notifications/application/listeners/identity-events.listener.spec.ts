import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdentityEventsListener } from "./identity-events.listener";

const makeNotifications = () => ({ createInApp: vi.fn().mockResolvedValue(undefined) });

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
    expect(notifications.createInApp).toHaveBeenCalledWith(
      "uB",
      "FORUM",
      expect.any(String),
      expect.stringContaining("Alice"),
      "/topluluk/uye/alice",
    );
  });

  it("omits the link when the follower has no handle", async () => {
    await listener.onUserFollowed({
      recipientId: "uB",
      actorId: "uA",
      actorDisplayName: "Alice",
      actorUsername: null,
    });
    expect(notifications.createInApp).toHaveBeenCalledWith(
      "uB",
      "FORUM",
      expect.any(String),
      expect.any(String),
      undefined,
    );
  });

  it("never throws when the notification write fails (best-effort)", async () => {
    notifications.createInApp.mockRejectedValueOnce(new Error("db down"));
    await expect(
      listener.onUserFollowed({
        recipientId: "uB",
        actorId: "uA",
        actorDisplayName: "Alice",
        actorUsername: "alice",
      }),
    ).resolves.toBeUndefined();
  });
});
