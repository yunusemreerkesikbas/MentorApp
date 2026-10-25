import { Controller, Get, HttpStatus, Param } from "@nestjs/common";
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { inviteCodeSchema } from "@mentor/validation";
import { Public } from "../../../common/auth/public.decorator";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { InviteService } from "../application/invite.service";
import { InvitePreviewViewDto } from "./economy.dto";

/**
 * What a friend sees on the invite landing before signing up. Public, so it answers with the
 * inviter's display name only and is rate limited (it is the one door that tells a stranger whether a
 * code exists). A separate controller keeps `@Public()` off the self-scoped `EconomyController`.
 */
@ApiTags("economy")
@Public()
@Controller("economy/invite/preview")
export class InvitePreviewController {
  constructor(private readonly invites: InviteService) {}

  @Get(":code")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOkResponse({ type: InvitePreviewViewDto })
  @ApiNotFoundResponse({ description: "INVITE_CODE_INVALID: unknown, malformed or unusable code (also while the economy is off)" })
  preview(@Param("code") rawCode: string): Promise<InvitePreviewViewDto> {
    const parsed = inviteCodeSchema.safeParse(rawCode);
    // The landing shows one "invalid link" state, so a malformed code answers like an unknown one
    // (the validation pipe's 400 would tell a prober which of the two it hit).
    if (!parsed.success) throw new DomainError(ErrorCode.INVITE_CODE_INVALID, HttpStatus.NOT_FOUND);
    return this.invites.getPreview(parsed.data);
  }
}
