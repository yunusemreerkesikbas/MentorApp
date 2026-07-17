import { HttpStatus, Injectable } from "@nestjs/common";
import type { PhotoAccessDto } from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { EntitlementService } from "../../payments/application/entitlement.service";
import { MockExamService } from "../../coaching/application/mock-exam.service";
import { PHOTO_MONTHLY_WINDOW_MS } from "../domain/photo-classify.constants";
import { AiBudgetGuard } from "./ai-budget.guard";

function denialStatus(reason: string | undefined): HttpStatus {
  switch (reason) {
    case ErrorCode.AI_DISABLED:
      return HttpStatus.NOT_FOUND;
    case ErrorCode.AI_BUDGET_EXCEEDED:
      return HttpStatus.SERVICE_UNAVAILABLE;
    case ErrorCode.AI_PHOTO_RATE_LIMITED:
      return HttpStatus.TOO_MANY_REQUESTS;
    case ErrorCode.PAYMENT_PREMIUM_REQUIRED:
      return HttpStatus.FORBIDDEN;
    default:
      return HttpStatus.FORBIDDEN;
  }
}

/**
 * Premium-only gate for photo → subject categorization (roadmap §10 — foto tamamen premium).
 */
@Injectable()
export class PhotoAccessService {
  constructor(
    private readonly entitlement: EntitlementService,
    private readonly config: ConfigRegistryService,
    private readonly mockExams: MockExamService,
    private readonly budget: AiBudgetGuard,
  ) {}

  async getAccess(userId: string, rolesHint?: string[]): Promise<PhotoAccessDto> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      return { canCategorize: false, reason: ErrorCode.AI_DISABLED };
    }
    if (!(await this.budget.isWithinBudget())) {
      return { canCategorize: false, reason: ErrorCode.AI_BUDGET_EXCEEDED };
    }

    const ent = await this.entitlement.getEntitlement(userId, rolesHint);
    if (!ent.isPremium) {
      return { canCategorize: false, reason: ErrorCode.PAYMENT_PREMIUM_REQUIRED };
    }

    const monthlyLimit = await this.config.get("ai.photo.monthly_limit");
    const since = new Date(Date.now() - PHOTO_MONTHLY_WINDOW_MS);
    const used = await this.mockExams.countPhotoCategorizationsSince(userId, since);
    const remaining = Math.max(0, monthlyLimit - used);
    if (remaining <= 0) {
      return {
        canCategorize: false,
        reason: ErrorCode.AI_PHOTO_RATE_LIMITED,
        monthlyLimit,
        remainingThisMonth: 0,
      };
    }

    return { canCategorize: true, monthlyLimit, remainingThisMonth: remaining };
  }

  /** Throws localized `DomainError` when upload/categorize must be denied. */
  async assertCanCategorize(userId: string, rolesHint?: string[]): Promise<void> {
    const access = await this.getAccess(userId, rolesHint);
    if (!access.canCategorize) {
      throw new DomainError(access.reason ?? ErrorCode.FORBIDDEN, denialStatus(access.reason));
    }
  }
}
