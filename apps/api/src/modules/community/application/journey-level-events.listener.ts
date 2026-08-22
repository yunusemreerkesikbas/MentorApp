import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import {
  EconomyEventTopic,
  type EconomyXpChanged,
} from "../../economy/domain/economy.events";
import { JourneyLevelCelebrationService } from "./journey-level-celebration.service";

@Injectable()
export class JourneyLevelEventsListener {
  constructor(private readonly celebrations: JourneyLevelCelebrationService) {}

  @OnEvent(EconomyEventTopic.XP_CHANGED)
  onXpChanged(event: EconomyXpChanged): Promise<void> {
    return this.celebrations.synchronizeLive(event.userId, event.level, event.occurredAt);
  }
}
