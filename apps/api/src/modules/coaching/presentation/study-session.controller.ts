import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Paginated, StudySessionDto } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { SessionService } from "../application/session.service";
import {
  ListStudySessionsQueryDto,
  SessionFeedbackDto,
  StartStudySessionDto,
  UpdateStudySessionDto,
} from "./coaching.dto";

/** Study (Pomodoro) sessions: start → complete/abandon. Authenticated self resource. */
@ApiTags("coaching")
@ApiBearerAuth()
@Controller("study-sessions")
export class StudySessionController {
  constructor(private readonly sessions: SessionService) {}

  /** Paginated finalized-session history ("Son seanslar"). */
  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListStudySessionsQueryDto,
  ): Promise<Paginated<StudySessionDto>> {
    return this.sessions.list(user.id, query);
  }

  @Post()
  start(
    @CurrentUser() user: RequestUser,
    @Body() dto: StartStudySessionDto,
  ): Promise<StudySessionDto> {
    return this.sessions.start(user.id, dto);
  }

  @Patch(":id")
  finalize(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudySessionDto,
  ): Promise<StudySessionDto> {
    return this.sessions.finalize(user.id, id, dto);
  }

  /** Post-session micro check-in (mood 1-3 + optional note) — roadmap §258, AI difficulty signal. */
  @Patch(":id/feedback")
  recordFeedback(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SessionFeedbackDto,
  ): Promise<StudySessionDto> {
    return this.sessions.recordFeedback(user.id, id, dto);
  }
}
