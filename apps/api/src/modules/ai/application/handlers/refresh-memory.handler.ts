import { Inject, Injectable, Logger } from "@nestjs/common";
import { z } from "zod";
import { LLM_PORT, type LlmPort } from "../../domain/llm.port";
import {
  AiUsageFeature,
  buildMemoryProfilePrompt,
  estimateCostMicros,
  MEMORY_DISTILL_WINDOW,
} from "../../domain/ai.constants";
import { AiUsageRepository } from "../../infrastructure/ai-usage.repository";
import { CoachMessageRepository } from "../../infrastructure/coach-message.repository";
import { CoachMemoryRepository } from "../../infrastructure/coach-memory.repository";
import { AiBudgetGuard } from "../ai-budget.guard";

const payloadSchema = z.object({ userId: z.string().uuid() });

/**
 * AI_MEMORY_JOB handler (W3): distill a PII-free profile from the user's recent chat history and
 * upsert it. Idempotent — re-running at the same message count is a no-op; empty history is a no-op
 * (no LLM call). §4 #6: the prompt forbids any personal identifier.
 */
@Injectable()
export class RefreshMemoryHandler {
  private readonly logger = new Logger(RefreshMemoryHandler.name);

  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly messages: CoachMessageRepository,
    private readonly memory: CoachMemoryRepository,
    private readonly usage: AiUsageRepository,
    private readonly budget: AiBudgetGuard,
  ) {}

  async handle(payload: unknown): Promise<void> {
    const { userId } = payloadSchema.parse(payload);

    // Over budget → skip silently (return, don't throw) so the job doesn't retry-storm on no money.
    if (!(await this.budget.isWithinBudget())) return;

    const recent = await this.messages.lastN(userId, MEMORY_DISTILL_WINDOW);
    if (recent.length === 0) return;

    // Skip the LLM call if the profile is already current for this message count.
    const existing = await this.memory.get(userId);
    if (existing && existing.messageCount === recent.length) return;

    const history = recent.map((m) => ({
      role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));
    const { system, user } = buildMemoryProfilePrompt(history);
    const result = await this.llm.complete({ system, user });

    await this.memory.upsert(userId, {
      summary: result.text.trim(),
      model: result.model,
      messageCount: recent.length,
    });

    // Meter the distillation call so it shows in the admin cost dashboard (feature=memory).
    await this.usage.append({
      userId,
      model: result.model,
      feature: AiUsageFeature.MEMORY,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      costMicros: estimateCostMicros(result.model, result.promptTokens, result.completionTokens),
    });
    this.logger.debug(`Memory profile refreshed for user ${userId} (${recent.length} msgs)`);
  }
}
