import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  CoachingEventTopic,
  StudySessionCompleted,
} from "../../coaching/domain/coaching.events";
import { QuestService } from "./quest.service";

/**
 * Bridges coaching → economy quests: when a study session is completed, re-evaluate the user's
 * quests (grants the daily focus-session ritual + any reached focus milestone). Idempotent;
 * `evaluateAndGrant` self-guards on `economy.enabled`. Consumes the existing coaching event —
 * no change to coaching (§4: coin never in chat, reward tied to a verified action; §2 boundaries:
 * coaching never calls economy).
 */
@Injectable()
export class SessionCompletedListener {
  constructor(private readonly quests: QuestService) {}

  @OnEvent(CoachingEventTopic.SESSION_COMPLETED)
  async onSessionCompleted(event: StudySessionCompleted): Promise<void> {
    await this.quests.evaluateAndGrant(event.userId);
  }
}
