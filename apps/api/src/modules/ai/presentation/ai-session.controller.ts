import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { SessionReflectionDto } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { SessionReflectionService } from "../application/session-reflection.service";
import { SessionReflectionBodyDto } from "./ai.dto";

/**
 * Premium AI reflection on a finalized study session (W3). Requires prior micro check-in.
 * Returns the cached reflection when one already exists (idempotent per session, §4 #5).
 */
@ApiTags("ai")
@ApiBearerAuth()
@Controller("coach")
export class AiSessionController {
  constructor(private readonly sessionReflection: SessionReflectionService) {}

  @Post("session-reflection")
  @HttpCode(200)
  reflect(
    @CurrentUser() user: RequestUser,
    @Body() dto: SessionReflectionBodyDto,
  ): Promise<SessionReflectionDto> {
    return this.sessionReflection.reflect(user, dto.sessionId);
  }
}
