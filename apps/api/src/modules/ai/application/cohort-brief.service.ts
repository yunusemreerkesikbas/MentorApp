import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { PremiumFeatureId } from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { AiUsageFeature, estimateCostMicros } from "../domain/ai.constants";
import {
  buildCohortBriefPrompt,
  parseCohortBrief,
  type CohortBriefEvidence,
} from "../domain/cohort-brief-prompt";
import { LLM_PORT, type LlmPort } from "../domain/llm.port";
import type { PromptLocale } from "../domain/prompt-locale";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";
import { AiBudgetGuard } from "./ai-budget.guard";
import { PremiumFeatureGateService } from "./premium-feature-gate.service";

/**
 * Writes one coach's brief about their whole cohort (W8).
 *
 * The second feature in this module where the ACTOR is not the SUBJECT, and the split of labour is
 * `mentorship-brief.service.ts`'s exactly: everything metered and gated here is charged to the
 * **coach** — their quota, their roles, their `ai_usage` row. No student's tier is consulted; they
 * did not ask for this and must not pay for it, in quota or in money.
 *
 * It receives already-shaped evidence rather than a roster. W8 owns the gate (`assertEnabled`, and
 * the roster query that is scoped to the coach) and the cache; taking `CohortBriefEvidence` as an
 * argument means this service cannot route around either, and never learns what a coach link is.
 *
 * ponytail: synchronous, like every other LLM call on a request path here. standards/backend.md
 * wants this on the JobQueuePort and `ai.md` already logs that deviation for vision and the
 * per-student brief. Moving it is a shape-preserving change — POST enqueues, GET polls the row it
 * already reads — and is worth doing once real latency exists to measure.
 */
@Injectable()
export class CohortBriefService {
  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly config: ConfigRegistryService,
    private readonly usage: AiUsageRepository,
    private readonly budget: AiBudgetGuard,
    private readonly featureGate: PremiumFeatureGateService,
  ) {}

  async generate(
    evidence: CohortBriefEvidence,
    coach: { id: string; roles: string[] },
    locale: PromptLocale,
  ): Promise<{
    overall: string;
    items: { ref: string; why: string; action: string }[];
    model: string;
  }> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }
    // Charged to the coach: Pro passes flat, everyone else gets the configured daily taste.
    await this.featureGate.assertAllowed(
      coach.id,
      coach.roles,
      PremiumFeatureId.MENTORSHIP_COHORT_BRIEF,
    );

    const prompt = buildCohortBriefPrompt(evidence, locale);
    await this.budget.assertWithinBudget();
    const result = await this.llm.complete(prompt);
    // The meter row is written even when the answer turns out unusable: the call was made, the
    // tokens were spent, and a cost dashboard that only counts successes under-reports the bill.
    await this.usage.append({
      ...(result.budgetReservationId ? { budgetReservationId: result.budgetReservationId } : {}),
      userId: coach.id,
      model: result.model,
      feature: AiUsageFeature.MENTORSHIP_COHORT_BRIEF,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      costMicros: estimateCostMicros(
        result.model,
        result.promptTokens,
        result.completionTokens,
      ),
    });

    const parsed = parseCohortBrief(result.text, evidence);
    if (parsed.kind === "MALFORMED") {
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { overall: parsed.overall, items: parsed.items, model: result.model };
  }
}
