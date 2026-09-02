import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  UserRole,
  type MentorshipInviteCodeDto,
  type MentorshipLinkStatus,
  type MentorshipStudentDto,
  type Paginated,
} from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { Roles } from "../../../common/auth/roles.decorator";
import { MentorshipInviteService } from "../application/mentorship-invite.service";
import { MentorshipLinkService } from "../application/mentorship-link.service";
import { ListMentorshipStudentsQueryDto, MentorshipStudentParamDto } from "./mentorship.dto";

/**
 * The coach's side of the mentorship surface (W8).
 *
 * `@Roles(COACH)` is necessary but not sufficient: it only says "this person may coach someone".
 * Whether they may see THIS student is decided by `MentorshipLinkService.requireActiveLink`, which
 * unlike the guard grants no admin bypass.
 */
@ApiTags("mentorship")
@ApiBearerAuth()
@Roles(UserRole.COACH)
@Controller("mentorship")
export class MentorshipCoachController {
  constructor(
    private readonly links: MentorshipLinkService,
    private readonly invites: MentorshipInviteService,
  ) {}

  @Get("invite-code")
  async getInviteCode(@CurrentUser() user: RequestUser): Promise<MentorshipInviteCodeDto | null> {
    await this.links.assertEnabled();
    return this.invites.getCurrent(user.id);
  }

  @Post("invite-code")
  @HttpCode(HttpStatus.OK)
  async rotateInviteCode(@CurrentUser() user: RequestUser): Promise<MentorshipInviteCodeDto> {
    await this.links.assertEnabled();
    return this.invites.rotate(user.id);
  }

  @Get("students")
  listStudents(
    @CurrentUser() user: RequestUser,
    @Query() query: ListMentorshipStudentsQueryDto,
  ): Promise<Paginated<MentorshipStudentDto>> {
    return this.links.listStudents(
      user.id,
      query.status as MentorshipLinkStatus,
      query.page,
      query.pageSize,
    );
  }

  @Delete("students/:studentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  endLink(
    @CurrentUser() user: RequestUser,
    @Param() params: MentorshipStudentParamDto,
  ): Promise<void> {
    return this.links.endByCoach(user.id, params.studentId);
  }
}
