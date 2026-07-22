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
    await this.notifications.createInApp(
      event.userId,
      "COACH",
      "Seriniz sıfırlandı",
      `${event.previousStreak} günlük seriniz sona erdi. Bugün yeniden başlayabilirsin! 💪`,
      "/dashboard",
    ).catch(() => {});
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
    const m = event.milestone;
    const body =
      m >= 100
        ? "Bu inanılmaz bir kararlılık."
        : m >= 30
          ? "Otuz gün! Bu düzenlilik sınav başarısının temelidir."
          : m >= 14
            ? "İki haftadır düzenli çalışıyorsunuz. Devam edin!"
            : "7 günlük çalışma serinizi tamamladınız. Harika bir başlangıç!";
    await this.notifications.createInApp(event.userId, "COACH", `${m} günlük seri! 🔥`, body, "/dashboard").catch(() => {});
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
    await this.notifications.createInApp(
      event.userId,
      "COACH",
      "Bugün zor bir gün olmuş olabilir",
      "Moraliniz biraz düşük görünüyor. Küçük bir adım bile yeterli — seninleyiz. 💙",
      "/dashboard",
    ).catch(() => {});
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
    await this.notifications.createInApp(
      event.userId,
      "COACH",
      "Günün ilk adımı atıldı! ✨",
      "İlk seans tamamlandı. En zor adım buydu — devam et!",
      "/study-session",
    ).catch(() => {});
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
    await this.notifications.createInApp(
      event.userId,
      "PLAN",
      "Günlük planı tamamladın! ✅",
      `${event.tasksCount} görevin hepsini bitirdin. Bugün harika gitti.`,
      "/dashboard",
    ).catch(() => {});
  }
}
