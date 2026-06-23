import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ModerationTargetType, type Paginated, type ReportView } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { ForumModerationService } from "../application/forum-moderation.service";
import { CreateReportDto, ReportsQueryDto, ResolveReportDto } from "./forum.dto";

/**
 * Forum moderation (slice 5): report → queue (room owner/mod + platform staff) → hide/restore/dismiss.
 * Authz decided in the service (forum.policy.canModerateZone / isPlatformStaff). Flag-gated.
 */
@ApiTags("forum")
@ApiBearerAuth()
@Controller("forum")
export class ForumModerationController {
  constructor(private readonly moderation: ForumModerationService) {}

  private actor(user: RequestUser) {
    return { id: user.id, roles: user.roles };
  }

  // ponytail: static rate-limit; config-driven once abuse data warrants (shared note with post/answer).
  @Post("reports")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async report(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateReportDto,
  ): Promise<{ status: string }> {
    await this.moderation.report(this.actor(user), dto);
    return { status: "ok" };
  }

  @Get("zones/:id/reports")
  zoneReports(
    @CurrentUser() user: RequestUser,
    @Param("id") zoneId: string,
    @Query() q: ReportsQueryDto,
  ): Promise<Paginated<ReportView>> {
    return this.moderation.listZoneReports(this.actor(user), zoneId, q);
  }

  @Get("reports")
  allReports(
    @CurrentUser() user: RequestUser,
    @Query() q: ReportsQueryDto,
  ): Promise<Paginated<ReportView>> {
    return this.moderation.listAllReports(this.actor(user), q);
  }

  @Post("reports/:id/resolve")
  async resolve(
    @CurrentUser() user: RequestUser,
    @Param("id") reportId: string,
    @Body() dto: ResolveReportDto,
  ): Promise<{ status: string }> {
    await this.moderation.resolve(this.actor(user), reportId, dto);
    return { status: "ok" };
  }

  @Post("threads/:threadId/restore")
  async restoreThread(
    @CurrentUser() user: RequestUser,
    @Param("threadId") threadId: string,
  ): Promise<{ status: string }> {
    await this.moderation.restore(this.actor(user), ModerationTargetType.THREAD, threadId);
    return { status: "ok" };
  }

  @Post("answers/:postId/restore")
  async restoreAnswer(
    @CurrentUser() user: RequestUser,
    @Param("postId") postId: string,
  ): Promise<{ status: string }> {
    await this.moderation.restore(this.actor(user), ModerationTargetType.POST, postId);
    return { status: "ok" };
  }
}
