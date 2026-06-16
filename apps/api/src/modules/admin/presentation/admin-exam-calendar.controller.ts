import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Paginated } from "@mentor/types";
import { UserRole } from "@mentor/types";
import { Roles } from "../../../common/auth/roles.decorator";
import {
  ContentService,
  type AdminExamDetailView,
  type AdminExamView,
} from "../../content/application/content.service";
import { AuditAction, AuditTargetType } from "../domain/admin.constants";
import { AdminAuditInterceptor } from "./admin-audit.interceptor";
import { Audit } from "./audit.decorator";
import { setAuditContext, type AuditableRequest } from "./audit-context";
import { AdminListExamsQueryDto, UpsertExamDto, UpsertExamEventDto } from "./admin.dto";

/**
 * Admin exam-calendar editor (W6) — editorial `exams` + `exam_events`. Official dates: trust
 * metadata is required on events (§4 #1, enforced by the Zod schema); the LLM never generates
 * them. ADMIN or EDITOR; every write audited. Consumes the W1 `ContentService` (writes run in
 * SERVICE context inside it).
 */
@ApiTags("admin")
@ApiBearerAuth()
@Roles(UserRole.EDITOR)
@UseInterceptors(AdminAuditInterceptor)
@Controller("admin/content/exams")
export class AdminExamCalendarController {
  constructor(private readonly content: ContentService) {}

  @Get()
  list(@Query() query: AdminListExamsQueryDto): Promise<Paginated<AdminExamView>> {
    return this.content.listExamsForAdmin(query);
  }

  @Get(":slug")
  get(@Param("slug") slug: string): Promise<AdminExamDetailView> {
    return this.content.getExamForAdminWithEvents(slug);
  }

  /** Create or update an exam by slug (idempotent upsert). */
  @Post()
  @Audit(AuditAction.CONTENT_EXAM_UPSERT)
  async upsert(@Body() dto: UpsertExamDto, @Req() req: AuditableRequest): Promise<AdminExamDetailView> {
    const before = await this.content.getExamForAdminWithEvents(dto.slug).catch(() => null);
    await this.content.upsertExam(dto);
    const after = await this.content.getExamForAdminWithEvents(dto.slug);
    setAuditContext(req, {
      targetType: AuditTargetType.EXAM,
      targetId: dto.slug,
      before: {
        existed: before !== null,
        family: before?.exam.family ?? null,
        isCurrent: before?.exam.isCurrent ?? null,
      },
      after: { existed: true, family: after.exam.family, name: after.exam.name, isCurrent: after.exam.isCurrent },
    });
    return after;
  }

  /** Create or update one calendar event (by type) for an exam. */
  @Post(":slug/events")
  @Audit(AuditAction.CONTENT_EXAM_EVENT_UPSERT)
  async upsertEvent(
    @Param("slug") slug: string,
    @Body() dto: UpsertExamEventDto,
    @Req() req: AuditableRequest,
  ): Promise<AdminExamDetailView> {
    const before = await this.content
      .getExamForAdminWithEvents(slug)
      .then((d) => d.events.find((e) => e.type === dto.type) ?? null)
      .catch(() => null);
    await this.content.upsertEvent(slug, dto);
    setAuditContext(req, {
      targetType: AuditTargetType.EXAM_EVENT,
      targetId: `${slug}:${dto.type}`,
      before: { existed: before !== null, eventAt: before?.eventAt ?? null },
      after: { existed: true, eventAt: dto.eventAt, verifiedBy: dto.verifiedBy },
    });
    return this.content.getExamForAdminWithEvents(slug);
  }

  /** Delete one calendar event. 204 No Content (api.md §3); the UI refetches the exam detail. */
  @Delete(":slug/events/:type")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(AuditAction.CONTENT_EXAM_EVENT_DELETE)
  async deleteEvent(
    @Param("slug") slug: string,
    @Param("type") type: string,
    @Req() req: AuditableRequest,
  ): Promise<void> {
    await this.content.deleteExamEvent(slug, type);
    setAuditContext(req, { targetType: AuditTargetType.EXAM_EVENT, targetId: `${slug}:${type}` });
  }
}
