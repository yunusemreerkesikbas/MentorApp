import { HttpStatus, Injectable } from "@nestjs/common";
import {
  ModerationTargetType,
  type Paginated,
  ReportStatus,
  type ReportView,
  ZoneRole,
} from "@mentor/types";
import type { CreateReport, ReportsQuery, ResolveReport } from "@mentor/validation";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { canModerateZone, isPlatformStaff, type ForumActor } from "../domain/forum.policy";
import { ForumZoneRepository } from "../infrastructure/forum-zone.repository";
import { ForumThreadRepository } from "../infrastructure/forum-thread.repository";
import { ForumPostRepository } from "../infrastructure/forum-post.repository";
import { ForumReportRepository, type ReportRow } from "../infrastructure/forum-report.repository";
import type { ThreadActor } from "./forum-thread.service";

/**
 * Moderation (slice 5): report → queue → hide/restore/dismiss, with an append-only audit. "Hide"
 * reuses soft-delete (a hidden item drops out of every feed/detail/search read). Authz = the
 * existing two-plane `canModerateZone` (zone owner/mod OR platform staff). Flag-gated. No coin.
 */
@Injectable()
export class ForumModerationService {
  constructor(
    private readonly reports: ForumReportRepository,
    private readonly threads: ForumThreadRepository,
    private readonly posts: ForumPostRepository,
    private readonly zones: ForumZoneRepository,
    private readonly config: ConfigRegistryService,
  ) {}

  private async assertEnabled(): Promise<void> {
    if (!(await this.config.get("forum.enabled"))) {
      throw new DomainError(ErrorCode.FORUM_DISABLED, HttpStatus.NOT_FOUND);
    }
  }

  private async actorIn(zoneId: string, actor: ThreadActor): Promise<ForumActor> {
    const membership = await this.zones.findMembership(zoneId, actor.id);
    return {
      userId: actor.id,
      platformRoles: actor.roles,
      zoneRole: (membership?.role as ZoneRole | undefined) ?? null,
    };
  }

  /** Resolve a reportable target's zone, requiring it to be visible to the reporter. */
  private async targetZoneVisible(
    targetType: string,
    targetId: string,
    viewerId: string,
  ): Promise<string> {
    if (targetType === ModerationTargetType.THREAD) {
      const thread = await this.threads.findById(targetId, viewerId);
      if (!thread) throw new DomainError(ErrorCode.FORUM_THREAD_NOT_FOUND, HttpStatus.NOT_FOUND);
      return thread.zoneId;
    }
    const post = await this.posts.findById(targetId, viewerId);
    if (!post) throw new DomainError(ErrorCode.FORUM_POST_NOT_FOUND, HttpStatus.NOT_FOUND);
    const thread = await this.threads.findById(post.threadId, viewerId);
    if (!thread) throw new DomainError(ErrorCode.FORUM_THREAD_NOT_FOUND, HttpStatus.NOT_FOUND);
    return thread.zoneId;
  }

  async report(actor: ThreadActor, dto: CreateReport): Promise<void> {
    await this.assertEnabled();
    const zoneId = await this.targetZoneVisible(dto.targetType, dto.targetId, actor.id);
    await this.reports.create({
      targetType: dto.targetType,
      targetId: dto.targetId,
      zoneId,
      reporterId: actor.id,
      reason: dto.reason,
      note: dto.note,
    });
  }

