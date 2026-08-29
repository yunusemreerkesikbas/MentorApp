import { Inject, Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  CoachingEventTopic,
  DailyPlanCompleted,
  FirstSessionOfDay,
  MoodLow,
  StreakBroken,
  StreakMilestone,
} from "../../../coaching/domain/coaching.events";
import { DRIZZLE } from "../../../../database/database.constants";
import type { Database } from "../../../../database/drizzle";
import { withServiceContext } from "../../../../database/rls";
import { todayIso } from "../../../coaching/domain/date.util";
import { NotificationCopyKey, streakMilestoneCopyKey } from "../../domain/notification-copy";
import { NotificationDeliveryRepository } from "../../infrastructure/notification-delivery.repository";
import { NotificationsService } from "../notifications.service";

/** Consumes coaching domain events → in-app notifications. */
@Injectable()
export class CoachingEventsListener {
  constructor(
    private readonly notifications: NotificationsService,
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly deliveries: NotificationDeliveryRepository,
  ) {}

  @OnEvent(CoachingEventTopic.STREAK_BROKEN)
  async onStreakBroken(event: StreakBroken): Promise<void> {
    await this.notifications
      .createFromTemplate(event.userId, "COACH", NotificationCopyKey.STREAK_BROKEN, "/dashboard", {
        args: { days: event.previousStreak },
      })
      .catch(() => {});
  }

  @OnEvent(CoachingEventTopic.STREAK_MILESTONE)
  async onStreakMilestone(event: StreakMilestone): Promise<void> {
    const template = "contextual-streak-milestone";
    const ok = await withServiceContext(this.db, (tx) =>
      this.deliveries.tryRecord(tx, {
        userId: event.userId,
        channel: "IN_APP",
        template,
        dedupeKey: `${template}:${todayIso()}`,
      }),
    ).catch(() => false);
    if (!ok) return;
    const key = streakMilestoneCopyKey(event.milestone);
    await this.notifications
      .createFromTemplate(event.userId, "COACH", key, "/dashboard", {
        args: { days: event.milestone },
      })
      .catch(() => {});
  }

  @OnEvent(CoachingEventTopic.MOOD_LOW)
  async onMoodLow(event: MoodLow): Promise<void> {
    const template = "contextual-low-mood";
    const ok = await withServiceContext(this.db, (tx) =>
      this.deliveries.tryRecord(tx, {
        userId: event.userId,
        channel: "IN_APP",
        template,
        dedupeKey: `${template}:${todayIso()}`,
      }),
    ).catch(() => false);
    if (!ok) return;
    await this.notifications
      .createFromTemplate(event.userId, "COACH", NotificationCopyKey.MOOD_LOW, "/dashboard")
      .catch(() => {});
  }

  @OnEvent(CoachingEventTopic.FIRST_SESSION)
  async onFirstSession(event: FirstSessionOfDay): Promise<void> {
    const template = "contextual-first-session";
    const ok = await withServiceContext(this.db, (tx) =>
      this.deliveries.tryRecord(tx, {
        userId: event.userId,
        channel: "IN_APP",
        template,
        dedupeKey: `${template}:${todayIso()}`,
      }),
    ).catch(() => false);
    if (!ok) return;
    await this.notifications
      .createFromTemplate(event.userId, "COACH", NotificationCopyKey.FIRST_SESSION, "/study-session")
      .catch(() => {});
  }

  @OnEvent(CoachingEventTopic.PLAN_COMPLETED)
  async onPlanCompleted(event: DailyPlanCompleted): Promise<void> {
    const template = "contextual-plan-complete";
    const ok = await withServiceContext(this.db, (tx) =>
      this.deliveries.tryRecord(tx, {
        userId: event.userId,
        channel: "IN_APP",
        template,
        dedupeKey: `${template}:${todayIso()}`,
      }),
    ).catch(() => false);
    if (!ok) return;
    await this.notifications
      .createFromTemplate(event.userId, "PLAN", NotificationCopyKey.PLAN_COMPLETED, "/dashboard", {
        args: { count: event.tasksCount },
      })
      .catch(() => {});
  }
}
