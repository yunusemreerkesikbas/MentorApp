import { Inject, Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { CoachingEventTopic, FirstSessionOfDay } from "../../../coaching/domain/coaching.events";
import { todayIso } from "../../../coaching/domain/date.util";
import { BuddyService } from "../../../identity/application/buddy.service";
import { UsersRepository } from "../../../identity/infrastructure/users.repository";
import { DRIZZLE } from "../../../../database/database.constants";
import type { Database } from "../../../../database/drizzle";
import { withServiceContext } from "../../../../database/rls";
import { NotificationDeliveryRepository } from "../../infrastructure/notification-delivery.repository";
import { NotificationsService } from "../notifications.service";

/**
 * Passive buddy accountability signal: when a user completes the day's first (qualifying)
 * focus session, notify their active study buddy. Effort only (session completed — never
 * results); the partner already sees this via the buddy card, so no new data exposure.
 * Separate from CoachingEventsListener.onFirstSession (which self-notifies the actor);
 * EventEmitter2 fans FIRST_SESSION to both. Best-effort — never breaks the emitter.
 */
@Injectable()
export class BuddyActivityListener {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly buddy: BuddyService,
    private readonly usersRepo: UsersRepository,
    private readonly deliveries: NotificationDeliveryRepository,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

  @OnEvent(CoachingEventTopic.FIRST_SESSION)
  async onBuddyFirstSession(event: FirstSessionOfDay): Promise<void> {
    // Buddy-less users (the common case) bail after a single query.
    const pair = await this.buddy.getActivePair(event.userId).catch(() => undefined);
    if (!pair) return;
    const recipientId = pair.otherUserId;

    const template = "buddy-first-session";
    const ok = await withServiceContext(this.db, (tx) =>
      this.deliveries.tryRecord(tx, {
        userId: recipientId,
        channel: "IN_APP",
        template,
        // One per (partner, actor, day); FIRST_SESSION already fires once/day/actor.
        dedupeKey: `${template}:${event.userId}:${todayIso()}`,
      }),
    ).catch(() => false);
    if (!ok) return;

    // FirstSessionOfDay carries only userId → resolve the actor's name for the copy.
    const actor = await this.usersRepo.findByIdService(event.userId).catch(() => undefined);
    if (!actor) return;

    await this.notifications
      .createInApp(
        recipientId,
        "FORUM",
        "Yol arkadaşından haber",
        `${actor.displayName} bugün ilk seansını tamamladı 👏`,
        "/seans",
      )
      .catch(() => {});
  }
}
