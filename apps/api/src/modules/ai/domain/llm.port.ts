/**
 * LLM provider seam (§8). The AI module talks only to this port; adapters (fake/OpenAI) are swapped
 * by env (AI_PROVIDER). `complete` is a single-shot chat completion (single-turn MVP). Token counts
 * feed the usage meter (§7 cost cap). The port carries NO PII — callers pass a PII-free prompt (§4 #6).
 */
export const LLM_PORT = Symbol("LLM_PORT");

export interface LlmCompleteInput {
  system: string;
  user: string;
}

export interface LlmResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
  model: string;
}

export interface LlmPort {
  complete(input: LlmCompleteInput): Promise<LlmResult>;
  /** Embed text into a 1536-dim vector (RAG, §1). Content-only — never behavioral/PII data (§4 #6). */
  embed(text: string): Promise<number[]>;
}
