import { Controller, HttpCode, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { GhostNarrationDto } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { GhostNarrationService } from "../application/ghost-narration.service";

/**
 * Premium AI "geçmiş-ben" progress narration (W3). No body — grounds on the user's latest attempt
 * vs their own past. Returns the cached narration when one exists (idempotent per attempt; §4 #5).
 */
@ApiTags("ai")
@ApiBearerAuth()
@Controller("coach")
export class AiGhostController {
  constructor(private readonly ghost: GhostNarrationService) {}

  @Post("ghost-narration")
  @HttpCode(200)
  narrate(@CurrentUser() user: RequestUser): Promise<GhostNarrationDto> {
    return this.ghost.narrate(user);
  }
}
