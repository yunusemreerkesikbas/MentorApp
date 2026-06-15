import { Body, Controller, Get, Param, Post, Query, Req, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Paginated } from "@mentor/types";
import { UserRole } from "@mentor/types";
import { Roles } from "../../../common/auth/roles.decorator";
import { ContentService, type AdminArticleView } from "../../content/application/content.service";
import { AuditAction, AuditTargetType } from "../domain/admin.constants";
import { AdminAuditInterceptor } from "./admin-audit.interceptor";
import { Audit } from "./audit.decorator";
import { setAuditContext, type AuditableRequest } from "./audit-context";
import { AdminListArticlesQueryDto, UpsertArticleDto } from "./admin.dto";

/**
 * Admin content editor (W6) — knowledge-center articles. Editorial only: trust metadata is required
 * (§4 #1, enforced by the Zod schema); the LLM never generates official info. ADMIN or EDITOR; every
 * write audited. Consumes the W1 `ContentService` (writes run in SERVICE context inside it).
 */
@ApiTags("admin")
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.EDITOR)
@UseInterceptors(AdminAuditInterceptor)
@Controller("admin/content/articles")
export class AdminContentController {
  constructor(private readonly content: ContentService) {}

  @Get()
  list(@Query() query: AdminListArticlesQueryDto): Promise<Paginated<AdminArticleView>> {
    return this.content.listArticlesForAdmin(query);
  }

  @Get(":slug")
  get(@Param("slug") slug: string): Promise<AdminArticleView> {
    return this.content.getArticleForAdmin(slug);
  }

  /** Create or update by slug (idempotent upsert). */
  @Post()
  @Audit(AuditAction.CONTENT_ARTICLE_UPSERT)
  async upsert(@Body() dto: UpsertArticleDto, @Req() req: AuditableRequest): Promise<AdminArticleView> {
    const before = await this.content.getArticleForAdmin(dto.slug).catch(() => null);
    await this.content.upsertArticle(dto);
    const after = await this.content.getArticleForAdmin(dto.slug);
    setAuditContext(req, {
      targetType: AuditTargetType.ARTICLE,
      targetId: dto.slug,
      before: { existed: before !== null, isPublished: before?.isPublished ?? null },
      after: { existed: true, family: after.family, category: after.category, isPublished: after.isPublished },
    });
    return after;
  }

  @Post(":slug/publish")
  @Audit(AuditAction.CONTENT_ARTICLE_PUBLISH)
  async publish(@Param("slug") slug: string, @Req() req: AuditableRequest): Promise<AdminArticleView> {
    await this.content.publishArticle(slug);
    setAuditContext(req, { targetType: AuditTargetType.ARTICLE, targetId: slug });
    return this.content.getArticleForAdmin(slug);
  }

  @Post(":slug/unpublish")
  @Audit(AuditAction.CONTENT_ARTICLE_UNPUBLISH)
  async unpublish(@Param("slug") slug: string, @Req() req: AuditableRequest): Promise<AdminArticleView> {
    await this.content.unpublishArticle(slug);
    setAuditContext(req, { targetType: AuditTargetType.ARTICLE, targetId: slug });
    return this.content.getArticleForAdmin(slug);
  }
}
