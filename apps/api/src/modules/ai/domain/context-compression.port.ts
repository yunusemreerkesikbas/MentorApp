/**
 * Context compression seam (Headroom). Compresses LLM-bound prompts before provider calls to cut
 * input tokens. Verified RAG blocks are excluded upstream — only `core` + `user` reach this port.
 */
export const CONTEXT_COMPRESSION_PORT = Symbol("CONTEXT_COMPRESSION_PORT");

export type CompressionMessageRole = "system" | "user" | "assistant" | "tool";

export interface CompressionMessage {
  role: CompressionMessageRole;
  content: string;
}

export interface CompressionInput {
  messages: CompressionMessage[];
  model: string;
}

export interface CompressionResult {
  messages: CompressionMessage[];
  tokensBefore: number;
  tokensAfter: number;
  tokensSaved: number;
  compressionRatio: number;
  compressed: boolean;
}

export interface ContextCompressionPort {
  compress(input: CompressionInput): Promise<CompressionResult>;
}
