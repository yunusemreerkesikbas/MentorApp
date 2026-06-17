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

  /**
   * Deterministic lexical embedding: token-hash into 1536 buckets + L2-normalize. Not semantic, but
   * shared tokens → overlapping buckets → higher cosine similarity, so RAG retrieval is testable in
   * dev/test without a real embeddings API.
   */
  async embed(text: string): Promise<number[]> {
    const v = new Array<number>(1536).fill(0);
    const tokens = text.toLowerCase().split(/[^a-z0-9çğıöşü]+/i).filter(Boolean);
    for (const t of tokens) {
      let h = 0;
      for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
      const idx = h % 1536;
      v[idx] = (v[idx] ?? 0) + 1;
    }
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / norm);
  }
}
