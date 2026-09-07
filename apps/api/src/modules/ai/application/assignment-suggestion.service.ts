import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  PremiumFeatureId,
  type MentorshipProgramTemplateTaskDto,
  type MentorshipStudentReportDto,
} from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { AiUsageFeature, estimateCostMicros } from "../domain/ai.constants";
import {
  buildAssignmentSuggestionPrompt,
  collectEvidenceSubjects,
  parseAssignmentSuggestions,
} from "../domain/assignment-suggestion-prompt";
import { buildMentorshipBriefEvidence } from "../domain/mentorship-brief-prompt";
import { LLM_PORT, type LlmPort } from "../domain/llm.port";
import type { PromptLocale } from "../domain/prompt-locale";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";
import { AiBudgetGuard } from "./ai-budget.guard";
import { PremiumFeatureGateService } from "./premium-feature-gate.service";

/**
 * Drafts a week of homework for one student (W8).
 *
 * The third feature here where the ACTOR is not the SUBJECT, and everything is charged to the
 * coach for the same reason as the two briefs: the student did not ask for this and must not pay
 * for it, in quota or in money.
 *
 * It takes an already-authorized report, exactly like `mentorship-brief.service.ts` — W8's
 * `requireActiveLink` lives inside `getStudentReport`, so passing the DTO in means this service
 * cannot route around the gate and never learns what a coach link is.
 *
 * There is deliberately NO cache. The two briefs cache because writing the same summary twice is
 * waste; a suggestion set is the opposite — a coach who did not like this week's draft asks again,
 * and handing back the identical week from a fingerprint would make the button look broken. The
 * quota is the bound instead, which is what a quota is for.
 */
@Injectable()
export class AssignmentSuggestionService {
  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly config: ConfigRegistryService,
    private readonly usage: AiUsageRepository,
    private readonly budget: AiBudgetGuard,
    private readonly featureGate: PremiumFeatureGateService,
  ) {}

  async suggest(
    report: MentorshipStudentReportDto,
    coach: { id: string; roles: string[] },
    locale: PromptLocale,
  ): Promise<{ tasks: MentorshipProgramTemplateTaskDto[]; model: string }> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }
    await this.featureGate.assertAllowed(
      coach.id,
      coach.roles,
      PremiumFeatureId.MENTORSHIP_SUGGESTIONS,
    );

    // The brief's evidence shaper, reused: names and the coach's own note are already stripped
    // there, so this prompt inherits both without a second place to keep them stripped.
    const evidence = buildMentorshipBriefEvidence(report);
    const prompt = buildAssignmentSuggestionPrompt(evidence, locale);
    await this.budget.assertWithinBudget();
    const result = await this.llm.complete(prompt);
    await this.usage.append({
      ...(result.budgetReservationId ? { budgetReservationId: result.budgetReservationId } : {}),
      userId: coach.id,
      model: result.model,
      feature: AiUsageFeature.MENTORSHIP_SUGGESTIONS,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      costMicros: estimateCostMicros(
        result.model,
        result.promptTokens,
        result.completionTokens,
      ),
    });

    // The subject allowlist comes from the same evidence the model read, so a subject it invented
    // for an exam it assumed is blanked rather than written into the student's plan.
    const parsed = parseAssignmentSuggestions(
      result.text,
      collectEvidenceSubjects(evidence),
    );
    if (parsed.kind === "MALFORMED") {
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { tasks: parsed.tasks, model: result.model };
  }
}
