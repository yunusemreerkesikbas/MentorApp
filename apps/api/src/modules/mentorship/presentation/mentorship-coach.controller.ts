import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  UserRole,
  type MentorshipBriefDto,
  type MentorshipCoachOverviewDto,
  type MentorshipInviteCodeDto,
  type MentorshipProgramTemplateDto,
  type MentorshipLinkStatus,
  type MentorshipRosterRowDto,
  type MentorshipStudentReportDto,
  type Paginated,
  type PlanTaskDto,
} from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { Roles } from "../../../common/auth/roles.decorator";
import { MentorshipAssignmentService } from "../application/mentorship-assignment.service";
import { MentorshipBriefService } from "../application/mentorship-brief.service";
import { MentorshipInviteService } from "../application/mentorship-invite.service";
import { MentorshipLinkService } from "../application/mentorship-link.service";
import { MentorshipRosterService } from "../application/mentorship-roster.service";
import { MentorshipTemplateService } from "../application/mentorship-template.service";
import {
  CreateMentorshipAssignmentsDto,
  ListMentorshipStudentsQueryDto,
  MentorshipCoachNoteDto,
  MentorshipStudentParamDto,
  MentorshipTemplateParamDto,
  SaveMentorshipTemplateDto,
} from "./mentorship.dto";

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
    private readonly assignments: MentorshipAssignmentService,
    private readonly templates: MentorshipTemplateService,
    private readonly brief: MentorshipBriefService,
  ) {}

  /**
   * The coach's landing state in one call: invite code, seats taken, and the data-scope contract.
   *
   * Replaces the older `GET /invite-code`, which could only ever answer half the question - a coach
   * whose roster is full needs to know that before handing the code to a 21st student, not after
   * that student is refused.
   */
  @Get("overview")
  async getOverview(@CurrentUser() user: RequestUser): Promise<MentorshipCoachOverviewDto> {
    await this.links.assertEnabled();
    return this.links.getCoachOverview(user.id);
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

  /** Assign plan tasks. They land in the student's own plan screen, badged as coach-assigned. */
  @Post("students/:studentId/assignments")
  // 21 tasks per call is the schema cap; this caps the calls, so a coach cannot flood a plan.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  assign(
    @CurrentUser() user: RequestUser,
    @Param() params: MentorshipStudentParamDto,
    @Body() dto: CreateMentorshipAssignmentsDto,
  ): Promise<PlanTaskDto[]> {
    return this.assignments.assign(user.id, params.studentId, dto);
  }

  /**
   * The coach's standing note to this student, shown on their `/my-coach` screen.
   *
   * PUT because it replaces a singleton rather than appending to a thread: there is one note per
   * link and `{ body: null }` removes it. In-app conversation is Phase 3 (roadmap §9).
   */
  @Put("students/:studentId/note")
  @HttpCode(HttpStatus.NO_CONTENT)
  setNote(
    @CurrentUser() user: RequestUser,
    @Param() params: MentorshipStudentParamDto,
    @Body() dto: MentorshipCoachNoteDto,
  ): Promise<void> {
    return this.links.setCoachNote(user.id, params.studentId, dto.body);
  }

  /**
   * Saved weekly programs. Note what is NOT here: an "apply" endpoint. Loading a template fills the
   * composer's drafts client-side and the coach still writes through `POST .../assignments`, so
   * there is one assignment path, not two, and the composer's subject/topic picker stays the gate
   * that keeps a template built for one exam off a student sitting another.
   */
  @Get("templates")
  listTemplates(@CurrentUser() user: RequestUser): Promise<MentorshipProgramTemplateDto[]> {
    return this.templates.list(user.id);
  }

  /** Upsert by name: saving over an existing name IS the edit, so there is no PUT. */
  @Post("templates")
  @HttpCode(HttpStatus.OK)
  saveTemplate(
    @CurrentUser() user: RequestUser,
    @Body() dto: SaveMentorshipTemplateDto,
  ): Promise<MentorshipProgramTemplateDto> {
    return this.templates.save(user.id, dto);
  }

  @Delete("templates/:templateId")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTemplate(
    @CurrentUser() user: RequestUser,
    @Param() params: MentorshipTemplateParamDto,
  ): Promise<void> {
    return this.templates.remove(user.id, params.templateId);
  }

  /**
   * The AI brief over one student's report (roadmap §9's "koç zekâ katmanı").
   *
   * POST, not GET: it may spend an LLM call and a quota unit, so it must never be something a
   * page load or a prefetch can trigger. The rule-based risk flags stay the floor — the brief
   * reads them, it does not replace them.
   *
   * Throttled tighter than the assignment path: this one costs money per call.
   */
  @Post("students/:studentId/brief")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  generateBrief(
    @CurrentUser() user: RequestUser,
    @Param() params: MentorshipStudentParamDto,
  ): Promise<MentorshipBriefDto> {
    return this.brief.generate({ id: user.id, roles: user.roles }, params.studentId);
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
