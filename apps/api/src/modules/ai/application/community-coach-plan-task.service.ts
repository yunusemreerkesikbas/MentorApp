import { HttpStatus, Injectable } from "@nestjs/common";
import type { PlanTaskDto } from "@mentor/types";
import type { CreatePlanTaskInput } from "@mentor/validation";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { PlanService } from "../../coaching/application/plan.service";
import { ForumCoachBridgeService } from "../../forum/application/forum-coach-bridge.service";
import { CoachConversationRepository } from "../infrastructure/coach-conversation.repository";

/**
 * Secure hand-off from an owned community-origin coach conversation to a user-confirmed plan task.
 * It never invokes an LLM and never accepts forum provenance from the client.
 */
@Injectable()
export class CommunityCoachPlanTaskService {
  constructor(
    private readonly conversations: CoachConversationRepository,
    private readonly forum: ForumCoachBridgeService,
    private readonly plans: PlanService,
  ) {}

  async create(
    userId: string,
    conversationId: string,
    input: CreatePlanTaskInput,
  ): Promise<PlanTaskDto> {
    if (!(await this.conversations.isOwned(userId, conversationId))) {
      throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    const task = await this.createIfCommunity(userId, conversationId, input);
    if (!task) throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    return task;
  }

  /** Same hand-off, but null (not 404) for a non-community chat, so callers can fall back. */
  async createIfCommunity(
    userId: string,
    conversationId: string,
    input: CreatePlanTaskInput,
  ): Promise<PlanTaskDto | null> {
    const origin = await this.conversations.getOrigin(userId, conversationId);
    if (origin?.type !== "COMMUNITY_THREAD") return null;

    const bridge = await this.forum.getBridge(userId, origin.refId);
    return this.plans.createFromCommunityCoach(userId, input, {
      conversationId,
      threadId: bridge.threadId,
      intent: bridge.intent,
      zoneType: bridge.zone.type as "CHAT" | "QA",
    });
  }
}
