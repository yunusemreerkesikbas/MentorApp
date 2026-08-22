import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import type {
  CommunityLevelView,
  JourneyLevelCelebrationsDto,
  JourneyLevelCelebrationView,
} from "@mentor/types";
import { getJourneyLevelByTier } from "@mentor/core";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { EconomyService } from "../../economy/application/economy.service";
import { UsersService } from "../../identity/application/users.service";
import {
  CommunityEventTopic,
  type JourneyLevelUnlocked,
} from "../domain/community.events";
import {
  JourneyLevelCelebrationRepository,
  type JourneyLevelCelebrationRow,
} from "../infrastructure/journey-level-celebration.repository";

@Injectable()
export class JourneyLevelCelebrationService {
  constructor(
    private readonly repository: JourneyLevelCelebrationRepository,
    private readonly economy: EconomyService,
    private readonly users: UsersService,
    private readonly config: ConfigRegistryService,
    private readonly events: EventEmitter2,
  ) {}

  async getUnseen(userId: string): Promise<JourneyLevelCelebrationsDto> {
    if (!(await this.config.get("economy.enabled"))) return { celebrations: [] };
    const balance = await this.economy.getSelfBalance(userId);
    await this.synchronize(userId, balance.level, new Date(), false);
    const rows = await this.repository.listUnresolved(userId);
    return { celebrations: rows.map(toView) };
  }

  async synchronizeLive(
    userId: string,
    level: CommunityLevelView,
    observedAt: Date,
  ): Promise<void> {
    await this.synchronize(userId, level, observedAt, true);
  }

  markCelebrated(userId: string, celebrationId: string): Promise<void> {
    return this.repository.markShown(userId, celebrationId);
  }

  private async synchronize(
    userId: string,
    level: CommunityLevelView,
    observedAt: Date,
    notifyLive: boolean,
  ): Promise<void> {
    const owner = await this.users.getAchievementOwner(userId);
    if (!owner) return;
    const inserted = await this.repository.synchronize({
      userId,
      orgId: owner.orgId,
      tier: level.tier,
      observedAt,
    });
    if (!notifyLive || inserted?.kind !== "LEVEL_UP") return;
    const event: JourneyLevelUnlocked = {
      celebrationId: inserted.id,
      userId,
      tier: inserted.tier,
      unlockedAt: inserted.unlockedAt,
    };
    this.events.emit(CommunityEventTopic.JOURNEY_LEVEL_UNLOCKED, event);
  }
}

function toView(row: JourneyLevelCelebrationRow): JourneyLevelCelebrationView {
  return {
    id: row.id,
    kind: row.kind,
    ...getJourneyLevelByTier(row.tier),
    unlockedAt: row.unlockedAt.toISOString(),
  };
}
