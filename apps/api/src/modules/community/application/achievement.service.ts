import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { I18nService } from "nestjs-i18n";
import type {
  AchievementCelebrationsDto,
  AchievementCollectionDto,
  AchievementId,
  AchievementSource,
} from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { NotFoundError } from "../../../common/errors/domain-error";
import { StreakService } from "../../coaching/application/streak.service";
import { UsersService } from "../../identity/application/users.service";
import {
  buildAchievementCollection,
  groupAchievementCelebrations,
  type EarnedAchievement,
} from "../domain/achievement-collection";
import { ACHIEVEMENT_DEFINITION_BY_ID } from "../domain/achievement-definitions";
import { CommunityEventTopic, type AchievementAwarded } from "../domain/community.events";
import { AchievementRepository } from "../infrastructure/achievement.repository";

@Injectable()
export class AchievementService {
  constructor(
    private readonly repository: AchievementRepository,
    private readonly users: UsersService,
    private readonly streak: StreakService,
    private readonly config: ConfigRegistryService,
    private readonly i18n: I18nService,
    private readonly events: EventEmitter2,
  ) {}

  async getCollection(
    username: string,
    viewerId: string,
    locale: string,
  ): Promise<AchievementCollectionDto> {
    await this.assertExposed();
    const owner = await this.users.findByUsername(username);
    if (!owner || !owner.username || owner.status !== "ACTIVE") throw new NotFoundError();
    const ownerView = owner.id === viewerId;
    const [rows, longestStreak] = await Promise.all([
      this.repository.listByUser(viewerId, owner.id),
      ownerView ? this.streak.getLongestStreak(owner.id) : Promise.resolve(0),
    ]);
    return buildAchievementCollection({
      ownerView,
      earned: rows.map(toEarned),
      longestStreak,
      translate: (key) => this.translate(key, locale),
    });
  }

  async getUnseen(
    userId: string,
    locale: string,
  ): Promise<AchievementCelebrationsDto> {
    await this.assertExposed();
    const [rows, longestStreak] = await Promise.all([
      this.repository.listUnseen(userId),
      this.streak.getLongestStreak(userId),
    ]);
    const collection = buildAchievementCollection({
      ownerView: true,
      earned: rows.map(toEarned),
      longestStreak,
      translate: (key) => this.translate(key, locale),
    });
    const views = new Map(collection.items.map((item) => [item.id, item]));
    return { celebrations: groupAchievementCelebrations(rows.map(toEarned), views) };
  }

  async celebrate(userId: string, achievementIds: AchievementId[]): Promise<void> {
    await this.assertExposed();
    await this.repository.markCelebrated(userId, achievementIds);
  }

  async award(
    userId: string,
    achievementId: AchievementId,
    earnedAt = new Date(),
    requestedSource: AchievementSource = "LIVE",
  ): Promise<boolean> {
    const [owner, exposed] = await Promise.all([
      this.users.getAchievementOwner(userId),
      this.config.get("community.achievements.enabled"),
    ]);
    if (!owner) return false;
    const definition = ACHIEVEMENT_DEFINITION_BY_ID.get(achievementId);
    if (!definition) return false;
    const source: AchievementSource = exposed ? requestedSource : "BACKFILL";
    const inserted = await this.repository.award({
      userId,
      orgId: owner.orgId,
      achievementId,
      ruleVersion: definition.ruleVersion,
      source,
      earnedAt,
    });
    if (!inserted || !exposed) return inserted !== null;
    const event: AchievementAwarded = {
      userId,
      username: owner.username,
      achievementId,
      source,
    };
    this.events.emit(CommunityEventTopic.ACHIEVEMENT_AWARDED, event);
    return true;
  }

  private async assertExposed(): Promise<void> {
    if (!(await this.config.get("community.achievements.enabled"))) throw new NotFoundError();
  }

  private translate(key: string, locale: string): string {
    return String(this.i18n.translate(key, { lang: locale }));
  }
}

function toEarned(row: {
  achievementId: string;
  source: string;
  earnedAt: Date;
}): EarnedAchievement {
  return {
    id: row.achievementId as AchievementId,
    source: row.source as AchievementSource,
    earnedAt: row.earnedAt,
  };
}
