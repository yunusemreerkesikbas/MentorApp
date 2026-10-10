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
import { CommunityCoachPlanTaskService } from "./community-coach-plan-task.service";
import { CoachMessageRepository } from "../infrastructure/coach-message.repository";

/** conversationId is internal routing data, never part of the public result. */
function stripInternal<T extends { conversationId?: string }>(
  row: T,
): Omit<T, "conversationId"> {
  const { conversationId: _omit, ...rest } = row;
  return rest;
}

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
    let current = await this.messages.getOwnedCoachAction(userId, messageId);
    if (!current) throw new NotFoundError();

    if (decision === "CANCEL") {
      if (current.status === CoachActionStatus.CANCELLED) return stripInternal(current);
      if (current.status !== CoachActionStatus.PROPOSED)
        throw new ConflictError();
      const cancelled = await this.messages.transitionAction(
        userId,
        messageId,
        CoachActionStatus.PROPOSED,
        CoachActionStatus.CANCELLED,
      );
      if (!cancelled) throw new ConflictError();
      return { ...stripInternal(current), status: CoachActionStatus.CANCELLED };
    }

    if (current.status === CoachActionStatus.COMPLETED) return stripInternal(current);
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

    let resultRefId = current.resultRefId;
    if (!resultRefId) {
      resultRefId = await this.execute(
        userId,
        messageId,
        current.action,
        current.conversationId,
      );
      if (resultRefId)
        await this.messages.setActionResult(userId, messageId, resultRefId);
    }
    const session =
      current.action.type === CoachActionType.START_PLAN_SESSION &&
      resultRefId &&
      this.sessions
        ? await this.sessions.getFromAiCoach(userId, resultRefId)
        : undefined;
    return { ...stripInternal(current), resultRefId, ...(session ? { session } : {}) };
  }

  private async execute(
    userId: string,
    messageId: string,
    action: CoachActionResultDto["action"],
    conversationId?: string,
  ): Promise<string | null> {
    switch (action.type) {
      case CoachActionType.CREATE_PLAN_TASK: {
        // A community-origin chat files the task as COMMUNITY_COACH (source link + return composer).
        const communityTask =
          conversationId && this.communityTasks
            ? await this.communityTasks.createIfCommunity(
                userId,
                conversationId,
                action.payload,
              )
            : null;
        if (communityTask) return communityTask.id;
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
