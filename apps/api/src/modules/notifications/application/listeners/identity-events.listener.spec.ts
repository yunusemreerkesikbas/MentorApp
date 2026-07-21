import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdentityEventsListener } from "./identity-events.listener";
import { REALTIME_QUEUE_TTL_MS } from "../notifications.service";

const makeNotifications = () => ({
  createInApp: vi.fn().mockResolvedValue(undefined),
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
    expect(notifications.createInApp).toHaveBeenCalledWith(
      "uB",
      "FORUM",
      expect.any(String),
      expect.stringContaining("Alice"),
      "/community/member/alice",
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

  const buddyEvent = {
    recipientId: "uB",
    actorId: "uA",
    actorDisplayName: "Alice",
    actorUsername: "alice",
  };

  it("notifies buddy request / accept / nudge / study-invite, naming the actor and linking to /study-session", async () => {
    await listener.onBuddyRequested(buddyEvent);
    await listener.onBuddyAccepted(buddyEvent);
    await listener.onBuddyNudged(buddyEvent);
    await listener.onBuddyStudyInvite(buddyEvent);
    expect(notifications.createInApp).toHaveBeenCalledTimes(4);
    for (const call of notifications.createInApp.mock.calls) {
      expect(call[0]).toBe("uB");
      expect(call[1]).toBe("FORUM");
      expect(call[3]).toContain("Alice");
      expect(call[4]).toBe("/study-session");
    }
  });

  it("buddy notifications are best-effort too", async () => {
    notifications.createInApp.mockRejectedValueOnce(new Error("db down"));
    await expect(listener.onBuddyNudged(buddyEvent)).resolves.toBeUndefined();
  });

  it("study-invite pushes a 'study_invite' cue with the actor name, queued for an offline recipient", async () => {
    await listener.onBuddyStudyInvite(buddyEvent);
    expect(notifications.pushRealtimeEvent).toHaveBeenCalledWith(
      "uB",
      "study_invite",
      { actorName: "Alice" },
      REALTIME_QUEUE_TTL_MS, // survives a recipient who isn't connected yet
    );
  });
});
