import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  CommunityEventTopic,
  type AchievementAwarded,
} from "../../../community/domain/community.events";
import {
  NotificationsService,
  REALTIME_QUEUE_TTL_MS,
} from "../notifications.service";

@Injectable()
export class AchievementEventsListener {
  private readonly logger = new Logger(AchievementEventsListener.name);

  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(CommunityEventTopic.ACHIEVEMENT_AWARDED)
  async onAwarded(event: AchievementAwarded): Promise<void> {
    if (event.source !== "LIVE") return;
    const link = event.username
      ? `/community/member/${event.username}?tab=achievements`
      : "/community";
    const created = await this.notifications
      .createInApp(
        event.userId,
        "ACHIEVEMENT",
        "Yeni bir başarı kazandın",
        "Yeni başarın koleksiyonuna eklendi.",
        link,
        {
          dedupeKey: `achievement:${event.achievementId}:v1`,
          data: { kind: "ACHIEVEMENT", achievementId: event.achievementId },
          notifyRealtime: false,
        },
      )
      .catch((error: unknown) => {
        this.logger.warn(`achievement notification failed for ${event.userId}: ${String(error)}`);
        return false;
      });
    if (!created) return;
    this.notifications.pushRealtimeEvent(
      event.userId,
      "achievement_awarded",
      { achievementId: event.achievementId },
      REALTIME_QUEUE_TTL_MS,
    );
  }
}
