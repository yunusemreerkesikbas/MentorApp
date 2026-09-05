import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { PremiumFeatureId, type MentorshipStudentReportDto } from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { AiUsageFeature, estimateCostMicros } from "../domain/ai.constants";
import { LLM_PORT, type LlmPort } from "../domain/llm.port";
import {
  buildMentorshipBriefEvidence,
  buildMentorshipBriefPrompt,
} from "../domain/mentorship-brief-prompt";
import type { PromptLocale } from "../domain/prompt-locale";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";
import { AiBudgetGuard } from "./ai-budget.guard";
import { PremiumFeatureGateService } from "./premium-feature-gate.service";

/**
 * Writes one coach's brief about one student (W8).
 *
 * The first feature in this module where the ACTOR is not the SUBJECT. Everything metered and
 * gated here is charged to the **coach**: their quota, their roles, their usage row. The student's
 * tier is irrelevant — they did not ask for this and must not pay for it, in quota or in money.
 *
 * It receives an already-authorized report rather than fetching one. `requireActiveLink` is W8's
 * single gate and it lives inside `getStudentReport`; taking the DTO as an argument means this
 * service cannot route around it even by accident, and it never learns what a coach link is.
 *
 * No caching here either — the cache lives on the link row, which is W8's to own. This service
 * answers exactly one question: what does this report say.
 */
@Injectable()
export class MentorshipBriefService {
  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly config: ConfigRegistryService,
    private readonly usage: AiUsageRepository,
    private readonly budget: AiBudgetGuard,
    private readonly featureGate: PremiumFeatureGateService,
  ) {}

  async generate(
    report: MentorshipStudentReportDto,
    coach: { id: string; roles: string[] },
    locale: PromptLocale,
  ): Promise<{ text: string; model: string }> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }
    // Charged to the coach: Pro passes flat, everyone else gets the configured daily taste.
    await this.featureGate.assertAllowed(
      coach.id,
      coach.roles,
      PremiumFeatureId.MENTORSHIP_BRIEF,
    );

    const prompt = buildMentorshipBriefPrompt(buildMentorshipBriefEvidence(report), locale);
    await this.budget.assertWithinBudget();
    const result = await this.llm.complete(prompt);
    await this.usage.append({
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
    return { text: result.text, model: result.model };
  }
}
