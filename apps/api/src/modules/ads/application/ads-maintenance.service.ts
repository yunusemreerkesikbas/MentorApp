import { Injectable, Logger } from "@nestjs/common";
import { AdsService } from "./ads.service";

const SWEEP_BATCH_SIZE = 200;

@Injectable()
export class AdsMaintenanceService {
  private readonly logger = new Logger(AdsMaintenanceService.name);
  private sweeping = false;

  constructor(private readonly ads: AdsService) {}

  async expireNow(): Promise<{ expired: number }> {
    if (this.sweeping) return { expired: 0 };
    this.sweeping = true;
    const startedAt = Date.now();
    try {
      const result = await this.ads.expireDueSessions(SWEEP_BATCH_SIZE);
      if (result.expired > 0) {
        this.logger.log(
          `Ad reward expiry sweep expired=${result.expired} durationMs=${Date.now() - startedAt}`,
        );
      }
      return result;
    } finally {
      this.sweeping = false;
    }
  }
}
