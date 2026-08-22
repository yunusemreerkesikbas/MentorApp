import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";
import type { DailyGreetingDto } from "@mentor/types";
import type { RequestUser } from "../../../common/auth/current-user";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { PremiumFeatureId } from "@mentor/types";
import { LLM_PORT, type LlmPort } from "../domain/llm.port";
import { AiUsageFeature, buildDailyGreetingPrompt, estimateCostMicros } from "../domain/ai.constants";
import { ContextBuilder } from "./context-builder.service";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";
import { DailyGreetingRepository } from "../infrastructure/daily-greeting.repository";
import { AiBudgetGuard } from "./ai-budget.guard";
import { promptLocale } from "../domain/prompt-locale";
import { PremiumFeatureGateService } from "./premium-feature-gate.service";

/**
 * Premium proactive daily greeting on the dashboard rhythm card (W3 · §4 #5 premium-only — free tier keeps the
 * rule-based brief). Cost is bounded by an idempotent daily cache: at most one LLM call per
 * (user, UTC day, locale); the message stays fixed for the day and language.
 * Mirrors {@link MoodReflectionService}; usage metered into `ai_usage` (§7).
 */
@Injectable()
export class DailyGreetingService {
  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly context: ContextBuilder,
    private readonly usage: AiUsageRepository,
    private readonly config: ConfigRegistryService,
    private readonly featureGate: PremiumFeatureGateService,
    private readonly greetings: DailyGreetingRepository,
    private readonly budget: AiBudgetGuard,
  ) {}

  async greet(user: RequestUser): Promise<DailyGreetingDto> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }

    await this.featureGate.assertAllowed(
      user.id,
      user.roles,
      PremiumFeatureId.DAILY_GREETING,
    );

    const today = new Date().toISOString().slice(0, 10); // UTC day — same day math as streak
    const locale = promptLocale(I18nContext.current()?.lang);
    const cached = await this.greetings.find(user.id, today, locale);
    if (cached) {
      return { greeting: cached.greeting, model: "cache" };
    }

    const ctx = await this.context.build(user.id);
    const { system, user: userMsg } = buildDailyGreetingPrompt(
      ctx,
      locale,
    );

    await this.budget.assertWithinBudget();
    const result = await this.llm.complete({ system, user: userMsg });

    await this.usage.append({
      userId: user.id,
      model: result.model,
      feature: AiUsageFeature.DAILY_GREETING,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      costMicros: estimateCostMicros(result.model, result.promptTokens, result.completionTokens),
    });

    await this.greetings.insert({
      userId: user.id,
      greetingDate: today,
      greeting: result.text,
      model: result.model,
      locale,
    });

    return { greeting: result.text, model: result.model };
  }
}
