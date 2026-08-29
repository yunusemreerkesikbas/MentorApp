import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  CoachingEventTopic,
  StudyRoomSessionStarted,
} from "../../../coaching/domain/coaching.events";
import { todayIso } from "../../../coaching/domain/date.util";
import { StudyRoomService } from "../../../coaching/application/study-room.service";
import { UsersRepository } from "../../../identity/infrastructure/users.repository";
import { DRIZZLE } from "../../../../database/database.constants";
import type { Database } from "../../../../database/drizzle";
import { withServiceContext } from "../../../../database/rls";
import { NotificationCopyKey } from "../../domain/notification-copy";
import { NotificationDeliveryRepository } from "../../infrastructure/notification-delivery.repository";
import { NotificationsService } from "../notifications.service";

/**
 * "Masa açıldı": when a member sits down at a study room, the room's other members get a quiet
 * in-app notification. This is the trigger body-doubling actually needs — without it a table is
 * usually found empty, because nobody knows when anyone else starts.
 *
 * Deliberately NOT a modal (unlike the buddy study-invite this replaces): someone sitting down
 * is a signal, not an invitation, and popping a dialog for every arrival at a ten-seat table
 * would sabotage the very focus the room exists for.
 *
 * Capped at one notification per (recipient, room, actor, day) via the delivery ledger, so a
 * member starting five Pomodoros in a row notifies the table once. Best-effort throughout —
 * a notification failure must never break the emitter (and never the session start).
 */
@Injectable()
export class StudyRoomActivityListener {
  private readonly logger = new Logger(StudyRoomActivityListener.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly rooms: StudyRoomService,
    private readonly usersRepo: UsersRepository,
    private readonly deliveries: NotificationDeliveryRepository,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

  @OnEvent(CoachingEventTopic.SESSION_STARTED)
  async onRoomSessionStarted(event: StudyRoomSessionStarted): Promise<void> {
    const targets = await this.rooms
      .getNotificationTargets(event.roomId, event.userId)
      .catch(() => null);
    if (!targets || targets.memberIds.length === 0) return;

    // The event carries ids only — resolve the actor's name once for the whole fan-out.
    const actor = await this.usersRepo.findByIdService(event.userId).catch(() => undefined);
    if (!actor) return;

    const template = "study-room-session-started";
    const day = todayIso();

    for (const recipientId of targets.memberIds) {
      const ok = await withServiceContext(this.db, (tx) =>
        this.deliveries.tryRecord(tx, {
          userId: recipientId,
          channel: "IN_APP",
          template,
          dedupeKey: `${template}:${event.roomId}:${event.userId}:${day}`,
        }),
      ).catch(() => false);
      if (!ok) continue;

      await this.notifications
        .createFromTemplate(
          recipientId,
          "FORUM",
          NotificationCopyKey.STUDY_ROOM_SESSION_STARTED,
          `/study-session/rooms/${event.roomId}`,
          { args: { name: actor.displayName, roomName: targets.roomName } },
        )
        .catch((err: unknown) =>
          this.logger.warn(
            `study-room notification failed for ${recipientId}: ${String(err)}`,
          ),
        );
    }
  }
}
