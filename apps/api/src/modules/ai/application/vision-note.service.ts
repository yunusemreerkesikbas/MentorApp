import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { VisionNoteDto } from "@mentor/types";
import type { RequestUser } from "../../../common/auth/current-user";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { VisionService } from "../../coaching/application/vision.service";
import { EntitlementService } from "../../payments/application/entitlement.service";
import { LLM_PORT, type LlmPort } from "../domain/llm.port";
import { AiUsageFeature, buildVisionNotePrompt, estimateCostMicros } from "../domain/ai.constants";
import { ContextBuilder } from "./context-builder.service";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";
import { AiBudgetGuard } from "./ai-budget.guard";

/**
 * Premium AI motivation note for the vision/goal board ("hayal/hedef panosu") — W3 · §4 #5
 * premium-only (free tier reads only the goal). Idempotent cache: generated at most once per goal
 * state; coaching clears `aiNote` when the goal/motivation changes, so an unchanged board re-fetch
 * costs nothing. The table write stays inside coaching ({@link VisionService.setAiNote}) — AI never
 * touches `vision_boards` directly (workstreams §2). Usage is metered into `ai_usage` (§7).
 */
@Injectable()
export class VisionNoteService {
  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly context: ContextBuilder,
    private readonly usage: AiUsageRepository,
    private readonly config: ConfigRegistryService,
    private readonly entitlement: EntitlementService,
    private readonly vision: VisionService,
    private readonly budget: AiBudgetGuard,
  ) {}

  async note(user: RequestUser): Promise<VisionNoteDto> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }

    const ent = await this.entitlement.getEntitlement(user.id, user.roles);
    if (!ent.isPremium) {
      throw new DomainError(ErrorCode.PAYMENT_PREMIUM_REQUIRED, HttpStatus.FORBIDDEN);
    }

    const board = await this.vision.getMine(user.id);
    if (!board) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST);
    }

    // Idempotent cache: reuse the note (no LLM call / no cost) until the goal changes.
    if (board.aiNote) {
      return { note: board.aiNote, model: "cache" };
    }

    const ctx = await this.context.build(user.id);
    const { system, user: userMsg } = buildVisionNotePrompt(
      ctx,
      board.goalTitle,
      board.targetCity,
      board.motivation,
    );

    await this.budget.assertWithinBudget();
    const result = await this.llm.complete({ system, user: userMsg });

    await this.usage.append({
      userId: user.id,
      model: result.model,
      feature: AiUsageFeature.VISION_NOTE,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      costMicros: estimateCostMicros(result.model, result.promptTokens, result.completionTokens),
    });

    await this.vision.setAiNote(user.id, result.text, result.model);

    return { note: result.text, model: result.model };
  }
}
