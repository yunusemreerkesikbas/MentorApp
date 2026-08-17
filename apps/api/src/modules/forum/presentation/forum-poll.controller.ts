import { Body, Controller, Param, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { ForumPollView } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { ForumPollService } from "../application/forum-poll.service";
import { PollVoteDto } from "./forum.dto";

@ApiTags("forum")
@ApiBearerAuth()
@Controller("forum/polls")
export class ForumPollController {
  constructor(private readonly polls: ForumPollService) {}

  @Post(":pollId/votes")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  vote(
    @CurrentUser() user: RequestUser,
    @Param("pollId") pollId: string,
    @Body() dto: PollVoteDto,
  ): Promise<ForumPollView> {
    return this.polls.vote(user.id, pollId, dto.optionId);
  }
}
