/**
 * LLM provider seam (§8). The AI module talks only to this port; adapters (fake/OpenAI) are swapped
 * by env (AI_PROVIDER). `complete` is a chat completion (optional multi-turn history). Token counts
 * feed the usage meter (§7 cost cap). The port carries NO PII — callers pass a PII-free prompt (§4 #6).
 */
export const LLM_PORT = Symbol("LLM_PORT");

/** Prior conversation turns (oldest-first) — the user's own words + earlier coach replies. */
export interface LlmHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmCompleteInput {
  system: string;
  user: string;
  /** Optional multi-turn history injected between system and the new user message. */
  history?: LlmHistoryMessage[];
}

export interface LlmResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
  model: string;
}

/** Incremental completion event: text deltas while generating, then exactly one `final`. */
export type LlmStreamEvent = { delta: string; final?: never } | { delta?: never; final: LlmResult };

export interface LlmPort {
  complete(input: LlmCompleteInput): Promise<LlmResult>;
  /** Streaming variant of `complete` — yields text deltas, ends with one `final` result. */
  completeStream(input: LlmCompleteInput): AsyncIterable<LlmStreamEvent>;
  /** Embed text into a 1536-dim vector (RAG, §1). Content-only — never behavioral/PII data (§4 #6). */
  embed(text: string): Promise<number[]>;
}
