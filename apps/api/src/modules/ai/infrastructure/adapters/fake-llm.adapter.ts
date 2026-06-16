import { Injectable } from "@nestjs/common";
import type { LlmCompleteInput, LlmPort, LlmResult } from "../../domain/llm.port";

/** Rough token estimate (~4 chars/token) — good enough for the usage meter in dev/test. */
const estimateTokens = (text: string): number => Math.max(1, Math.ceil(text.length / 4));

/**
 * Deterministic fake LLM (dev/test default — mirrors the fake payments adapter). Returns a fixed
 * coaching reply + estimated token counts so the usage meter and rate-limit are exercised without a
 * real provider/key. Never reaches production with a real key (AI_PROVIDER=openai there).
 */
@Injectable()
export class FakeLlmAdapter implements LlmPort {
  async complete(input: LlmCompleteInput): Promise<LlmResult> {
    const text =
      "Bugün küçük ve net bir hedefle başla: 25 dakikalık odak + 5 dakika mola. " +
      "Resmî tarih/süreç bilgileri için Bilgi Merkezi'ne bakmayı unutma.";
    return {
      text,
      promptTokens: estimateTokens(input.system) + estimateTokens(input.user),
      completionTokens: estimateTokens(text),
      model: "fake",
    };
  }
}
