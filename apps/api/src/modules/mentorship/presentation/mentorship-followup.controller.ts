import { Body, Controller, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { Roles } from "../../../common/auth/roles.decorator";
import { MentorshipFollowupService } from "../application/mentorship-followup.service";
import { CoachFollowupPageDto, CoachFollowupResponseDto, CreateMentorshipFollowupDto, FollowupAvailabilityResponseDto, FollowupPaginationQueryDto, FollowupParamDto, FollowupStudentParamDto, ListMentorshipFollowupsQueryDto, RespondMentorshipFollowupDto, SharedFollowupPageDto, SharedFollowupResponseDto, StudentFollowupParamDto, UpdateMentorshipFollowupDto } from "./mentorship-followup.dto";

@ApiTags("mentorship-followups")
@ApiBearerAuth()
@Controller("mentorship")
export class MentorshipFollowupController {
  constructor(private readonly followups: MentorshipFollowupService) {}

  @Get("followups/availability")
  @ApiOkResponse({ type: FollowupAvailabilityResponseDto })
  getFollowupAvailability(): Promise<FollowupAvailabilityResponseDto> { return this.followups.getAvailability(); }

  @Get("followups")
  @Roles(UserRole.COACH)
  @ApiOkResponse({ type: CoachFollowupPageDto })
  listFollowups(@CurrentUser() user: RequestUser, @Query() query: ListMentorshipFollowupsQueryDto): Promise<CoachFollowupPageDto> { return this.followups.listCoach(user.id, query); }

  @Post("students/:studentId/followups")
  @Roles(UserRole.COACH)
  @ApiCreatedResponse({ type: CoachFollowupResponseDto })
  createFollowup(@CurrentUser() user: RequestUser, @Param() params: FollowupStudentParamDto, @Body() body: CreateMentorshipFollowupDto): Promise<CoachFollowupResponseDto> { return this.followups.create(user.id, params.studentId, body); }

  @Patch("students/:studentId/followups/:followupId")
  @Roles(UserRole.COACH)
  @ApiOkResponse({ type: CoachFollowupResponseDto })
  updateFollowup(@CurrentUser() user: RequestUser, @Param() params: StudentFollowupParamDto, @Body() body: UpdateMentorshipFollowupDto): Promise<CoachFollowupResponseDto> { return this.followups.update(user.id, params.studentId, params.followupId, body); }

  @Get("my-coach/followups")
  @ApiOkResponse({ type: SharedFollowupPageDto })
  listSharedFollowups(@CurrentUser() user: RequestUser, @Query() query: FollowupPaginationQueryDto): Promise<SharedFollowupPageDto> { return this.followups.listStudent(user.id, query); }

  @Put("my-coach/followups/:followupId/response")
  @ApiOkResponse({ type: SharedFollowupResponseDto })
  respondToFollowup(@CurrentUser() user: RequestUser, @Param() params: FollowupParamDto, @Body() body: RespondMentorshipFollowupDto): Promise<SharedFollowupResponseDto> { return this.followups.respond(user.id, params.followupId, body); }
}