  async listZoneReports(
    actor: ThreadActor,
    zoneId: string,
    q: ReportsQuery,
  ): Promise<Paginated<ReportView>> {
    await this.assertEnabled();
    const forumActor = await this.actorIn(zoneId, actor);
    if (!canModerateZone(forumActor)) {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    const rows = await this.reports.listByZone(zoneId, {
      status: q.status,
      page: q.page,
      pageSize: q.pageSize,
    });
    return { items: rows.map((r) => this.toView(r)), total: rows.length, page: q.page, pageSize: q.pageSize };
  }

  async listAllReports(actor: ThreadActor, q: ReportsQuery): Promise<Paginated<ReportView>> {
    await this.assertEnabled();
    if (!isPlatformStaff(actor.roles)) {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    const rows = await this.reports.listAll({ status: q.status, page: q.page, pageSize: q.pageSize });
    return { items: rows.map((r) => this.toView(r)), total: rows.length, page: q.page, pageSize: q.pageSize };
  }

  async resolve(actor: ThreadActor, reportId: string, dto: ResolveReport): Promise<void> {
    await this.assertEnabled();
    const report = await this.reports.findById(reportId);
    if (!report) throw new DomainError(ErrorCode.FORUM_REPORT_NOT_FOUND, HttpStatus.NOT_FOUND);
    const forumActor = await this.actorIn(report.zoneId, actor);
    if (!canModerateZone(forumActor)) {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    const scope = isPlatformStaff(actor.roles) ? "PLATFORM" : "ROOM";
    if (dto.action === "HIDE") {
      await this.hideTarget(report.targetType, report.targetId, actor.id);
      await this.reports.appendAction({
        actorId: actor.id,
        actorScope: scope,
        action: "HIDE",
        targetType: report.targetType,
        targetId: report.targetId,
        zoneId: report.zoneId,
        reason: report.reason,
      });
      await this.reports.setResolved(reportId, ReportStatus.RESOLVED, actor.id);
    } else {
      await this.reports.appendAction({
        actorId: actor.id,
        actorScope: scope,
        action: "DISMISS",
        targetType: report.targetType,
        targetId: report.targetId,
        zoneId: report.zoneId,
        reason: report.reason,
      });
      await this.reports.setResolved(reportId, ReportStatus.DISMISSED, actor.id);
    }
  }

  async restore(actor: ThreadActor, targetType: string, targetId: string): Promise<void> {
    await this.assertEnabled();
    const zoneId = await this.hiddenTargetZone(targetType, targetId);
    const forumActor = await this.actorIn(zoneId, actor);
    if (!canModerateZone(forumActor)) {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    if (targetType === ModerationTargetType.THREAD) {
      await this.threads.restore(targetId);
    } else {
      await this.posts.restore(targetId);
    }
    const scope = isPlatformStaff(actor.roles) ? "PLATFORM" : "ROOM";
    await this.reports.appendAction({
      actorId: actor.id,
      actorScope: scope,
      action: "RESTORE",
      targetType,
      targetId,
      zoneId,
      reason: null,
    });
  }

  private async hideTarget(targetType: string, targetId: string, byUserId: string): Promise<void> {
    if (targetType === ModerationTargetType.THREAD) {
      await this.threads.softDelete(targetId, byUserId);
    } else {
      await this.posts.softDelete(targetId, byUserId);
    }
  }

  /** Zone of a (possibly hidden) target, for restore — uses service-context reads. */
  private async hiddenTargetZone(targetType: string, targetId: string): Promise<string> {
    if (targetType === ModerationTargetType.THREAD) {
      const thread = await this.threads.findByIdIncludingDeleted(targetId);
      if (!thread) throw new DomainError(ErrorCode.FORUM_THREAD_NOT_FOUND, HttpStatus.NOT_FOUND);
      return thread.zoneId;
    }
    const post = await this.posts.findByIdIncludingDeleted(targetId);
    if (!post) throw new DomainError(ErrorCode.FORUM_POST_NOT_FOUND, HttpStatus.NOT_FOUND);
    const thread = await this.threads.findByIdIncludingDeleted(post.threadId);
    if (!thread) throw new DomainError(ErrorCode.FORUM_THREAD_NOT_FOUND, HttpStatus.NOT_FOUND);
    return thread.zoneId;
  }

  private toView(r: ReportRow): ReportView {
    return {
      id: r.id,
      targetType: r.targetType as ReportView["targetType"],
      targetId: r.targetId,
      zoneId: r.zoneId,
      reporterId: r.reporterId,
      reason: r.reason as ReportView["reason"],
      note: r.note,
      status: r.status as ReportView["status"],
      createdAt: r.createdAt.toISOString(),
    };
  }
}
