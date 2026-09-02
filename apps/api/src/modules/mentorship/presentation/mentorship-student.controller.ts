import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { MentorshipInvitationPreviewDto, MyCoachDto } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { MentorshipLinkService } from "../application/mentorship-link.service";
import { MentorshipInviteCodeParamDto } from "./mentorship.dto";

/**
 * The student's side (W8) - no role required: any student may be invited.
 *
 * The code travels in the BODY, not the path: an invite code is a bearer secret, and URLs land in
 * access logs, referrers and browser history. Preview and accept are throttled because a code is
 * guessable in principle (48 bits) and these are the only two endpoints that test one.
 */
@ApiTags("mentorship")
@ApiBearerAuth()
@Controller("mentorship")
export class MentorshipStudentController {
  constructor(private readonly links: MentorshipLinkService) {}

  /** What am I about to consent to? Rendered before the accept button, never after. */
  @Post("invitations/preview")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  preview(@Body() dto: MentorshipInviteCodeParamDto): Promise<MentorshipInvitationPreviewDto> {
    return this.links.previewInvitation(dto.code);
  }

  @Post("invitations/accept")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  accept(
    @CurrentUser() user: RequestUser,
    @Body() dto: MentorshipInviteCodeParamDto,
  ): Promise<MyCoachDto> {
    return this.links.acceptInvitation(user.id, dto.code);
  }

  @Get("my-coach")
  myCoach(@CurrentUser() user: RequestUser): Promise<MyCoachDto | null> {
    return this.links.getMyCoach(user.id);
  }

  @Delete("my-coach")
  @HttpCode(HttpStatus.NO_CONTENT)
  endLink(@CurrentUser() user: RequestUser): Promise<void> {
    return this.links.endByStudent(user.id);
  }
}
