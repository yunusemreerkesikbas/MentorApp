import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type {
  CoachPlanAdaptationDto,
  CoachAccessDto,
  CoachChatStreamEvent,
  CoachPlanDraftDto,
  CoachConversationDto,
  CoachMemoryDto,
  CoachConversationMessagesDto,
  Paginated,
  PlanTaskDto,
  CoachProfileDto,
  CoachMemoryFactDto,
  CoachActionResultDto,
} from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import {
  CurrentUser,
  type RequestUser,
} from "../../../common/auth/current-user";
import { PlanAdaptationService } from "../application/plan-adaptation.service";
import { CoachAccessService } from "../application/coach-access.service";
import {
  ChatService,
  type CoachReplyResult,
} from "../application/chat.service";
import {
  AiChatDto,
  CoachFeedbackDto,
  ListCoachMessagesQueryDto,
  PlanAdaptationBodyDto,
  PlanDraftBodyDto,
  CommunityCoachPlanTaskDto,
  CoachProfilePatchDto,
  CoachMemoryFactPatchDto,
  CoachActionDecisionDto,
} from "./ai.dto";
import { PlanDraftService } from "../application/plan-draft.service";
import { CommunityCoachPlanTaskService } from "../application/community-coach-plan-task.service";
import { CoachProfileService } from "../application/coach-profile.service";
import { CoachActionService } from "../application/coach-action.service";

/**
 * AI coach chat (W3). Premium = flat + rate-limit; free = earned coin spend (economy.enabled).
 * Access probe for the web gate; chat never returns coin fields (§4 #3).
 */
