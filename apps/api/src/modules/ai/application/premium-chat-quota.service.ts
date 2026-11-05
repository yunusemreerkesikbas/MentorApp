import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { PremiumChatQuotaRepository } from "../infrastructure/premium-chat-quota.repository";

@Injectable()
export class PremiumChatQuotaService {
  constructor(
    private readonly config: ConfigRegistryService,
    private readonly quota: PremiumChatQuotaRepository,
  ) {}

  private async limits() {
    const [daily, monthly] = await Promise.all([
      this.config.get("ai.chat.daily_limit"),
      this.config.get("ai.chat.monthly_limit"),
    ]);
    return { daily, monthly };
  }

  async read(userId: string) {
    return this.quota.read(userId, await this.limits());
  }

  async admit(userId: string): Promise<string> {
    const { id, status } = await this.quota.reserve(userId, await this.limits());
    if (!id) {
      throw new DomainError(ErrorCode.AI_CHAT_QUOTA_EXCEEDED, HttpStatus.TOO_MANY_REQUESTS, {
        retryAt: status.retryAt,
      });
    }
    return id;
  }
}
