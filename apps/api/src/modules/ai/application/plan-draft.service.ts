import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";
import type { CoachPlanDraftDto } from "@mentor/types";
import type { RequestUser } from "../../../common/auth/current-user";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { EntitlementService } from "../../payments/application/entitlement.service";
import { LLM_PORT, type LlmPort } from "../domain/llm.port";
import {
  AiUsageFeature,
  buildPlanDraftPrompt,
  estimateCostMicros,
} from "../domain/ai.constants";
import { parsePlanDraft } from "../domain/plan-draft";
import { ContextBuilder } from "./context-builder.service";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";
import { AiBudgetGuard } from "./ai-budget.guard";
import { promptLocale } from "../domain/prompt-locale";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Koç yapımı haftalık plan taslağı (W3 · Faz 2 · §4 #5 premium-only). Returns a clamped 7-day
 * JSON PREVIEW — nothing is persisted here. The user confirms in the FE and the tasks are written
 * through the W2 bulk endpoint (workstreams §2: AI never writes plan tables). Cost: per-feature
 * daily cap (`ai.plan_draft.daily_limit`) + global budget guard; metered as `plan_draft`.
 */
@Injectable()
export class PlanDraftService {
  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly context: ContextBuilder,
    private readonly usage: AiUsageRepository,
    private readonly config: ConfigRegistryService,
    private readonly entitlement: EntitlementService,
    private readonly budget: AiBudgetGuard,
  ) {}

  async draft(user: RequestUser, note?: string): Promise<CoachPlanDraftDto> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }

    const ent = await this.entitlement.getEntitlement(user.id, user.roles);
    if (!ent.isPremium) {
      throw new DomainError(
        ErrorCode.PAYMENT_PREMIUM_REQUIRED,
        HttpStatus.FORBIDDEN,
      );
    }

    const [dailyLimit, usedToday] = await Promise.all([
      this.config.get("ai.plan_draft.daily_limit"),
      this.usage.countFeaturesSince(
        user.id,
        [AiUsageFeature.PLAN_DRAFT, AiUsageFeature.PLAN_ADAPTATION],
        new Date(Date.now() - DAY_MS),
      ),
    ]);
    if (usedToday >= dailyLimit) {
      throw new DomainError(
        ErrorCode.AI_RATE_LIMITED,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const todayIso = new Date().toISOString().slice(0, 10); // UTC day — same day math as plan/streak
    const ctx = await this.context.build(user.id);
    const { system, user: userMsg } = buildPlanDraftPrompt(
      ctx,
      note,
      todayIso,
      promptLocale(I18nContext.current()?.lang),
    );

    await this.budget.assertWithinBudget();
    const result = await this.llm.complete({ system, user: userMsg });

    // The call happened — meter it even when the output turns out unusable.
    await this.usage.append({
      userId: user.id,
      model: result.model,
      feature: AiUsageFeature.PLAN_DRAFT,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      costMicros: estimateCostMicros(
        result.model,
        result.promptTokens,
        result.completionTokens,
      ),
    });

    const days = parsePlanDraft(result.text, todayIso);
    if (!days) {
      throw new DomainError(
        ErrorCode.AI_PROVIDER_ERROR,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { days, model: result.model };
  }
}
