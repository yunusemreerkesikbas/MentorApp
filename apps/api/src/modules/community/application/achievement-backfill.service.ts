import { Injectable, Logger } from "@nestjs/common";
import type { AchievementId } from "@mentor/types";
import { CoachingAchievementEvidenceService } from "../../coaching/application/coaching-achievement-evidence.service";
import { ForumAchievementEvidenceService } from "../../forum/application/forum-achievement-evidence.service";
import { UsersService } from "../../identity/application/users.service";
import { ACHIEVEMENT_DEFINITION_BY_ID } from "../domain/achievement-definitions";
import { AchievementRepository } from "../infrastructure/achievement.repository";

const DEFAULT_BATCH_SIZE = 100;

@Injectable()
export class AchievementBackfillService {
  private readonly logger = new Logger(AchievementBackfillService.name);

  constructor(
    private readonly users: UsersService,
    private readonly coaching: CoachingAchievementEvidenceService,
    private readonly forum: ForumAchievementEvidenceService,
    private readonly repository: AchievementRepository,
  ) {}

  async run(batchSize = DEFAULT_BATCH_SIZE): Promise<{ users: number; inserted: number }> {
    let afterId: string | null = null;
    let processedUsers = 0;
    let inserted = 0;
    do {
      const candidates = await this.users.listAchievementCandidates(afterId, batchSize);
      if (candidates.length === 0) break;
      const userIds = candidates.map((candidate) => candidate.id);
      const [coachingEvidence, forumEvidence] = await Promise.all([
        this.coaching.collect(userIds),
        this.forum.collect(userIds),
      ]);
      const owners = new Map(candidates.map((candidate) => [candidate.id, candidate]));
      const deduped = new Map<string, { userId: string; achievementId: AchievementId; earnedAt: Date }>();
      for (const evidence of [...coachingEvidence, ...forumEvidence]) {
        const key = `${evidence.userId}:${evidence.achievementId}`;
        const existing = deduped.get(key);
        if (!existing || evidence.earnedAt < existing.earnedAt) deduped.set(key, evidence);
      }
      const rows = [...deduped.values()].flatMap((evidence) => {
        const owner = owners.get(evidence.userId);
        const definition = ACHIEVEMENT_DEFINITION_BY_ID.get(evidence.achievementId);
        if (!owner || !definition) return [];
        return [{
          userId: evidence.userId,
          orgId: owner.orgId,
          achievementId: evidence.achievementId,
          ruleVersion: definition.ruleVersion,
          source: "BACKFILL" as const,
          earnedAt: evidence.earnedAt,
        }];
      });
      inserted += (await this.repository.awardMany(rows)).length;
      processedUsers += candidates.length;
      afterId = candidates.at(-1)!.id;
      this.logger.log(`achievement backfill processed=${processedUsers} inserted=${inserted}`);
      if (candidates.length < batchSize) break;
    } while (afterId);
    return { users: processedUsers, inserted };
  }
}
