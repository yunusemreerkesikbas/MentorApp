import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { SessionReflectionDto } from "@mentor/types";
import type { RequestUser } from "../../../common/auth/current-user";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { SessionService } from "../../coaching/application/session.service";
import { EntitlementService } from "../../payments/application/entitlement.service";
import { LLM_PORT, type LlmPort } from "../domain/llm.port";
import { buildSessionReflectionPrompt, estimateCostMicros } from "../domain/ai.constants";
import { ContextBuilder } from "./context-builder.service";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";

/**
 * Premium AI reflection on a finalized study session after micro check-in (W3 · §4 #5).
 * Cost bounded by an idempotent per-session cache; coaching clears the cache when feedback
 * changes. AI never touches `study_sessions` directly — writes via {@link SessionService.setAiReflection}.
 */
@Injectable()
export class SessionReflectionService {
  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly context: ContextBuilder,
    private readonly usage: AiUsageRepository,
    private readonly config: ConfigRegistryService,
    private readonly entitlement: EntitlementService,
    private readonly sessions: SessionService,
  ) {}

  async reflect(user: RequestUser, sessionId: string): Promise<SessionReflectionDto> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }

    const ent = await this.entitlement.getEntitlement(user.id, user.roles);
    if (!ent.isPremium) {
      throw new DomainError(ErrorCode.PAYMENT_PREMIUM_REQUIRED, HttpStatus.FORBIDDEN);
    }

    const session = await this.sessions.getById(user.id, sessionId);
    if (!session || !session.endedAt) {
      throw new DomainError(ErrorCode.COACHING_SESSION_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    if (session.sessionMood == null) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST);
    }

    if (session.aiReflection) {
      return { reflection: session.aiReflection, model: "cache" };
    }

    const ctx = await this.context.build(user.id);
    const focusMinutes = Math.max(1, Math.round(session.actualFocusSeconds / 60));
    const { system, user: userMsg } = buildSessionReflectionPrompt(ctx, {
      subject: session.subject,
      focusMinutes,
      sessionMood: session.sessionMood,
      struggleNote: session.struggleNote,
    });

    const result = await this.llm.complete({ system, user: userMsg });

    await this.usage.append({
      userId: user.id,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      costMicros: estimateCostMicros(result.model, result.promptTokens, result.completionTokens),
    });

    await this.sessions.setAiReflection(user.id, sessionId, result.text, result.model);

    return { reflection: result.text, model: result.model };
  }
}
