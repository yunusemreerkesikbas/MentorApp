import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AnswerView, Paginated, QuestionDetail, ThreadView } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { ForumQaService } from "../application/forum-qa.service";
import { CreateAnswerDto, SearchQueryDto } from "./forum.dto";

/**
 * Forum Q&A (slice 3): answers, accept (asker-only, one-shot), question detail, full-text search.
 * Questions themselves are created via `POST /v1/forum/zones/:id/threads` (title-enforced for QA).
 * Reads open to any authed user (RLS); write/accept authz in the service (forum.policy). Flag-gated.
 */
@ApiTags("forum")
@ApiBearerAuth()
@Controller("forum")
export class ForumQaController {
  constructor(private readonly qa: ForumQaService) {}

  @Get("search")
  search(
    @CurrentUser() user: RequestUser,
    @Query() q: SearchQueryDto,
  ): Promise<Paginated<ThreadView>> {
    return this.qa.search(user.id, q);
  }

  @Get("threads/:threadId")
  question(
    @CurrentUser() user: RequestUser,
    @Param("threadId") threadId: string,
  ): Promise<QuestionDetail> {
    return this.qa.getQuestion(user.id, threadId);
  }

  @Get("threads/:threadId/answers")
  answers(
    @CurrentUser() user: RequestUser,
    @Param("threadId") threadId: string,
  ): Promise<AnswerView[]> {
    return this.qa.listAnswers(user.id, threadId);
  }

  // ponytail: static rate-limit; config-driven once abuse data warrants (shared note with thread post).
  @Post("threads/:threadId/answers")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  answer(
    @CurrentUser() user: RequestUser,
    @Param("threadId") threadId: string,
    @Body() dto: CreateAnswerDto,
  ): Promise<AnswerView> {
    return this.qa.answer({ id: user.id, roles: user.roles }, threadId, dto);
  }

  @Post("threads/:threadId/accept/:postId")
  async accept(
    @CurrentUser() user: RequestUser,
    @Param("threadId") threadId: string,
    @Param("postId") postId: string,
  ): Promise<{ status: string }> {
    await this.qa.accept({ id: user.id, roles: user.roles }, threadId, postId);
    return { status: "ok" };
  }

  @Delete("answers/:postId")
  @HttpCode(204)
  async removeAnswer(
    @CurrentUser() user: RequestUser,
    @Param("postId") postId: string,
  ): Promise<void> {
    await this.qa.removeAnswer({ id: user.id, roles: user.roles }, postId);
  }
}
