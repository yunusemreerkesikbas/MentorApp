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
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type {
  CoachAccessDto,
  CoachChatStreamEvent,
  CoachMemoryDto,
  CoachMessageDto,
  Paginated,
} from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { CoachAccessService } from "../application/coach-access.service";
import { ChatService, type CoachReplyResult } from "../application/chat.service";
import { AiChatDto, CoachFeedbackDto, ListCoachMessagesQueryDto } from "./ai.dto";

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
  ) {}

  @Get("access")
  getAccess(@CurrentUser() user: RequestUser): Promise<CoachAccessDto> {
    return this.access.getAccess(user.id, user.roles);
  }

  @Post("chat")
  reply(@CurrentUser() user: RequestUser, @Body() dto: AiChatDto): Promise<CoachReplyResult> {
    return this.chat.reply(user, dto.message, dto.clientMessageId);
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
    const stream = this.chat.replyStream(user, dto.message, dto.clientMessageId);
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

  /** Persisted rolling history, newest-first (auth-only — reading your own history needs no gate). */
  @Get("messages")
  listMessages(
    @CurrentUser() user: RequestUser,
    @Query() query: ListCoachMessagesQueryDto,
  ): Promise<Paginated<CoachMessageDto>> {
    return this.chat.listMessages(user.id, query.page, query.pageSize);
  }

  /** "Yeni sohbet" — clears the user's own rolling conversation (and memory profile). */
  @Delete("messages")
  @HttpCode(HttpStatus.NO_CONTENT)
  clearMessages(@CurrentUser() user: RequestUser): Promise<void> {
    return this.chat.clearMessages(user.id);
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
