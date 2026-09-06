import { Inject, Injectable } from "@nestjs/common";
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
  ) {}

  async categorizeImage(input: VisionCategorizeInput): Promise<VisionCategorizeResult> {
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
