import { describe, expect, it, vi } from "vitest";
import { SocialAccessPolicy } from "../../../../common/config/social-access.policy";
import { IdentityEventsListener } from "./identity-events.listener";
import { InviteEventsListener } from "./invite-events.listener";
import { BuddyActivityListener } from "./buddy-activity.listener";

const closed = () => new SocialAccessPolicy({ get: async () => false } as never);
const event = { recipientId: "partner", actorId: "actor", actorDisplayName: "Actor", actorUsername: "actor" };

describe("closed social activity signals", () => {
  it("suppresses already emitted follow and buddy events", async () => {
    const notifications = { createFromTemplate: vi.fn().mockResolvedValue(undefined) };
    const listener = new IdentityEventsListener(notifications as never, closed());
    await listener.onUserFollowed(event);
    await listener.onBuddyRequested(event);
    await listener.onBuddyAccepted(event);
    await listener.onBuddyNudged(event);
    expect(notifications.createFromTemplate).not.toHaveBeenCalled();
  });

  it("suppresses an invitation event before its notification dedupe write", async () => {
    const notifications = { createFromTemplate: vi.fn().mockResolvedValue(undefined) };
    const listener = new InviteEventsListener(notifications as never, closed());
    await listener.onInviteRedeemed({ redemptionId: "redemption", inviterUserId: "partner", invitedUserId: "actor", invitedDisplayName: "Actor", buddyRequested: false });
    expect(notifications.createFromTemplate).not.toHaveBeenCalled();
  });

  it("does not burn daily buddy delivery dedupe or read the partner when closed", async () => {
    const notifications = { createFromTemplate: vi.fn().mockResolvedValue(undefined) };
    const buddy = { getActivePair: vi.fn().mockResolvedValue({ otherUserId: "partner" }) };
    const users = { findByIdService: vi.fn().mockResolvedValue({ displayName: "Actor" }) };
    const deliveries = { tryRecord: vi.fn().mockResolvedValue(true) };
    const db = { transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({ execute: vi.fn() })) };
    const listener = new BuddyActivityListener(notifications as never, buddy as never, users as never, deliveries as never, db as never, closed());
    await listener.onBuddyFirstSession({ userId: "actor" });
    for (const spy of [buddy.getActivePair, deliveries.tryRecord, users.findByIdService, db.transaction, notifications.createFromTemplate]) expect(spy).not.toHaveBeenCalled();
  });
});
