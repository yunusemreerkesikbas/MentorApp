import { HttpStatus, Injectable } from "@nestjs/common";
import type { WeeklyReviewDto } from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";

type ReadOwnedRecap = (userId: string, examId: string, weekStart?: string) => Promise<WeeklyReviewDto | null>;

/** AI registers the composed report gate without a reverse Coaching → AI import. */
@Injectable()
export class WeeklyRecapRegistry {
  constructor(private readonly config: ConfigRegistryService) {}
  private reader?: ReadOwnedRecap;
  register(reader: ReadOwnedRecap) { this.reader = reader; }
  async read(userId: string, examId: string, weekStart?: string) {
    if (this.reader) return this.reader(userId, examId, weekStart);
    if (await this.config.get("coaching.weekly_recap.access_enabled"))
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.SERVICE_UNAVAILABLE);
    return null;
  }
}
