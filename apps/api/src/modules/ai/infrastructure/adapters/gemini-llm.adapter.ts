import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../../../config/env.validation";
import { DomainError } from "../../../../common/errors/domain-error";
import { ErrorCode } from "../../../../common/errors/error-code";
import type { LlmCompleteInput, LlmPort, LlmResult, LlmStreamEvent } from "../../domain/llm.port";
import {
  AI_MAX_OUTPUT_TOKENS,
  AI_REQUEST_TIMEOUT_MS,
  AI_TEMPERATURE,
} from "../../domain/ai.constants";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
/** pgvector column size — every embed provider must produce exactly this many dims. */
const EMBED_DIMENSIONS = 1536;

interface GeminiUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
}

interface GeminiChunk {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: GeminiUsage;
}

/**
 * Gemini chat/embed adapter (fetch — no extra dependency, mirrors OpenAiLlmAdapter). Selected by
 * AI_PROVIDER=gemini. History roles map user→user, assistant→model. Embeddings use
 * GEMINI_EMBED_MODEL with outputDimensionality=1536 to stay compatible with the pgvector schema —
 * switching providers requires a one-time POST /v1/admin/ai/reembed.
 * Failures surface as a generic AI_PROVIDER_ERROR (no provider internals leak).
 */
@Injectable()
export class GeminiLlmAdapter implements LlmPort {
  private readonly logger = new Logger(GeminiLlmAdapter.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  private apiKey(): string {
    const apiKey = this.config.get("GEMINI_API_KEY", { infer: true });
    if (!apiKey) {
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return apiKey;
  }

  private buildBody(input: LlmCompleteInput): unknown {
    return {
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [
        ...(input.history ?? []).map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        { role: "user", parts: [{ text: input.user }] },
      ],
      generationConfig: {
        temperature: AI_TEMPERATURE,
        maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
      },
    };
  }

  async complete(input: LlmCompleteInput): Promise<LlmResult> {
    const apiKey = this.apiKey();
    const model = this.config.get("GEMINI_MODEL", { infer: true });
    try {
      const res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
        body: JSON.stringify(this.buildBody(input)),
      });
      if (!res.ok) {
        this.logger.error(`Gemini ${res.status}: ${await res.text().catch(() => "")}`);
        throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
      }
      const data = (await res.json()) as GeminiChunk;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
      return {
        text,
        promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        model,
      };
    } catch (err) {
      if (err instanceof DomainError) throw err;
      this.logger.error(`Gemini request failed: ${String(err)}`);
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /** Streaming completion via `streamGenerateContent?alt=sse` — yields deltas, then one `final`. */
  async *completeStream(input: LlmCompleteInput): AsyncIterable<LlmStreamEvent> {
    const apiKey = this.apiKey();
    const model = this.config.get("GEMINI_MODEL", { infer: true });

    let res: Response;
    try {
      res = await fetch(`${GEMINI_BASE}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
        body: JSON.stringify(this.buildBody(input)),
      });
    } catch (err) {
      this.logger.error(`Gemini stream request failed: ${String(err)}`);
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!res.ok || !res.body) {
      this.logger.error(`Gemini stream ${res.status}: ${await res.text().catch(() => "")}`);
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let usage: GeminiUsage | undefined;

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
          const parsed = JSON.parse(data) as GeminiChunk;
          if (parsed.usageMetadata) usage = parsed.usageMetadata;
          const delta = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (delta) {
            text += delta;
            yield { delta };
          }
        }
      }
    } catch (err) {
      this.logger.error(`Gemini stream read failed: ${String(err)}`);
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }

    if (!text.trim()) {
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
    yield {
      final: {
        text: text.trim(),
        promptTokens: usage?.promptTokenCount ?? 0,
        completionTokens: usage?.candidatesTokenCount ?? 0,
        model,
      },
    };
  }

  async embed(text: string): Promise<number[]> {
    const apiKey = this.apiKey();
    const model = this.config.get("GEMINI_EMBED_MODEL", { infer: true });
    try {
      const res = await fetch(`${GEMINI_BASE}/${model}:embedContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          content: { parts: [{ text }] },
          outputDimensionality: EMBED_DIMENSIONS,
        }),
      });
      if (!res.ok) {
        this.logger.error(`Gemini embed ${res.status}: ${await res.text().catch(() => "")}`);
        throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
      }
      const data = (await res.json()) as { embedding?: { values?: number[] } };
      const vector = data.embedding?.values;
      // Hard dimension check — a silent mismatch would poison the pgvector column.
      if (!vector || vector.length !== EMBED_DIMENSIONS) {
        this.logger.error(`Gemini embed returned ${vector?.length ?? 0} dims (expected ${EMBED_DIMENSIONS})`);
        throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
      }
      return vector;
    } catch (err) {
      if (err instanceof DomainError) throw err;
      this.logger.error(`Gemini embed failed: ${String(err)}`);
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
