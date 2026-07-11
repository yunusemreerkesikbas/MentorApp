import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { FollowList, FollowUserRef } from "@mentor/types";
import { DomainError, NotFoundError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { STORAGE_PORT, type StoragePort } from "../../../shared/ports/storage.port";
import { IdentityEventTopic, type UserFollowed } from "../domain/identity.events";
import { FollowRepository, type FollowRow } from "../infrastructure/follow.repository";
import { UsersRepository, type UserRow } from "../infrastructure/users.repository";

const FOLLOW_LIST_PAGE = 20;

/**
 * Social follow graph (identity owns it — a user↔user relation; forum/community are consumers, cycle-free).
 * One-way, public, instant follow. Follow emits an in-app notification event; unfollow is silent.
 */
@Injectable()
export class FollowService {
  constructor(
    private readonly follows: FollowRepository,
    private readonly usersRepo: UsersRepository,
    private readonly events: EventEmitter2,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  /** Follow a user by username. Self-follow → 400; unknown/banned target → 404. Idempotent. */
  async follow(followerId: string, username: string): Promise<void> {
    const target = await this.requireVisibleUser(username);
    if (target.id === followerId) {
      throw new DomainError(ErrorCode.SOCIAL_CANNOT_FOLLOW_SELF, HttpStatus.BAD_REQUEST);
    }
    await this.follows.follow(followerId, target.id);
    // Name the actor without a listener-side lookup (best-effort — a missing actor just skips the event).
    const actor = await this.usersRepo.findByIdService(followerId);
    if (actor) {
      const payload: UserFollowed = {
        recipientId: target.id,
        actorId: followerId,
        actorDisplayName: actor.displayName,
        actorUsername: actor.username,
      };
      this.events.emit(IdentityEventTopic.USER_FOLLOWED, payload);
    }
  }

  /** Unfollow a user by username. No-op if the target is gone or wasn't followed. */
  async unfollow(followerId: string, username: string): Promise<void> {
    const target = await this.usersRepo.findByUsernameService(username);
    if (!target) return;
    await this.follows.unfollow(followerId, target.id);
  }

  // --- reads consumed by other modules (community profile header, forum feed) ---

  isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    return this.follows.isFollowing(followerId, followeeId);
  }

  countFollowers(userId: string): Promise<number> {
    return this.follows.countFollowers(userId);
  }

  countFollowing(userId: string): Promise<number> {
    return this.follows.countFollowing(userId);
  }

  getFolloweeIds(followerId: string): Promise<string[]> {
    return this.follows.getFolloweeIds(followerId);
  }

  // --- follower / following lists (profile) ---

  async getFollowers(username: string, viewerId: string, before?: string): Promise<FollowList> {
    const owner = await this.requireVisibleUser(username);
    const rows = await this.follows.listFollowers(owner.id, viewerId, {
      limit: FOLLOW_LIST_PAGE,
      before: before ? new Date(before) : undefined,
    });
    return this.toList(rows);
  }

  async getFollowing(username: string, viewerId: string, before?: string): Promise<FollowList> {
    const owner = await this.requireVisibleUser(username);
    const rows = await this.follows.listFollowing(owner.id, viewerId, {
      limit: FOLLOW_LIST_PAGE,
      before: before ? new Date(before) : undefined,
    });
    return this.toList(rows);
  }

  private toList(rows: FollowRow[]): FollowList {
    const items: FollowUserRef[] = rows
      // A user without a username has no public profile page — drop them from the social list.
      .filter((r): r is FollowRow & { username: string } => r.username !== null)
      .map((r) => ({
        userId: r.userId,
        displayName: r.displayName,
        username: r.username,
        avatarUrl: r.avatarStorageKey ? this.storage.getPublicUrl(r.avatarStorageKey) : null,
        isFollowing: r.viewerFollows,
      }));
    const nextCursor = rows.length === FOLLOW_LIST_PAGE ? rows.at(-1)!.createdAt.toISOString() : null;
    return { items, nextCursor };
  }

  /** Resolve a username → a followable/visible user, or 404 (mirrors CommunityService.getPublicProfile). */
  private async requireVisibleUser(username: string): Promise<UserRow> {
    const user = await this.usersRepo.findByUsernameService(username);
    if (!user || !user.username || user.status === "BANNED" || user.status === "SUSPENDED") {
      throw new NotFoundError();
    }
    return user;
  }
}
