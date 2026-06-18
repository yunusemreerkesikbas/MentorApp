import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { CoachAccessDto } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { CoachAccessService } from "../application/coach-access.service";
import { ChatService, type CoachReplyResult } from "../application/chat.service";
import { AiChatDto } from "./ai.dto";

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
}
