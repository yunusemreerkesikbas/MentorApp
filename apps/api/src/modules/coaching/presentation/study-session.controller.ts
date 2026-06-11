import { Body, Controller, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { StudySessionDto } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { SessionService } from "../application/session.service";
import { StartStudySessionDto, UpdateStudySessionDto } from "./coaching.dto";

/** Study (Pomodoro) sessions: start → complete/abandon. Authenticated self resource. */
@ApiTags("coaching")
@ApiBearerAuth()
@Controller("study-sessions")
export class StudySessionController {
  constructor(private readonly sessions: SessionService) {}

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
}
