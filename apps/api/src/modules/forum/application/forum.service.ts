import { HttpStatus, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  type Paginated,
  ZoneMemberStatus,
  ZoneRole,
  type ZoneView,
} from "@mentor/types";
import type { CreateZone, ZoneListQuery } from "@mentor/validation";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { canApproveMember, canCreateZone, type ForumActor } from "../domain/forum.policy";
import { ForumEventTopic } from "../domain/forum.events";
import {
  ForumZoneRepository,
  type MemberRow,
  type ZoneRow,
} from "../infrastructure/forum-zone.repository";

const TR_MAP: Record<string, string> = {
  ç: "c", ğ: "g", ı: "i", İ: "i", ö: "o", ş: "s", ü: "u",
};

/**
 * Forum orchestration (design 2026-06-22, §3/§5). Gated by `forum.enabled`. Authz via forum.policy
 * (curated zone creation; owner/mod or platform-staff for member approval). No coin (§4 #3).
 */
@Injectable()
export class ForumService {
  constructor(
    private readonly repo: ForumZoneRepository,
    private readonly config: ConfigRegistryService,
    private readonly events: EventEmitter2,
  ) {}

  async assertEnabled(): Promise<void> {
    if (!(await this.config.get("forum.enabled"))) {
      throw new DomainError(ErrorCode.FORUM_DISABLED, HttpStatus.NOT_FOUND);
    }
  }

  private slugify(title: string): string {
    const base = title
      .toLowerCase()
      .replace(/[çğıİöşü]/g, (c) => TR_MAP[c] ?? c)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    // Suffix keeps the unique-slug constraint safe without a retry loop (curated, low volume).
    return `${base || "zone"}-${Date.now().toString(36)}`;
  }

  async createZone(actorRoles: string[], actorId: string, dto: CreateZone): Promise<ZoneView> {
    await this.assertEnabled();
    if (!canCreateZone(actorRoles)) {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    const row = await this.repo.createZone({
      type: dto.type,
      title: dto.title,
      slug: this.slugify(dto.title),
      description: dto.description,
      examType: dto.examType,
      joinPolicy: dto.joinPolicy,
      createdBy: actorId,
    });
    return this.toView(row, 0, null);
  }

  async assignOwner(actorRoles: string[], zoneId: string, targetUserId: string): Promise<void> {
    await this.assertEnabled();
    if (!canCreateZone(actorRoles)) {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    await this.repo.upsertMember(zoneId, targetUserId, ZoneRole.OWNER, ZoneMemberStatus.ACTIVE);
  }

  /**
   * Join a zone. OPEN → ACTIVE immediately; REQUEST → PENDING + emit so the owner is notified.
   * Idempotent: an already-ACTIVE member is a no-op.
   */
  async join(
    zoneId: string,
    userId: string,
    joinPolicy: string,
  ): Promise<{ status: ZoneMemberStatus }> {
    await this.assertEnabled();
    const existing = await this.repo.findMembership(zoneId, userId);
    if (existing && existing.status === ZoneMemberStatus.ACTIVE) {
      return { status: ZoneMemberStatus.ACTIVE };
    }
    const status =
      joinPolicy === "REQUEST" ? ZoneMemberStatus.PENDING : ZoneMemberStatus.ACTIVE;
    await this.repo.upsertMember(zoneId, userId, ZoneRole.MEMBER, status);
    if (status === ZoneMemberStatus.PENDING) {
      this.events.emit(ForumEventTopic.MEMBER_REQUESTED, { zoneId, userId });
    }
    return { status };
  }

  /** Owner/mod (or platform staff) approves/rejects a pending join. Reject leaves it PENDING. */
  async approveMember(
    actor: ForumActor,
    zoneId: string,
    targetUserId: string,
    approve: boolean,
  ): Promise<void> {
    await this.assertEnabled();
    if (!canApproveMember(actor)) {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    await this.repo.setMemberStatus(
      zoneId,
      targetUserId,
      approve ? ZoneMemberStatus.ACTIVE : ZoneMemberStatus.PENDING,
    );
  }

  async listZones(viewerId: string, q: ZoneListQuery): Promise<Paginated<ZoneView>> {
    await this.assertEnabled();
    const { items, total } = await this.repo.listPublic(viewerId, q);
    const views = await Promise.all(
      items.map(async (z) => {
        const [m, count] = await Promise.all([
          this.repo.findMembership(z.id, viewerId),
          this.repo.memberCount(z.id),
        ]);
        return this.toView(z, count, m?.status ?? null);
      }),
    );
    return { items: views, total, page: q.page, pageSize: q.pageSize };
  }

  async getZone(viewerId: string, slug: string): Promise<ZoneView> {
    await this.assertEnabled();
    const row = await this.repo.findBySlug(slug, viewerId);
    if (!row) throw new DomainError(ErrorCode.FORUM_ZONE_NOT_FOUND, HttpStatus.NOT_FOUND);
    const [m, count] = await Promise.all([
      this.repo.findMembership(row.id, viewerId),
      this.repo.memberCount(row.id),
    ]);
    return this.toView(row, count, m?.status ?? null);
  }

  /** Controller helper: resolve a zone by id (for the join policy) — keeps the controller logic-free. */
  async getZoneById(zoneId: string, viewerId: string): Promise<ZoneView> {
    await this.assertEnabled();
    const row = await this.repo.findById(zoneId, viewerId);
    if (!row) throw new DomainError(ErrorCode.FORUM_ZONE_NOT_FOUND, HttpStatus.NOT_FOUND);
    return this.toView(row, await this.repo.memberCount(row.id), null);
  }

  /** Controller helper: the actor's own membership (→ their zoneRole for the policy). */
  getActorMembership(zoneId: string, userId: string): Promise<MemberRow | null> {
    return this.repo.findMembership(zoneId, userId);
  }

  private toView(z: ZoneRow, memberCount: number, myStatus: string | null): ZoneView {
    return {
      id: z.id,
      type: z.type as ZoneView["type"],
      title: z.title,
      slug: z.slug,
      description: z.description,
      visibility: z.visibility as ZoneView["visibility"],
      joinPolicy: z.joinPolicy as ZoneView["joinPolicy"],
      examType: z.examType,
      isArchived: z.isArchived,
      memberCount,
      myStatus: myStatus as ZoneView["myStatus"],
      createdAt: z.createdAt.toISOString(),
    };
  }
}
