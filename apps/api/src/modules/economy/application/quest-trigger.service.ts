import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { z } from "zod";
import { JOB_QUEUE_PORT, type JobQueuePort } from "../../../shared/ports/job-queue.port";
import { JobRunnerService } from "../../notifications/application/job-runner.service";
import { CoachingEventTopic, type PlanTaskCompleted } from "../../coaching/domain/coaching.events";
import { IdentityEventTopic } from "../../identity/domain/identity.events";
import { QuestService } from "./quest.service";

const JOB = "economy.evaluate-quests";
const payloadSchema = z.object({ userId: z.string().uuid(), date: z.string().date() });
type QuestTrigger = z.infer<typeof payloadSchema>;

/** Immediate feedback, with dated retries on the existing queue after committed source writes. */
@Injectable()
export class QuestTriggerService implements OnModuleInit {
  private readonly logger = new Logger(QuestTriggerService.name);
  constructor(
    private readonly quests: QuestService,
    @Inject(JOB_QUEUE_PORT) private readonly queue: JobQueuePort,
    private readonly runner: JobRunnerService,
  ) {}

  onModuleInit(): void {
    this.runner.registerHandler(JOB, async (raw) => {
      const payload = payloadSchema.parse(raw);
      await this.quests.evaluateAndGrant(payload.userId, payload.date, true);
    });
  }

  @OnEvent(IdentityEventTopic.PROFILE_UPDATED)
  @OnEvent(IdentityEventTopic.EMAIL_VERIFIED)
  @OnEvent(CoachingEventTopic.MOOD_SAVED)
  async evaluate(payload: QuestTrigger): Promise<void> {
    try {
      await this.quests.evaluateAndGrant(payload.userId, payload.date, true);
    } catch (err) {
      this.logger.error({ err }, "Quest evaluation deferred to retry queue");
      await this.queue.enqueue(JOB, payload).catch((queueError: unknown) => {
        this.logger.error({ err: queueError, userId: payload.userId, date: payload.date }, "Quest retry enqueue failed");
      });
    }
  }

  @OnEvent(CoachingEventTopic.PLAN_TASK_COMPLETED)
  onPlanTask(event: PlanTaskCompleted): Promise<void> {
    return this.evaluate({ userId: event.userId, date: event.taskDate });
  }
}
