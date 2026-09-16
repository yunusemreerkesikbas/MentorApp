import { Injectable } from "@nestjs/common";
import { RewardReceiptRepository } from "../infrastructure/reward-receipt.repository";

@Injectable()
export class RewardReceiptService {
  constructor(private readonly repository: RewardReceiptRepository) {}
  listUnseen(userId: string, page: number, pageSize: number) {
    return this.repository.listUnseen(userId, page, pageSize);
  }
  markSeen(userId: string, ledgerIds: string[]): Promise<void> {
    return this.repository.markSeen(userId, ledgerIds);
  }
}
