import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  UserRole,
  type MentorshipInviteCodeDto,
  type MentorshipLinkStatus,
  type MentorshipRosterRowDto,
  type MentorshipStudentReportDto,
  type Paginated,
} from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { Roles } from "../../../common/auth/roles.decorator";
import { MentorshipInviteService } from "../application/mentorship-invite.service";
import { MentorshipLinkService } from "../application/mentorship-link.service";
import { MentorshipRosterService } from "../application/mentorship-roster.service";
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
    private readonly roster: MentorshipRosterService,
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

  /** Roster with rule-based triage, ordered worst-first. */
  @Get("students")
  listStudents(
    @CurrentUser() user: RequestUser,
    @Query() query: ListMentorshipStudentsQueryDto,
  ): Promise<Paginated<MentorshipRosterRowDto>> {
    return this.roster.listRoster(
      user.id,
      query.status as MentorshipLinkStatus,
      query.page,
      query.pageSize,
    );
  }

  /** One student's report. 404 unless this coach holds an ACTIVE link to them. */
  @Get("students/:studentId")
  getStudent(
    @CurrentUser() user: RequestUser,
    @Param() params: MentorshipStudentParamDto,
  ): Promise<MentorshipStudentReportDto> {
    return this.roster.getStudentReport(user.id, params.studentId);
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
