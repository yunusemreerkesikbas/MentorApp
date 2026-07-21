import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../../../config/env.validation";
import { DomainError } from "../../../../common/errors/domain-error";
import { ErrorCode } from "../../../../common/errors/error-code";
import type { LlmCompleteInput, LlmPort, LlmResult, LlmStreamEvent } from "../../domain/llm.port";
import { AI_MAX_OUTPUT_TOKENS, AI_REQUEST_TIMEOUT_MS, AI_TEMPERATURE } from "../../domain/ai.constants";
import { collectOutputText, providerErrorLog } from "./openai-responses.util";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings";
const EMBED_DIMENSIONS = 1536;

/**
 * Responses API request body. `system` maps to top-level `instructions` (never duplicated into
 * `input`); history + the user turn use the simplified string-content message form (typed parts
 * are only needed for multimodal). `max_output_tokens` replaces chat/completions' `max_tokens`.
 */
function buildBody(model: string, input: LlmCompleteInput): Record<string, unknown> {
  return {
    model,
    instructions: input.system,
    input: [...(input.history ?? []), { role: "user", content: input.user }],
    max_output_tokens: AI_MAX_OUTPUT_TOKENS,
    temperature: AI_TEMPERATURE,
  };
}

interface ResponsesUsage {
  input_tokens?: number;
  output_tokens?: number;
}

/**
 * Real OpenAI **Responses API** adapter (fetch — no extra dependency). It needs OPENAI_API_KEY
 * (Phase-0 ops) and is selected only when AI_PROVIDER=openai; otherwise the fake adapter runs.
 * Failures surface as a generic AI_PROVIDER_ERROR (no provider internals leak). Embeddings stay
 * on /v1/embeddings (unchanged by the migration); the vision adapter is on /v1/responses too.
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
        // Bound the request: timeout (never hang the HTTP request) + max_output_tokens (cap per-call cost §7).
        signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
        body: JSON.stringify(buildBody(model, input)),
      });
      if (!res.ok) {
        this.logger.error(providerErrorLog("responses", res));
        throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
      }
      const data = (await res.json()) as {
        status?: string;
        output?: unknown;
        usage?: ResponsesUsage;
      };
      const text = collectOutputText(data.output).trim();
      if (!text || data.status === "incomplete" || data.status === "failed") {
        throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
      }
      return {
        text,
        promptTokens: data.usage?.input_tokens ?? 0,
        completionTokens: data.usage?.output_tokens ?? 0,
        model,
      };
    } catch (err) {
      if (err instanceof DomainError) throw err;
      this.logger.error("OpenAI responses request failed");
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /**
   * Streaming completion: Responses SSE emits typed events — `response.output_text.delta` carries
   * text deltas, `response.completed` carries usage. Every `data:` payload self-describes via
   * `type`, so `event:` lines are ignored. Yields deltas as they arrive, then one `final`.
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
        body: JSON.stringify({ ...buildBody(model, input), stream: true }),
      });
    } catch {
      this.logger.error("OpenAI stream request failed");
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!res.ok || !res.body) {
      this.logger.error(providerErrorLog("stream", res));
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let usage: ResponsesUsage | undefined;

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
          if (!data) continue;
          const parsed = JSON.parse(data) as {
            type?: string;
            delta?: string;
            response?: { status?: string; usage?: ResponsesUsage };
          };
          if (parsed.type === "response.output_text.delta" && parsed.delta) {
            text += parsed.delta;
            yield { delta: parsed.delta };
          } else if (parsed.type === "response.completed") {
            usage = parsed.response?.usage;
          } else if (
            parsed.type === "response.failed" ||
            parsed.type === "response.incomplete" ||
            parsed.type === "error"
          ) {
            this.logger.error(`OpenAI stream ended with ${parsed.type}`);
            throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
          }
          // All other typed events (response.created, output_item.added, content_part.*, …) are ignored.
        }
      }
    } catch (err) {
      if (err instanceof DomainError) throw err;
      this.logger.error("OpenAI stream read failed");
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }

    if (!text.trim()) {
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
    yield {
      final: {
        text: text.trim(),
        promptTokens: usage?.input_tokens ?? 0,
        completionTokens: usage?.output_tokens ?? 0,
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
        this.logger.error(providerErrorLog("embedding", res));
        throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
      }
      const data = (await res.json()) as { data?: { embedding?: unknown[] }[] };
      const vector = data.data?.[0]?.embedding;
      if (
        !vector ||
        vector.length !== EMBED_DIMENSIONS ||
        !vector.every((value) => typeof value === "number" && Number.isFinite(value))
      ) {
        throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
      }
      return vector as number[];
    } catch (err) {
      if (err instanceof DomainError) throw err;
      this.logger.error("OpenAI embedding request failed");
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
