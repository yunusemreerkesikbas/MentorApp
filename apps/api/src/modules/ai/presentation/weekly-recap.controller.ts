import { Body, Controller, Get, Headers, HttpStatus, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { WeeklyRecapService } from "../application/weekly-recap.service";
import { OpenWeeklyRecapBodyDto, WeeklyRecapArchiveQueryDto, WeeklyRecapArchiveResponseDto,
  WeeklyRecapOfferQueryDto, WeeklyRecapOfferResponseDto, WeeklyRecapReportResponseDto } from "./weekly-recap.dto";

@ApiTags("weekly-recaps")
@ApiBearerAuth()
@Controller("coach/weekly-recaps")
export class WeeklyRecapController {
  constructor(private readonly recaps: WeeklyRecapService) {}
  @Get("access")
  @ApiOkResponse({ type: WeeklyRecapOfferResponseDto })
  offer(@CurrentUser() user: RequestUser, @Query() query: WeeklyRecapOfferQueryDto) {
    return this.recaps.offer(user, query.examId, query.weekStart);
  }
  @Get()
  @ApiOkResponse({ type: WeeklyRecapArchiveResponseDto })
  archive(@CurrentUser() user: RequestUser, @Query() query: WeeklyRecapArchiveQueryDto) {
    return this.recaps.archive(user.id, query.page, query.pageSize);
  }
  @Post()
  @ApiHeader({ name: "Idempotency-Key", required: true, schema: { type: "string", format: "uuid" }, description: "Must match clientRequestId" })
  @ApiCreatedResponse({ type: WeeklyRecapReportResponseDto })
  open(@CurrentUser() user: RequestUser, @Body() body: OpenWeeklyRecapBodyDto, @Headers("idempotency-key") key?: string) {
    if (key !== body.clientRequestId) throw new DomainError(ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST);
    return this.recaps.open(user, body);
  }
  @Get(":id")
  @ApiOkResponse({ type: WeeklyRecapReportResponseDto })
  read(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.recaps.read(user.id, id);
  }
}
