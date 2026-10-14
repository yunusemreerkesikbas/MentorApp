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
import { CommunityCoachPlanTaskService } from "./community-coach-plan-task.service";

/** Executes only an explicitly accepted, backend-allowlisted coach action. */
@Injectable()
export class CoachActionService {
  constructor(
    private readonly messages: CoachMessageRepository,
    private readonly plans: PlanService,
    @Optional() private readonly sessions?: SessionService,
    @Optional() private readonly communityTasks?: CommunityCoachPlanTaskService,
  ) {}

  async decide(
    userId: string,
    messageId: string,
    decision: CoachActionDecisionInput["decision"],
  ): Promise<CoachActionResultDto> {
    const owned = await this.messages.getOwnedCoachAction(userId, messageId);
    if (!owned) throw new NotFoundError();
    // The conversation only routes the task; it is not part of the action result.
    const { conversationId, ...stored } = owned;
    let current: CoachActionResultDto = stored;

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
        const latest = await this.messages.getOwnedCoachAction(userId, messageId);
        if (!latest || latest.status !== CoachActionStatus.ACCEPTED) {
          throw new ConflictError();
        }
        current = { action: latest.action, status: latest.status, resultRefId: latest.resultRefId };
      } else {
        current = { ...current, status: CoachActionStatus.ACCEPTED };
      }
    }

    let resultRefId = current.resultRefId;
    if (!resultRefId) {
      resultRefId = await this.execute(userId, messageId, conversationId, current.action);
      if (resultRefId)
        await this.messages.setActionResult(userId, messageId, resultRefId);
    }
    const session =
      current.action.type === CoachActionType.START_PLAN_SESSION &&
      resultRefId &&
      this.sessions
        ? await this.sessions.getFromAiCoach(userId, resultRefId)
        : undefined;
    return { ...current, resultRefId, ...(session ? { session } : {}) };
  }

  private async execute(
    userId: string,
    messageId: string,
    conversationId: string,
    action: CoachActionResultDto["action"],
  ): Promise<string | null> {
    switch (action.type) {
      case CoachActionType.CREATE_PLAN_TASK: {
        // A chat opened from a community thread keeps that source on the task, so finishing it can
        // lead back to the discussion. No live source (flag off, thread gone) = an ordinary AI task.
        const community = await this.communityTasks?.createForCoachMessage(
          userId,
          conversationId,
          action.payload,
          messageId,
        );
        if (community) return community.id;
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
