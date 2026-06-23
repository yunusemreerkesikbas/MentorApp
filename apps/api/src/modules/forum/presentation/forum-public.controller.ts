import { Controller, Get, HttpStatus, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { PublicQuestionRef, PublicQuestionView } from "@mentor/types";
import { Public } from "../../../common/auth/public.decorator";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ForumPublicService } from "../application/forum-public.service";

/** Anonymous (SEO) forum reads — only indexable QA questions. No auth (crawlers). */
@ApiTags("forum")
@Public()
@Controller("forum/public")
export class ForumPublicController {
  constructor(private readonly publicForum: ForumPublicService) {}

  /** Sitemap source: indexable QA question refs (id + updatedAt). */
  @Get("questions")
  questions(@Query("limit") limit?: string): Promise<PublicQuestionRef[]> {
    const parsed = Number(limit);
    const safe = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 5000) : 1000;
    return this.publicForum.listQuestionRefs(safe);
  }

  @Get("questions/:id")
  async question(@Param("id") id: string): Promise<PublicQuestionView> {
    const view = await this.publicForum.getQuestion(id);
    if (!view) throw new DomainError(ErrorCode.FORUM_THREAD_NOT_FOUND, HttpStatus.NOT_FOUND);
    return view;
  }
}
