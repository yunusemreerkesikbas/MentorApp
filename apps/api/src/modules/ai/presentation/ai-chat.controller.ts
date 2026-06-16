import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { PremiumGuard } from "../../payments/presentation/premium.guard";
import { ChatService } from "../application/chat.service";
import { AiChatDto } from "./ai.dto";

/**
 * AI coach chat (W3 slice 1). Premium-only (§4 #4 — no AI on free): `PremiumGuard`. Single-turn,
 * stateless. Grounded on a PII-free context and forbidden from generating official info (§4 #1).
 */
@ApiTags("ai")
@ApiBearerAuth()
@UseGuards(PremiumGuard)
@Controller("coach")
export class AiChatController {
  constructor(private readonly chat: ChatService) {}

  @Post("chat")
  reply(
    @CurrentUser() user: RequestUser,
    @Body() dto: AiChatDto,
  ): Promise<{ reply: string; model: string }> {
    return this.chat.reply(user.id, dto.message);
  }
}
