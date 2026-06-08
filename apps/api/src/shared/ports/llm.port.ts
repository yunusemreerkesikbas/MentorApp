/**
 * LLM port (§8 Ports & Adapters).
 *
 * Provider is pluggable: text = OpenAI (GPT-5, for now), vision = Gemini Flash.
 * The text provider is finalized via a Turkish eval; the adapter changes, the port stays.
 * Cost strategy (§7): expensive calls only at a value-adding moment.
 */
export const LLM_TEXT_PORT = Symbol("LLM_TEXT_PORT");
export const LLM_VISION_PORT = Symbol("LLM_VISION_PORT");

export interface LlmTextPort {
  /** Grounded/free text generation. Context comes from the Context Builder (§8, PII-min). */
  complete(input: { system?: string; prompt: string }): Promise<string>;
}

export interface LlmVisionPort {
  /** Photo → topic CATEGORIZE (never solve! §0). Hallucination guard: classification only. */
  categorizeImage(input: { imageUrl: string; taxonomyHint?: string }): Promise<string[]>;
}
