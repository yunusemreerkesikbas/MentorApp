import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { InfoArticleDto, InfoArticleSummaryDto, Paginated } from "@mentor/types";
import { Public } from "../../../common/auth/public.decorator";
import { ContentService } from "../application/content.service";
import { ListInfoArticlesQueryDto } from "./content.dto";

/** Public editorial knowledge-center articles (guardrail §4 #1). */
@ApiTags("content")
@Public()
@Controller("content/info-articles")
export class InfoArticleController {
  constructor(private readonly content: ContentService) {}

  @Get()
  listArticles(
    @Query() query: ListInfoArticlesQueryDto,
  ): Promise<Paginated<InfoArticleSummaryDto>> {
    return this.content.listInfoArticles(query);
  }

  @Get(":slug")
  getArticle(@Param("slug") slug: string): Promise<InfoArticleDto> {
    return this.content.getInfoArticleBySlug(slug);
  }
}
