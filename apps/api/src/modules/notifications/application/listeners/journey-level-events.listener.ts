import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import {
  CommunityEventTopic,
  type JourneyLevelUnlocked,
} from "../../../community/domain/community.events";
import {
  NotificationsService,
  REALTIME_QUEUE_TTL_MS,
} from "../notifications.service";

@Injectable()
export class JourneyLevelEventsListener {
  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(CommunityEventTopic.JOURNEY_LEVEL_UNLOCKED)
  onUnlocked(event: JourneyLevelUnlocked): void {
    this.notifications.pushRealtimeEvent(
      event.userId,
      "journey_level_unlocked",
      { celebrationId: event.celebrationId, tier: event.tier },
      REALTIME_QUEUE_TTL_MS,
    );
  }
}
