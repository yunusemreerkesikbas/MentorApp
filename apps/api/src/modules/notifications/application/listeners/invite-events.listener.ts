import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { EconomyEventTopic, type InviteRedeemed } from "../../../economy/domain/economy.events";
import { NotificationCopyKey } from "../../domain/notification-copy";
import { NotificationsService } from "../notifications.service";

/**
 * Invite redeem → tells the inviter who joined. The name rides on the event payload, so this listener
 * holds no identity dependency. Best-effort: a failed notification never breaks the emitter. When a
 * study-buddy request went out with the redeem, that request's own notification (via-invite copy) is the
 * single message the inviter gets, so this one stays quiet. One row per redemption (dedupe key).
 * Reuses the FORUM category like the buddy notifications; the link lands on Settings where the invite card lives.
 */
@Injectable()
export class InviteEventsListener {
  private readonly logger = new Logger(InviteEventsListener.name);

  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(EconomyEventTopic.INVITE_REDEEMED)
  async onInviteRedeemed(e: InviteRedeemed): Promise<void> {
    if (e.buddyRequested) return;
    await this.notifications
      .createFromTemplate(e.inviterUserId, "FORUM", NotificationCopyKey.INVITE_JOINED, "/settings", {
        args: { name: e.invitedDisplayName },
        dedupeKey: `invite-joined:${e.redemptionId}`,
      })
      .catch((err: unknown) =>
        this.logger.warn(`invite notification failed for ${e.inviterUserId}: ${String(err)}`),
      );
  }
}
