import { Injectable } from "@nestjs/common";
import { AdRewardSessionRepository } from "../infrastructure/ad-reward-session.repository";

@Injectable()
export class AdsStatsService {
  constructor(private readonly repo: AdRewardSessionRepository) {}

  async getStats() {
    const result = await this.repo.stats();
    const rows = result.rows;
    const value = (status: string) => rows.find((row) => row.status === status)?.sessions ?? 0;
    return {
      created: result.sessions,
      rewarded: value("REWARDED"),
      closed: value("CLOSED"),
      expired: value("EXPIRED"),
      rejected: value("REJECTED"),
      uniqueUsers: result.uniqueUsers,
      coinGranted: rows.reduce((sum, row) => sum + row.coin, 0),
    };
  }
}
