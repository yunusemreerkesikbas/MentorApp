import { Injectable, Optional } from "@nestjs/common";
import {
  CoachActionStatus,
  CoachActionType,
  type CoachActionResultDto,
} from "@mentor/types";
import type { CoachActionDecisionInput } from "@mentor/validation";
import {
  ConflictError,
  NotFoundError,
} from "../../../common/errors/domain-error";
import { PlanService } from "../../coaching/application/plan.service";
import { SessionService } from "../../coaching/application/session.service";
import { CoachMessageRepository } from "../infrastructure/coach-message.repository";

/** Executes only an explicitly accepted, backend-allowlisted coach action. */
@Injectable()
export class CoachActionService {
  constructor(
    private readonly messages: CoachMessageRepository,
    private readonly plans: PlanService,
    @Optional() private readonly sessions?: SessionService,
  ) {}

  async decide(
    userId: string,
    messageId: string,
    decision: CoachActionDecisionInput["decision"],
  ): Promise<CoachActionResultDto> {
    let current = await this.messages.getOwnedCoachAction(userId, messageId);
    if (!current) throw new NotFoundError();

    if (decision === "CANCEL") {
      if (current.status === CoachActionStatus.CANCELLED) return current;
      if (current.status !== CoachActionStatus.PROPOSED)
        throw new ConflictError();
      const cancelled = await this.messages.transitionAction(
        userId,
        messageId,
        CoachActionStatus.PROPOSED,
        CoachActionStatus.CANCELLED,
      );
      if (!cancelled) throw new ConflictError();
      return { ...current, status: CoachActionStatus.CANCELLED };
    }

    if (current.status === CoachActionStatus.COMPLETED) return current;
    if (current.status === CoachActionStatus.CANCELLED)
      throw new ConflictError();
    if (current.status === CoachActionStatus.PROPOSED) {
      const claimed = await this.messages.transitionAction(
        userId,
        messageId,
        CoachActionStatus.PROPOSED,
        CoachActionStatus.ACCEPTED,
      );
      if (!claimed) {
        current = await this.messages.getOwnedCoachAction(userId, messageId);
        if (!current || current.status !== CoachActionStatus.ACCEPTED) {
          throw new ConflictError();
        }
      } else {
        current = { ...current, status: CoachActionStatus.ACCEPTED };
      }
    }

    if (current.resultRefId) return current;
    const resultRefId = await this.execute(userId, messageId, current.action);
    if (resultRefId) {
      await this.messages.setActionResult(userId, messageId, resultRefId);
    }
    return { ...current, resultRefId };
  }

  private async execute(
    userId: string,
    messageId: string,
    action: CoachActionResultDto["action"],
  ): Promise<string | null> {
    switch (action.type) {
      case CoachActionType.CREATE_PLAN_TASK: {
        const task = await this.plans.createFromAiCoach(
          userId,
          action.payload,
          messageId,
        );
        return task.id;
      }
      case CoachActionType.START_PLAN_SESSION: {
        if (!this.sessions) throw new ConflictError();
        const session = await this.sessions.startFromAiCoach(
          userId,
          action.payload.planTaskId,
        );
        return session.id;
      }
      case CoachActionType.OPEN_PLAN_ADAPTATION:
      case CoachActionType.NAVIGATE:
        // These actions only authorize the client to open a known product surface.
        return null;
    }
  }
}
