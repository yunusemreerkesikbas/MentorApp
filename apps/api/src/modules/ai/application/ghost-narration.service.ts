import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { GhostNarrationDto } from "@mentor/types";
import type { RequestUser } from "../../../common/auth/current-user";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { MockExamService } from "../../coaching/application/mock-exam.service";
import { EntitlementService } from "../../payments/application/entitlement.service";
import { LLM_PORT, type LlmPort } from "../domain/llm.port";
import { buildGhostPrompt, estimateCostMicros } from "../domain/ai.constants";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";

/**
 * Premium AI narration of the user's "geçmiş-ben" progress (W3 · §4 #5 premium-only — free tier
 * keeps the rule-based comparison). Cost is bounded by an idempotent cache keyed on the LATEST
 * attempt: a narration is generated once per attempt and reused until a newer attempt arrives.
 * The table write stays inside coaching ({@link MockExamService.setLatestGhostNarration}) — AI never
 * touches `mock_exams` directly (workstreams §2). Usage is metered into `ai_usage` (§7).
 */
@Injectable()
export class GhostNarrationService {
  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly usage: AiUsageRepository,
    private readonly config: ConfigRegistryService,
    private readonly entitlement: EntitlementService,
    private readonly mockExams: MockExamService,
  ) {}

  async narrate(user: RequestUser): Promise<GhostNarrationDto> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }

    const ent = await this.entitlement.getEntitlement(user.id, user.roles);
    if (!ent.isPremium) {
      throw new DomainError(ErrorCode.PAYMENT_PREMIUM_REQUIRED, HttpStatus.FORBIDDEN);
    }

    const ghost = await this.mockExams.getGhostComparison(user.id);
    if (!ghost) {
      // Need at least two attempts to compare against the past.
      throw new DomainError(ErrorCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST);
    }

    // Idempotent cache: reuse this attempt's narration (no LLM call / no cost).
    if (ghost.aiNarration) {
      return { narration: ghost.aiNarration, model: "cache" };
    }

    const { system, user: userMsg } = buildGhostPrompt(ghost);
    const result = await this.llm.complete({ system, user: userMsg });

    await this.usage.append({
      userId: user.id,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      costMicros: estimateCostMicros(result.model, result.promptTokens, result.completionTokens),
    });

    await this.mockExams.setLatestGhostNarration(user.id, result.text, result.model);

    return { narration: result.text, model: result.model };
  }
}
