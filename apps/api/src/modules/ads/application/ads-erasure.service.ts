import { Injectable } from "@nestjs/common";
import { AdRewardSessionRepository } from "../infrastructure/ad-reward-session.repository";
import { EconomyService } from "../../economy/application/economy.service";
import { AdQuestionReviewRepository } from "../infrastructure/ad-question-review.repository";

@Injectable()
export class AdsErasureService {
  constructor(private readonly repo: AdRewardSessionRepository, private readonly economy: EconomyService,
    private readonly questionReviews: AdQuestionReviewRepository) {}
  async eraseUserData(userId: string): Promise<void> {
    await this.repo.withServiceTx((tx) => this.repo.eraseForUser(userId, tx));
    await this.economy.eraseCoinGrantReservations(userId);
    // Account erasure anonymizes users rather than deleting them, so FK SET NULL is not enough.
    await this.questionReviews.anonymizeReviewer(userId);
  }
}
