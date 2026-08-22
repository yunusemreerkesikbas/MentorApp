import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { I18nContext, I18nService } from "nestjs-i18n";
import type { SessionReflectionDto } from "@mentor/types";
import type { RequestUser } from "../../../common/auth/current-user";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { SessionService } from "../../coaching/application/session.service";
import { PremiumFeatureId } from "@mentor/types";
import { LLM_PORT, type LlmPort } from "../domain/llm.port";
import { AiUsageFeature, buildSessionReflectionPrompt, estimateCostMicros } from "../domain/ai.constants";
import { extractSuggestedTask } from "../domain/suggested-task";
import { ContextBuilder } from "./context-builder.service";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";
import { AiBudgetGuard } from "./ai-budget.guard";
import { promptLocale } from "../domain/prompt-locale";
import { hasSeriousDistressSignal } from "../domain/serious-distress";
import { PremiumFeatureGateService } from "./premium-feature-gate.service";

/**
 * Premium AI reflection on a finalized study session after micro check-in (W3 · §4 #5).
 * Cost bounded by an idempotent per-session cache; coaching clears the cache when feedback
 * changes. May include a plan-task suggestion (<<TASK>> marker) — AI never writes plan_tasks;
 * writes via {@link SessionService.setAiReflection}.
 */
@Injectable()
export class SessionReflectionService {
  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly context: ContextBuilder,
    private readonly usage: AiUsageRepository,
    private readonly config: ConfigRegistryService,
    private readonly featureGate: PremiumFeatureGateService,
    private readonly sessions: SessionService,
    private readonly budget: AiBudgetGuard,
    private readonly i18n: I18nService,
  ) {}

  async reflect(user: RequestUser, sessionId: string): Promise<SessionReflectionDto> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }

    await this.featureGate.assertAllowed(
      user.id,
      user.roles,
      PremiumFeatureId.SESSION_REFLECTION,
    );

    const session = await this.sessions.getById(user.id, sessionId);
    if (!session || !session.endedAt) {
      throw new DomainError(ErrorCode.COACHING_SESSION_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    if (session.sessionMood == null) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST);
    }
    if (hasSeriousDistressSignal(session.struggleNote)) {
      const reflection = this.i18n.translate(
        "coaching.mood.SERIOUS_DISTRESS",
        { lang: I18nContext.current()?.lang },
      ) as unknown as string;
      return { reflection, model: "safety" };
    }

    const locale = promptLocale(I18nContext.current()?.lang);
    if (
      session.aiReflection &&
      (await this.sessions.getAiReflectionLocale(user.id, sessionId)) === locale
    ) {
      return {
        reflection: session.aiReflection,
        model: "cache",
        ...(session.aiSuggestedTask ? { suggestedTask: session.aiSuggestedTask } : {}),
      };
    }

    const ctx = await this.context.build(user.id);
    const focusMinutes = Math.max(1, Math.round(session.actualFocusSeconds / 60));
    const { system, user: userMsg } = buildSessionReflectionPrompt(
      ctx,
      {
        subject: session.subject,
        focusMinutes,
        sessionMood: session.sessionMood,
      },
      locale,
    );

    await this.budget.assertWithinBudget();
    const result = await this.llm.complete({ system, user: userMsg });
    const { text, task } = extractSuggestedTask(result.text);

    await this.usage.append({
      userId: user.id,
      model: result.model,
      feature: AiUsageFeature.SESSION_REFLECTION,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      costMicros: estimateCostMicros(result.model, result.promptTokens, result.completionTokens),
    });

    await this.sessions.setAiReflection(
      user.id,
      sessionId,
      text,
      result.model,
      task,
      locale,
    );

    return {
      reflection: text,
      model: result.model,
      ...(task ? { suggestedTask: task } : {}),
    };
  }
}
