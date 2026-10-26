import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InviteRedeemed } from "../../../economy/domain/economy.events";
import { NotificationCopyKey } from "../../domain/notification-copy";
import { InviteEventsListener } from "./invite-events.listener";

const event = (over: Partial<InviteRedeemed> = {}): InviteRedeemed => ({
  redemptionId: "red-1",
  inviterUserId: "uInviter",
  invitedUserId: "uInvited",
  invitedDisplayName: "Burak",
  buddyRequested: false,
  ...over,
});

describe("InviteEventsListener", () => {
  let notifications: { createFromTemplate: ReturnType<typeof vi.fn> };
  let listener: InviteEventsListener;

  beforeEach(() => {
    notifications = { createFromTemplate: vi.fn().mockResolvedValue(true) };
    listener = new InviteEventsListener(notifications as never);
  });

  it("tells the inviter who joined, once per redemption, when no buddy request went out", async () => {
    await listener.onInviteRedeemed(event());
    expect(notifications.createFromTemplate).toHaveBeenCalledTimes(1);
    expect(notifications.createFromTemplate).toHaveBeenCalledWith(
      "uInviter",
      "FORUM",
      NotificationCopyKey.INVITE_JOINED,
      "/settings",
      { args: { name: "Burak" }, dedupeKey: "invite-joined:red-1" },
    );
  });

  it("stays quiet when a buddy request went out (that notification carries it)", async () => {
    await listener.onInviteRedeemed(event({ buddyRequested: true }));
    expect(notifications.createFromTemplate).not.toHaveBeenCalled();
  });

  it("never throws when the notification write fails (best-effort)", async () => {
    notifications.createFromTemplate.mockRejectedValueOnce(new Error("db down"));
    await expect(listener.onInviteRedeemed(event())).resolves.toBeUndefined();
  });
});
