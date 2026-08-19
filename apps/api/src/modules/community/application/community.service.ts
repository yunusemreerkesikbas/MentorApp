import { Inject, Injectable } from "@nestjs/common";
import type {
  AuthUser,
  CommunitySummary,
  LeaderboardEntry,
  LeaderboardView,
  LeaderboardWindow,
  PublicProfile,
} from "@mentor/types";
import { NotFoundError } from "../../../common/errors/domain-error";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { STORAGE_PORT, type StoragePort } from "../../../shared/ports/storage.port";
import { StreakService } from "../../coaching/application/streak.service";
import { EconomyService } from "../../economy/application/economy.service";
import { ForumService } from "../../forum/application/forum.service";
import { UsersService } from "../../identity/application/users.service";
import { FollowService } from "../../identity/application/follow.service";
import { BuddyService } from "../../identity/application/buddy.service";
import { EntitlementService } from "../../payments/application/entitlement.service";
import { deriveBadges } from "../domain/badges";
import { previousWindowStart, resolveMovement, windowStart } from "../domain/leaderboard-window";

const LEADERBOARD_SIZE = 10;

/**
 * Right-column effort board (§3). Pure orchestration — every read comes from the owning module's
 * public service (no cross-module table access): profile ← identity, streak ← coaching, post signals
 * ← forum, XP/leaderboard ← economy. Streak + badges are economy-independent and always returned;
 * XP + level + leaderboard appear only when `economy.enabled`. Effort only — never net/exam results.
 */
@Injectable()
export class CommunityService {
  constructor(
    private readonly users: UsersService,
    private readonly streak: StreakService,
    private readonly forum: ForumService,
    private readonly economy: EconomyService,
    private readonly follow: FollowService,
    private readonly buddy: BuddyService,
    private readonly config: ConfigRegistryService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly entitlement: EntitlementService,
  ) {}

  async getSummary(userId: string): Promise<CommunitySummary> {
    const economyEnabled = await this.config.get("economy.enabled");
    const [me, currentStreak, activity] = await Promise.all([
      this.users.getMe(userId),
      this.streak.getCurrentStreak(userId),
      this.forum.getAuthorActivity(userId),
    ]);

    const badges = deriveBadges({
      currentStreak,
      memberSince: new Date(me.createdAt),
      totalPosts: activity.totalPosts,
      nightPosts: activity.nightPosts,
      reactionsReceived: activity.reactionsReceived,
    });

    if (!economyEnabled) {
      return {
        streak: currentStreak,
        economyEnabled: false,
        badges,
        xp: null,
        level: null,
        leaderboard: null,
      };
    }

    const [balance, leaderboard] = await Promise.all([
      this.economy.getSelfBalance(userId),
      this.buildLeaderboard(userId, me, "weekly"),
    ]);

    return {
      streak: currentStreak,
      economyEnabled: true,
      badges,
      xp: balance.xp,
      level: balance.level,
      leaderboard,
    };
  }

  /**
   * Public profile header (identity + gamification) for another user, resolved by username. Public-safe:
   * NO email/PII; xp/level are already public via the leaderboard. Banned/suspended/unknown → 404.
   */
  async getPublicProfile(username: string, viewerId: string): Promise<PublicProfile> {
    const user = await this.users.findByUsername(username);
    if (!user || !user.username || user.status === "BANNED" || user.status === "SUSPENDED") {
      throw new NotFoundError();
    }
    const [economyEnabled, achievementsEnabled] = await Promise.all([
      this.config.get("economy.enabled"),
      this.config.get("community.achievements.enabled"),
    ]);
    const isSelf = viewerId === user.id;
    const [currentStreak, activity, followerCount, followingCount, isFollowing, buddyStatus, entitlement] =
      await Promise.all([
        this.streak.getCurrentStreak(user.id),
        this.forum.getAuthorActivity(user.id),
        this.follow.countFollowers(user.id),
        this.follow.countFollowing(user.id),
        isSelf ? Promise.resolve(false) : this.follow.isFollowing(viewerId, user.id),
        isSelf
          ? Promise.resolve("none" as const)
          : this.buddy.getStatusBetween(viewerId, user.id),
        this.entitlement.getEntitlement(user.id, user.roles),
      ]);
    const badges = deriveBadges({
      currentStreak,
      memberSince: new Date(user.createdAt),
      totalPosts: activity.totalPosts,
      nightPosts: activity.nightPosts,
      reactionsReceived: activity.reactionsReceived,
    });
    const balance = economyEnabled ? await this.economy.getSelfBalance(user.id) : null;
    return {
      userId: user.id,
      displayName: user.displayName,
      username: user.username,
      achievementsEnabled,
      avatarUrl: user.avatarStorageKey ? this.storage.getPublicUrl(user.avatarStorageKey) : null,
      examType: user.examType,
      createdAt: user.createdAt.toISOString(),
      bio: user.bio ?? null,
      website: user.website ?? null,
      streak: currentStreak,
      badges,
      xp: balance?.xp ?? null,
      level: balance?.level ?? null,
      followerCount,
      followingCount,
      activityCount: activity.totalThreads + activity.totalPosts,
      isPremium: entitlement.isPremium,
      isFollowing,
      buddyStatus,
    };
  }

  /**
   * Effort ranking for a time window (full-page tabs: Bugün/Hafta/Tüm zamanlar). Economy-gated:
   * returns an empty board when the economy is off (the client hides tabs via `economyEnabled`).
   */
  async getLeaderboard(userId: string, window: LeaderboardWindow): Promise<LeaderboardView> {
    const [economyEnabled, me] = await Promise.all([
      this.config.get("economy.enabled"),
      this.users.getMe(userId),
    ]);
    const examType = me.examType ?? null;
    if (!economyEnabled) return { window, examType, items: [], me: null, totalParticipants: 0 };
    return this.buildLeaderboard(userId, me, window);
  }

  /** Shared board builder — XP only (§3). `me` is the resolved viewer profile (avatar + display). */
  private async buildLeaderboard(
    userId: string,
    me: AuthUser,
    window: LeaderboardWindow,
  ): Promise<LeaderboardView> {
    const examType = me.examType ?? null;
    const since = windowStart(window);
    const prevStart = previousWindowStart(window, since);
    const [top, standing, totalParticipants, prevRanks] = await Promise.all([
      this.economy.getXpLeaderboard(examType, since, LEADERBOARD_SIZE),
      this.economy.getXpStanding(userId, examType, since),
      this.economy.getXpParticipantCount(examType, since),
      prevStart ? this.economy.getPreviousRanks(examType, prevStart, since) : Promise.resolve(null),
    ]);

    // Suppresses first-week / all_time "new" spam (see resolveMovement).
    const movementFor = (uid: string, rank: number) => resolveMovement(prevRanks, uid, rank);

    const items: LeaderboardEntry[] = top.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      displayName: r.displayName,
      avatarUrl: r.avatarStorageKey ? this.storage.getPublicUrl(r.avatarStorageKey) : null,
      xp: r.xp,
      isMe: r.userId === userId,
      movement: movementFor(r.userId, i + 1),
    }));

    const inTop = items.find((e) => e.isMe) ?? null;
    const meEntry: LeaderboardEntry | null =
      inTop ??
      (standing.rank === null
        ? null
        : {
            rank: standing.rank,
            userId,
            displayName: me.displayName,
            avatarUrl: me.avatarUrl,
            xp: standing.xp,
            isMe: true,
            movement: movementFor(userId, standing.rank),
          });

    return { window, examType, items, me: meEntry, totalParticipants };
  }
}