@ApiTags("ai")
@ApiBearerAuth()
@Controller("coach")
export class AiChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly access: CoachAccessService,
    private readonly planDraft: PlanDraftService,
    private readonly planAdaptation: PlanAdaptationService,
    private readonly communityPlanTasks: CommunityCoachPlanTaskService,
    private readonly profile: CoachProfileService,
    private readonly actions: CoachActionService,
  ) {}

  @Get("access")
  getAccess(@CurrentUser() user: RequestUser): Promise<CoachAccessDto> {
    return this.access.getAccess(user.id, user.roles);
  }

  @Post("chat")
  reply(
    @CurrentUser() user: RequestUser,
    @Body() dto: AiChatDto,
  ): Promise<CoachReplyResult> {
    return this.chat.reply(
      user,
      dto.message,
      dto.clientMessageId,
      dto.conversationId,
      dto.contextMockExamId,
      dto.contextArticleSlug,
      dto.contextCommunityThreadId,
    );
  }

  /** Create a user-confirmed task from an owned community-origin coach conversation. */
  @Post("conversations/:id/plan-tasks")
  createCommunityPlanTask(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CommunityCoachPlanTaskDto,
  ): Promise<PlanTaskDto> {
    return this.communityPlanTasks.create(user.id, id, dto);
  }

  /**
   * Streaming chat (SSE over POST). The first event is awaited BEFORE headers are written so
   * gating errors (rate-limit, coin, ai.disabled) still surface as normal HTTP errors; after the
   * stream starts, failures are emitted as a terminal `error` event.
   */
  @Post("chat/stream")
  async replyStream(
    @CurrentUser() user: RequestUser,
    @Body() dto: AiChatDto,
    @Res() res: Response,
  ): Promise<void> {
    const stream = this.chat.replyStream(
      user,
      dto.message,
      dto.clientMessageId,
      dto.conversationId,
      dto.contextMockExamId,
      dto.contextArticleSlug,
      dto.contextCommunityThreadId,
    );
    // Pre-stream gating: let the first pull throw before SSE headers are committed.
    const first = await stream.next();

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const write = (event: CoachChatStreamEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      if (!first.done && first.value) write(first.value);
      for await (const event of stream) write(event);
    } catch (err) {
      const code = err instanceof DomainError ? err.code : "AI_PROVIDER_ERROR";
      write({ error: { code, message: "" } });
    } finally {
      res.end();
    }
  }

  /**
   * Koç yapımı haftalık plan TASLAĞI (premium). Preview only — nothing is persisted; the user
   * confirms in the FE and tasks are written via POST /v1/plan-tasks/bulk (W2).
   */
  @Post("plan-draft")
  planDraftPreview(
    @CurrentUser() user: RequestUser,
    @Body() dto: PlanDraftBodyDto,
  ): Promise<CoachPlanDraftDto> {
    return this.planDraft.draft(user, dto.note);
  }

  /** Premium adaptation preview. AI proposes; coaching mutates only after explicit confirmation. */
  @ApiBody({
    schema: {
      oneOf: [
        {
          type: "object",
          required: ["source"],
          additionalProperties: false,
          properties: {
            source: { type: "string", enum: ["PLAN"] },
            note: { type: "string", maxLength: 500 },
          },
        },
        {
          type: "object",
          required: ["source"],
          additionalProperties: false,
          properties: { source: { type: "string", enum: ["MOOD"] } },
        },
        {
          type: "object",
          required: ["source", "sessionId"],
          additionalProperties: false,
          properties: {
            source: { type: "string", enum: ["SESSION"] },
            sessionId: { type: "string", format: "uuid" },
          },
        },
      ],
    },
  })
  @Post("plan-adaptation")
  planAdaptationPreview(
    @CurrentUser() user: RequestUser,
    @Body() dto: PlanAdaptationBodyDto,
  ): Promise<CoachPlanAdaptationDto> {
    if (dto.source === "SESSION") {
      return this.planAdaptation.preview(user, {
        source: "SESSION",
        sessionId: dto.sessionId!,
      });
    }
    if (dto.source === "MOOD") {
      return this.planAdaptation.preview(user, { source: "MOOD" });
    }
    return this.planAdaptation.preview(user, {
      source: "PLAN",
      ...(dto.note ? { note: dto.note } : {}),
    });
  }

  /**
   * Regenerate the LAST coach reply of a thread (SSE over POST, no body). Same pre-stream gating
   * contract as `chat/stream`: the first event is awaited before headers are written.
   */
  @Post("conversations/:id/regenerate/stream")
  async regenerateStream(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const stream = this.chat.regenerateStream(user, id);
    const first = await stream.next();

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const write = (event: CoachChatStreamEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      if (!first.done && first.value) write(first.value);
      for await (const event of stream) write(event);
    } catch (err) {
      const code = err instanceof DomainError ? err.code : "AI_PROVIDER_ERROR";
      write({ error: { code, message: "" } });
    } finally {
      res.end();
    }
  }

  /** The user's chat threads, most-recently-active first ("Son sohbetler"). */
  @Get("conversations")
  listConversations(
    @CurrentUser() user: RequestUser,
    @Query() query: ListCoachMessagesQueryDto,
  ): Promise<Paginated<CoachConversationDto>> {
    return this.chat.listConversations(user.id, query.page, query.pageSize);
  }

  /** One thread's history, newest-first (ownership enforced). */
  @Get("conversations/:id/messages")
  listConversationMessages(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: ListCoachMessagesQueryDto,
  ): Promise<CoachConversationMessagesDto> {
    return this.chat.listConversationMessages(
      user.id,
      id,
      query.page,
      query.pageSize,
    );
  }

  /** Delete one thread (its messages cascade). The memory profile is kept. */
  @Delete("conversations/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteConversation(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.chat.deleteConversation(user.id, id);
  }

  /** Rate a coach reply (👍/👎/none). */
  @Patch("messages/:id/feedback")
  @HttpCode(HttpStatus.NO_CONTENT)
  setFeedback(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CoachFeedbackDto,
  ): Promise<void> {
    return this.chat.setMessageFeedback(user.id, id, dto.feedback);
  }

  @Get("profile")
  getProfile(@CurrentUser() user: RequestUser): Promise<CoachProfileDto> {
    return this.profile.getProfile(user.id);
  }

  @Patch("profile")
  patchProfile(
    @CurrentUser() user: RequestUser,
    @Body() dto: CoachProfilePatchDto,
  ): Promise<CoachProfileDto> {
    return this.profile.patchProfile(user.id, dto);
  }

  @Get("memories")
  listMemories(
    @CurrentUser() user: RequestUser,
    @Query() query: ListCoachMessagesQueryDto,
  ): Promise<Paginated<CoachMemoryFactDto>> {
    return this.profile.listMemories(user.id, query.page, query.pageSize);
  }

  @Patch("memories/:id")
  patchMemory(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CoachMemoryFactPatchDto,
  ): Promise<CoachMemoryFactDto> {
    return this.profile.updateMemory(user.id, id, dto);
  }

  @Delete("memories/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMemoryFact(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.profile.deleteMemory(user.id, id);
  }

  @Delete("memories")
  @HttpCode(HttpStatus.NO_CONTENT)
  clearMemoryFacts(@CurrentUser() user: RequestUser): Promise<void> {
    return this.profile.clearMemories(user.id);
  }

  @Post("messages/:messageId/action")
  decideAction(
    @CurrentUser() user: RequestUser,
    @Param("messageId", ParseUUIDPipe) messageId: string,
    @Body() dto: CoachActionDecisionDto,
  ): Promise<CoachActionResultDto> {
    return this.actions.decide(user.id, messageId, dto.decision);
  }

  /** The coach's distilled PII-free profile of the user (null until built). */
  @Get("memory")
  getMemory(@CurrentUser() user: RequestUser): Promise<CoachMemoryDto | null> {
    return this.chat.getMemory(user.id);
  }

  /** Reset the memory profile (user-controlled, KVKK). */
  @Delete("memory")
  @HttpCode(HttpStatus.NO_CONTENT)
  clearMemory(@CurrentUser() user: RequestUser): Promise<void> {
    return this.chat.clearMemory(user.id);
  }
}
