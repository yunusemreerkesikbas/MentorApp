import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  type MentionSuggestion,
  type Paginated,
  ZoneMemberStatus,
  type ZoneMemberView,
  ZoneRole,
  type ZoneView,
} from "@mentor/types";
import type { CreateZone, ZoneListQuery } from "@mentor/validation";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { STORAGE_PORT, type StoragePort } from "../../../shared/ports/storage.port";
import {
  canApproveMember,
  canCreateZone,
  canLeaveZone,
  canModerateZone,
  canRemoveMember,
  canSearchMembers,
  isPlatformStaff,
  type ForumActor,
} from "../domain/forum.policy";
import { ForumEventTopic } from "../domain/forum.events";
import {
  ForumZoneRepository,
  type MemberRow,
  type ZoneRow,
} from "../infrastructure/forum-zone.repository";
import { ForumPostRepository } from "../infrastructure/forum-post.repository";

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
    private readonly posts: ForumPostRepository,
    private readonly config: ConfigRegistryService,
    private readonly events: EventEmitter2,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  /** Per-author activity signals for the community effort board's behaviour badges (read-only). */
  getAuthorActivity(
    userId: string,
  ): Promise<{ totalPosts: number; totalThreads: number; nightPosts: number; reactionsReceived: number }> {
    return this.posts.authorActivityStats(userId);
  }

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
      emoji: dto.emoji,
      joinPolicy: dto.joinPolicy,
      createdBy: actorId,
    });
    return this.toView(row, 0, 0, null, actorRoles);
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
      // Resolve slug + recipients in-domain (service context) so notifications stays decoupled and
      // the link never depends on the joiner's zone visibility. Skip if the zone vanished (no link).
      const [slug, moderatorIds] = await Promise.all([
        this.repo.zoneSlug(zoneId),
        this.repo.listOwnerAndMods(zoneId),
      ]);
      if (slug) {
        this.events.emit(ForumEventTopic.MEMBER_REQUESTED, {
          zoneId,
          slug,
          requesterId: userId,
          moderatorIds,
        });
      }
    }
    return { status };
  }

  /** Owner/mod (or platform staff) approves or rejects a pending join request. */
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
    if (approve) {
      await this.repo.setMemberStatus(zoneId, targetUserId, ZoneMemberStatus.ACTIVE);
    } else {
      await this.repo.deleteMember(zoneId, targetUserId);
    }
  }

  /** Owner/mod (or platform staff) removes an active member. OWNER cannot be removed. */
  async removeMember(actor: ForumActor, zoneId: string, targetUserId: string): Promise<void> {
    await this.assertEnabled();
    const membership = await this.repo.findMembershipPrivileged(zoneId, targetUserId);
    if (!membership) throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (!canRemoveMember(actor, membership.role as ZoneRole)) {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    await this.repo.deleteMember(zoneId, targetUserId);
  }

  /**
   * Voluntary self-leave: an ACTIVE member leaves, a PENDING requester withdraws their request
   * (same delete). Idempotent — no membership is a no-op (mirrors `join`). OWNER cannot leave.
   */
  async leave(zoneId: string, userId: string): Promise<void> {
    await this.assertEnabled();
    const membership = await this.repo.findMembership(zoneId, userId);
    if (!membership) return; // already gone — retry-safe
    if (!canLeaveZone(membership.role as ZoneRole)) {
      throw new DomainError(ErrorCode.FORUM_OWNER_CANNOT_LEAVE, HttpStatus.CONFLICT);
    }
    await this.repo.deleteMember(zoneId, userId);
  }

  async listZones(
    viewerId: string,
    actorRoles: string[],
    q: ZoneListQuery,
  ): Promise<Paginated<ZoneView>> {
    await this.assertEnabled();
    const { items, total } = await this.repo.listPublic(viewerId, q);
    const ids = items.map((z) => z.id);
    // Three batched lookups instead of per-zone (no N+1).
    const [counts, threadCounts, memberships] = await Promise.all([
      this.repo.memberCountsByZone(ids),
      this.repo.threadCountsByZone(ids),
      this.repo.findMembershipsByZone(ids, viewerId),
    ]);
    const views = items.map((z) =>
      this.toView(
        z,
        counts.get(z.id) ?? 0,
        threadCounts.get(z.id) ?? 0,
        memberships.get(z.id) ?? null,
        actorRoles,
      ),
    );
    return { items: views, total, page: q.page, pageSize: q.pageSize };
  }

  /** Owner/mod (or staff) member list — typically PENDING, to review join requests. */
  async listMembers(
    actor: ForumActor,
    zoneId: string,
    status?: string,
  ): Promise<ZoneMemberView[]> {
    await this.assertEnabled();
    if (!canModerateZone(actor)) {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    const rows = await this.repo.listMembers(zoneId, status);
    return rows.map((m) => ({
      userId: m.userId,
      role: m.role as ZoneRole,
      status: m.status as ZoneMemberStatus,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  /**
   * @mention autocomplete (APP-021): ACTIVE members of the zone whose username starts with `q`
   * (schema guarantees lowercase handle-charset). Any ACTIVE member may search — the list is
   * scoped to people the caller already shares a zone with, so nothing new is exposed.
   */
  async searchMembers(
    actor: ForumActor,
    memberStatus: string | null,
    zoneId: string,
    q: string,
  ): Promise<MentionSuggestion[]> {
    await this.assertEnabled();
    const zone = await this.repo.findById(zoneId, actor.userId);
    if (!zone) throw new DomainError(ErrorCode.FORUM_ZONE_NOT_FOUND, HttpStatus.NOT_FOUND);
    if (!canSearchMembers(actor, memberStatus)) {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    const rows = await this.repo.searchActiveMembers(zoneId, q);
    return rows.map((r) => ({
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarStorageKey ? this.storage.getPublicUrl(r.avatarStorageKey) : null,
    }));
  }

  async getZone(viewerId: string, actorRoles: string[], slug: string): Promise<ZoneView> {
    await this.assertEnabled();
    const row = await this.repo.findBySlug(slug, viewerId);
    if (!row) throw new DomainError(ErrorCode.FORUM_ZONE_NOT_FOUND, HttpStatus.NOT_FOUND);
    const [m, count, threadCounts] = await Promise.all([
      this.repo.findMembership(row.id, viewerId),
      this.repo.memberCount(row.id),
      this.repo.threadCountsByZone([row.id]),
    ]);
    return this.toView(row, count, threadCounts.get(row.id) ?? 0, m ?? null, actorRoles);
  }

  /** Controller helper: the zone's join policy (for the join call) — no member-count round-trip. */
  async getJoinPolicy(zoneId: string, viewerId: string): Promise<string> {
    await this.assertEnabled();
    const row = await this.repo.findById(zoneId, viewerId);
    if (!row) throw new DomainError(ErrorCode.FORUM_ZONE_NOT_FOUND, HttpStatus.NOT_FOUND);
    return row.joinPolicy;
  }

  /** Controller helper: the actor's own membership (→ their zoneRole for the policy). */
  getActorMembership(zoneId: string, userId: string): Promise<MemberRow | null> {
    return this.repo.findMembership(zoneId, userId);
  }

  private toView(
    z: ZoneRow,
    memberCount: number,
    threadCount: number,
    membership: MemberRow | null,
    actorRoles: string[],
  ): ZoneView {
    const myRole = (membership?.role as ZoneRole | undefined) ?? null;
    const canModerate =
      isPlatformStaff(actorRoles) || myRole === ZoneRole.OWNER || myRole === ZoneRole.MODERATOR;
    return {
      id: z.id,
      type: z.type as ZoneView["type"],
      title: z.title,
      slug: z.slug,
      description: z.description,
      visibility: z.visibility as ZoneView["visibility"],
      joinPolicy: z.joinPolicy as ZoneView["joinPolicy"],
      examType: z.examType,
      emoji: z.emoji,
      isArchived: z.isArchived,
      memberCount,
      threadCount,
      myStatus: (membership?.status as ZoneMemberStatus | undefined) ?? null,
      myRole,
      canModerate,
      createdAt: z.createdAt.toISOString(),
    };
  }
}
