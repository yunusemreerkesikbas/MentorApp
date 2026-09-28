import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  MentorshipInvitationPreviewDto,
  MentorshipSharedDataDto,
  MentorshipWeeklyReportListItemDto,
  MentorshipWeeklyReportShareDto,
  MyCoachDto,
  Paginated,
} from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { MentorshipLinkService } from "../application/mentorship-link.service";
import { MentorshipSelfViewService } from "../application/mentorship-self-view.service";
import { MentorshipWeeklyReportService } from "../application/mentorship-weekly-report.service";
import { MentorshipInviteCodeParamDto, MentorshipStudentNoteDto } from "./mentorship.dto";
import {
  ListMentorshipWeeklyReportsDto,
  MentorshipWeeklyReportPageResponseDto,
  MentorshipWeeklyReportShareResponseDto,
  MyWeeklyReportParamDto,
} from "./mentorship-weekly-report.dto";

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
  constructor(
    private readonly links: MentorshipLinkService,
    private readonly selfView: MentorshipSelfViewService,
    private readonly weeklyReports: MentorshipWeeklyReportService,
  ) {}

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

  /**
   * The numbers currently travelling to my coach.
   *
   * Its own route rather than a field on `GET /my-coach`, because that DTO is also what
   * `POST /invitations/accept` returns and running the evidence queries would make accepting an
   * invitation pay for a screen nobody is looking at yet. Empty body when there is no coach — the
   * `GET /my-coach` convention, and honest: nothing is being shared, so there is nothing to mirror.
   */
  @Get("my-coach/data")
  sharedData(
    @CurrentUser() user: RequestUser,
  ): Promise<MentorshipSharedDataDto | null> {
    return this.selfView.getSharedData(user.id);
  }

  /**
   * My standing note to my coach (QA F4), read back on my `/my-coach` screen and shown on my
   * coach's report. PUT because it replaces a singleton; `{ body: null }` removes it. Not a thread:
   * in-app conversation is Phase 3 (roadmap §9).
   */
  @Put("my-coach/note")
  @HttpCode(HttpStatus.NO_CONTENT)
  setNote(@CurrentUser() user: RequestUser, @Body() dto: MentorshipStudentNoteDto): Promise<void> {
    return this.links.setStudentNote(user.id, dto.body);
  }

  /**
   * The weeks my coach finalized, each once at its latest version: the page the coach would print
   * for me, through my live link only (404 without one).
   */
  @Get("my-coach/weekly-reports")
  @ApiOkResponse({ type: MentorshipWeeklyReportPageResponseDto })
  myWeeklyReports(
    @CurrentUser() user: RequestUser,
    @Query() query: ListMentorshipWeeklyReportsDto,
  ): Promise<Paginated<MentorshipWeeklyReportListItemDto>> {
    return this.weeklyReports.listForStudent(user.id, query.page, query.pageSize);
  }

  @Get("my-coach/weekly-reports/:reportId")
  @ApiOkResponse({ type: MentorshipWeeklyReportShareResponseDto })
  myWeeklyReport(
    @CurrentUser() user: RequestUser,
    @Param() params: MyWeeklyReportParamDto,
  ): Promise<MentorshipWeeklyReportShareDto> {
    return this.weeklyReports.shareForStudent(user.id, params.reportId);
  }

  @Delete("my-coach")
  @HttpCode(HttpStatus.NO_CONTENT)
  endLink(@CurrentUser() user: RequestUser): Promise<void> {
    return this.links.endByStudent(user.id);
  }
}
