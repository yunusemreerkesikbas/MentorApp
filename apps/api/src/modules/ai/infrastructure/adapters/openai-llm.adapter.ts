import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../../../config/env.validation";
import { DomainError } from "../../../../common/errors/domain-error";
import { ErrorCode } from "../../../../common/errors/error-code";
import type { LlmCompleteInput, LlmPort, LlmResult, LlmStreamEvent } from "../../domain/llm.port";
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
            ...(input.history ?? []),
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

  /**
   * Streaming completion: OpenAI SSE (`stream: true` + `include_usage` so the final chunk carries
   * token counts). Yields deltas as they arrive, then one `final` with the accumulated text.
   */
  async *completeStream(input: LlmCompleteInput): AsyncIterable<LlmStreamEvent> {
    const apiKey = this.config.get("OPENAI_API_KEY", { infer: true });
    if (!apiKey) {
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
    const model = this.config.get("OPENAI_MODEL", { infer: true });

    let res: Response;
    try {
      res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: input.system },
            ...(input.history ?? []),
            { role: "user", content: input.user },
          ],
          max_tokens: AI_MAX_OUTPUT_TOKENS,
          temperature: AI_TEMPERATURE,
          stream: true,
          stream_options: { include_usage: true },
        }),
      });
    } catch (err) {
      this.logger.error(`OpenAI stream request failed: ${String(err)}`);
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!res.ok || !res.body) {
      this.logger.error(`OpenAI stream ${res.status}: ${await res.text().catch(() => "")}`);
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;

    try {
      for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
        buffer += decoder.decode(chunk, { stream: true });
        // SSE frames are separated by a blank line; keep the trailing partial frame in the buffer.
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const data = frame
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trim())
            .join("");
          if (!data || data === "[DONE]") continue;
          const parsed = JSON.parse(data) as {
            choices?: { delta?: { content?: string } }[];
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
          if (parsed.usage) usage = parsed.usage;
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            text += delta;
            yield { delta };
          }
        }
      }
    } catch (err) {
      this.logger.error(`OpenAI stream read failed: ${String(err)}`);
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }

    if (!text.trim()) {
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
    yield {
      final: {
        text: text.trim(),
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
        model,
      },
    };
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
