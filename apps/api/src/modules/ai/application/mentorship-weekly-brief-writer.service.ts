import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { MentorshipWeeklySnapshotDto } from "@mentor/types";
import { PremiumFeatureId } from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { DomainError } from "../../../common/errors/domain-error";
import { AiUsageFeature, estimateCostMicros } from "../domain/ai.constants";
import { LLM_PORT, type LlmPort } from "../domain/llm.port";
import {
  buildMentorshipWeeklyBriefPrompt,
  parseMentorshipWeeklyBrief,
} from "../domain/mentorship-weekly-brief-prompt";
import type { PromptLocale } from "../domain/prompt-locale";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";
import { AiBudgetGuard } from "./ai-budget.guard";
import { PremiumFeatureGateService } from "./premium-feature-gate.service";

@Injectable()
export class MentorshipWeeklyBriefWriterService {
  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly config: ConfigRegistryService,
    private readonly usage: AiUsageRepository,
    private readonly budget: AiBudgetGuard,
    private readonly featureGate: PremiumFeatureGateService,
  ) {}

  async generate(
    snapshot: MentorshipWeeklySnapshotDto,
    /** `roles` undefined = the entitlement reads current roles from the DB (queued callers). */
    coach: { id: string; roles: string[] | undefined },
    locale: PromptLocale,
  ) {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError("AI_DISABLED", HttpStatus.NOT_FOUND);
    }
    await this.featureGate.assertAllowed(
      coach.id,
      coach.roles,
      PremiumFeatureId.MENTORSHIP_BRIEF,
    );
    await this.budget.assertWithinBudget();
    const result = await this.llm.complete(
      buildMentorshipWeeklyBriefPrompt(snapshot, locale),
    );
    // Recorded before parsing: a malformed answer still spent the tokens.
    await this.usage.append({
      ...(result.budgetReservationId
        ? { budgetReservationId: result.budgetReservationId }
        : {}),
      userId: coach.id,
      model: result.model,
      feature: AiUsageFeature.MENTORSHIP_BRIEF,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      costMicros: estimateCostMicros(
        result.model,
        result.promptTokens,
        result.completionTokens,
      ),
    });
    const parsed = parseMentorshipWeeklyBrief(result.text, snapshot.evidence);
    if (parsed.kind === "MALFORMED") {
      throw new DomainError("AI_MALFORMED_RESPONSE", HttpStatus.BAD_GATEWAY);
    }
    return { findings: parsed.findings, model: result.model };
  }
}
