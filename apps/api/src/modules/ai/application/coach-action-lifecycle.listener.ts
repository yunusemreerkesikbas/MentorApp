import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  CoachingEventTopic,
  PlanTaskCompleted,
} from "../../coaching/domain/coaching.events";
import { CoachMessageRepository } from "../infrastructure/coach-message.repository";

/** Closes the mentor feedback loop when an accepted AI_COACH task is completed. */
@Injectable()
export class CoachActionLifecycleListener {
  constructor(private readonly messages: CoachMessageRepository) {}

  @OnEvent(CoachingEventTopic.PLAN_TASK_COMPLETED)
  async onPlanTaskCompleted(event: PlanTaskCompleted): Promise<void> {
    await this.messages.completeActionForResult(event.userId, event.taskId);
  }
}
