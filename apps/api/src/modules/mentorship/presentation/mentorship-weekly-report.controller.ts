import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import { I18nContext } from "nestjs-i18n";
import { UserRole } from "@mentor/types";
import type {
  MentorshipWeeklyReportDto,
  MentorshipWeeklyReportListItemDto,
  MentorshipWeeklyReportPreviewDto,
  MentorshipWeeklyReportShareDto,
  Paginated,
} from "@mentor/types";
import {
  CurrentUser,
  type RequestUser,
} from "../../../common/auth/current-user";
import { Roles } from "../../../common/auth/roles.decorator";
import type { PromptLocale } from "../../ai/domain/prompt-locale";
import { MentorshipWeeklyBriefService } from "../application/mentorship-weekly-brief.service";
import { MentorshipWeeklyReportService } from "../application/mentorship-weekly-report.service";
import { MentorshipStudentParamDto } from "./mentorship.dto";
import {
  FinalizeMentorshipWeeklyReportDto,
  ListMentorshipWeeklyReportsDto,
  MentorshipWeeklyBriefDto,
  MentorshipWeeklyPreviewQueryDto,
  MentorshipWeeklyReportParamDto,
  MentorshipWeeklyPreviewResponseDto,
  MentorshipWeeklyReportPageResponseDto,
  MentorshipWeeklyReportResponseDto,
  MentorshipWeeklyReportShareResponseDto,
} from "./mentorship-weekly-report.dto";

@ApiTags("mentorship-weekly-reports")
@ApiBearerAuth()
@Roles(UserRole.COACH)
@Controller("mentorship/students/:studentId/weekly-reports")
export class MentorshipWeeklyReportController {
  constructor(
    private readonly reports: MentorshipWeeklyReportService,
    private readonly briefs: MentorshipWeeklyBriefService,
  ) {}

  @Get("preview")
  @ApiOkResponse({ type: MentorshipWeeklyPreviewResponseDto })
  preview(
    @CurrentUser() user: RequestUser,
    @Param() params: MentorshipStudentParamDto,
    @Query() query: MentorshipWeeklyPreviewQueryDto,
  ): Promise<MentorshipWeeklyReportPreviewDto> {
    const locale = (I18nContext.current()?.lang ?? "tr") as PromptLocale;
    return this.reports.preview(
      user.id,
      params.studentId,
      query.weekStart,
      locale,
    );
  }

  @Get("brief")
  @ApiOkResponse({ type: MentorshipWeeklyPreviewResponseDto })
  readBrief(
    @CurrentUser() user: RequestUser,
    @Param() params: MentorshipStudentParamDto,
    @Query() query: MentorshipWeeklyPreviewQueryDto,
  ): Promise<MentorshipWeeklyReportPreviewDto> {
    const locale = (I18nContext.current()?.lang ?? "tr") as PromptLocale;
    return this.reports.preview(
      user.id,
      params.studentId,
      query.weekStart,
      locale,
    );
  }

  @Post("brief")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({ type: MentorshipWeeklyPreviewResponseDto })
  generateBrief(
    @CurrentUser() user: RequestUser,
    @Param() params: MentorshipStudentParamDto,
    @Body() dto: MentorshipWeeklyBriefDto,
  ): Promise<MentorshipWeeklyReportPreviewDto> {
    const locale = (I18nContext.current()?.lang ?? "tr") as PromptLocale;
    return this.briefs.request(
      { id: user.id, roles: user.roles },
      params.studentId,
      dto,
      locale,
    );
  }

  @Post("finalize")
  @ApiOkResponse({ type: MentorshipWeeklyReportResponseDto })
  finalize(
    @CurrentUser() user: RequestUser,
    @Param() params: MentorshipStudentParamDto,
    @Body() dto: FinalizeMentorshipWeeklyReportDto,
  ): Promise<MentorshipWeeklyReportDto> {
    const locale = (I18nContext.current()?.lang ?? "tr") as PromptLocale;
    return this.reports.finalize(user.id, params.studentId, dto, locale);
  }

  @Get()
  @ApiOkResponse({ type: MentorshipWeeklyReportPageResponseDto })
  list(
    @CurrentUser() user: RequestUser,
    @Param() params: MentorshipStudentParamDto,
    @Query() query: ListMentorshipWeeklyReportsDto,
  ): Promise<Paginated<MentorshipWeeklyReportListItemDto>> {
    return this.reports.list(
      user.id,
      params.studentId,
      query.page,
      query.pageSize,
    );
  }

  @Get(":reportId/share")
  @ApiOkResponse({ type: MentorshipWeeklyReportShareResponseDto })
  share(
    @CurrentUser() user: RequestUser,
    @Param() params: MentorshipWeeklyReportParamDto,
  ): Promise<MentorshipWeeklyReportShareDto> {
    return this.reports.share(user.id, params.studentId, params.reportId);
  }

  @Get(":reportId")
  @ApiOkResponse({ type: MentorshipWeeklyReportResponseDto })
  get(
    @CurrentUser() user: RequestUser,
    @Param() params: MentorshipWeeklyReportParamDto,
  ): Promise<MentorshipWeeklyReportDto> {
    return this.reports.get(user.id, params.studentId, params.reportId);
  }
}
