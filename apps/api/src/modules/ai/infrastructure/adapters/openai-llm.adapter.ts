import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../../../config/env.validation";
import { DomainError } from "../../../../common/errors/domain-error";
import { ErrorCode } from "../../../../common/errors/error-code";
import type { LlmCompleteInput, LlmPort, LlmResult } from "../../domain/llm.port";
import { AI_MAX_OUTPUT_TOKENS, AI_REQUEST_TIMEOUT_MS, AI_TEMPERATURE } from "../../domain/ai.constants";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings";

/**
 * Real OpenAI Chat Completions adapter (fetch — no extra dependency). Skeleton: it needs
 * OPENAI_API_KEY (Phase-0 ops) and is selected only when AI_PROVIDER=openai; otherwise the fake
 * adapter runs. Failures surface as a generic AI_PROVIDER_ERROR (no provider internals leak).
 */
@Injectable()
export class OpenAiLlmAdapter implements LlmPort {
  private readonly logger = new Logger(OpenAiLlmAdapter.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async complete(input: LlmCompleteInput): Promise<LlmResult> {
    const apiKey = this.config.get("OPENAI_API_KEY", { infer: true });
    if (!apiKey) {
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
    const model = this.config.get("OPENAI_MODEL", { infer: true });
    try {
      const res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        // Bound the request: timeout (never hang the HTTP request) + max_tokens (cap per-call cost §7).
        signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.user },
          ],
          max_tokens: AI_MAX_OUTPUT_TOKENS,
          temperature: AI_TEMPERATURE,
        }),
      });
      if (!res.ok) {
        this.logger.error(`OpenAI ${res.status}: ${await res.text().catch(() => "")}`);
        throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
      return {
        text,
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        model,
      };
    } catch (err) {
      if (err instanceof DomainError) throw err;
      this.logger.error(`OpenAI request failed: ${String(err)}`);
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async embed(text: string): Promise<number[]> {
    const apiKey = this.config.get("OPENAI_API_KEY", { infer: true });
    if (!apiKey) {
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
    const model = this.config.get("OPENAI_EMBED_MODEL", { infer: true });
    try {
      const res = await fetch(OPENAI_EMBED_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
        body: JSON.stringify({ model, input: text }),
      });
      if (!res.ok) {
        this.logger.error(`OpenAI embed ${res.status}: ${await res.text().catch(() => "")}`);
        throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
      }
      const data = (await res.json()) as { data?: { embedding?: number[] }[] };
      const vector = data.data?.[0]?.embedding;
      if (!vector?.length) {
        throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
      }
      return vector;
    } catch (err) {
      if (err instanceof DomainError) throw err;
      this.logger.error(`OpenAI embed failed: ${String(err)}`);
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
