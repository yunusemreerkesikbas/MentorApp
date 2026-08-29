import { Injectable } from "@nestjs/common";
import { AdRewardSessionRepository } from "../infrastructure/ad-reward-session.repository";
import { EconomyService } from "../../economy/application/economy.service";

@Injectable()
export class AdsErasureService {
  constructor(private readonly repo: AdRewardSessionRepository, private readonly economy: EconomyService) {}
  async eraseUserData(userId: string): Promise<void> {
    await this.repo.withServiceTx((tx) => this.repo.eraseForUser(userId, tx));
    await this.economy.eraseCoinGrantReservations(userId);
  }
}
