import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { ConfigRegistryService } from "../../../../common/config/config-registry.service";
import { DomainError } from "../../../../common/errors/domain-error";
import { ErrorCode } from "../../../../common/errors/error-code";
import { AiBudgetGuard } from "../../application/ai-budget.guard";
import {
  RAW_VISION_PORT,
  type VisionCategorizeInput,
  type VisionCategorizeResult,
  type VisionPort,
} from "../../domain/vision.port";

/** Applies the same aggregate reservation boundary to billable image classification calls. */
@Injectable()
export class BudgetedVisionAdapter implements VisionPort {
  constructor(
    @Inject(RAW_VISION_PORT) private readonly delegate: VisionPort,
    private readonly budget: AiBudgetGuard,
    private readonly config: ConfigRegistryService,
  ) {}

  async categorizeImage(input: VisionCategorizeInput): Promise<VisionCategorizeResult> {
    if (!(await this.config.get("ai.enabled"))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }
    const budgetReservationId = await this.budget.acquire();
    try {
      const result = await this.delegate.categorizeImage(input);
      return {
        ...result,
        ...(budgetReservationId ? { budgetReservationId } : {}),
      };
    } catch (error) {
      await this.budget.release(budgetReservationId);
      throw error;
    }
  }
}
