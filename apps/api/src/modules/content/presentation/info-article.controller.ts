import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { InfoArticleDto, InfoArticleSummaryDto, Paginated } from "@mentor/types";
import { Public } from "../../../common/auth/public.decorator";
import { ContentService } from "../application/content.service";
import { FeaturedArticleQueryDto, ListInfoArticlesQueryDto } from "./content.dto";

/** Public editorial knowledge-center articles (guardrail §4 #1). */
@ApiTags("content")
@Public()
@Controller("content/info-articles")
export class InfoArticleController {
  constructor(private readonly content: ContentService) {}

  @Get()
  @ApiQuery({ name: "family", enum: ["KPSS", "YKS", "LGS"] })
  @ApiQuery({ name: "category", enum: ["EXAM_PROCESS", "APPLICATION", "GENERAL"], required: false })
  @ApiQuery({ name: "excludeSlug", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  listArticles(
    @Query() query: ListInfoArticlesQueryDto,
  ): Promise<Paginated<InfoArticleSummaryDto>> {
    return this.content.listInfoArticles(query);
  }

  @Get("featured")
  @ApiQuery({ name: "family", enum: ["KPSS", "YKS", "LGS"] })
  getFeatured(
    @Query() query: FeaturedArticleQueryDto,
  ): Promise<InfoArticleSummaryDto | null> {
    return this.content.getFeaturedArticle(query.family);
  }

  @Post(":slug/views")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  recordView(@Param("slug") slug: string): Promise<void> {
    return this.content.recordArticleView(slug);
  }

  @Get(":slug")
  getArticle(@Param("slug") slug: string): Promise<InfoArticleDto> {
    return this.content.getInfoArticleBySlug(slug);
  }
}
