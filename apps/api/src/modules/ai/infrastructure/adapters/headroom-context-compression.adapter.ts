import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../../../config/env.validation";
import { DomainError } from "../../../../common/errors/domain-error";
import { ErrorCode } from "../../../../common/errors/error-code";
import type {
  CompressionInput,
  CompressionMessage,
  CompressionResult,
  ContextCompressionPort,
} from "../../domain/context-compression.port";
import { HEADROOM_COMPRESSION_TIMEOUT_MS } from "../../domain/ai.constants";

interface HeadroomCompressResponse {
  messages?: CompressionMessage[];
  tokens_before?: number;
  tokens_after?: number;
  tokens_saved?: number;
  compression_ratio?: number;
}

/**
 * Headroom proxy adapter — POST /v1/compress on the local Python sidecar.
 * See docker/headroom and docs/core/integrations.md.
 */
@Injectable()
export class HeadroomContextCompressionAdapter implements ContextCompressionPort {
  private readonly logger = new Logger(HeadroomContextCompressionAdapter.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async compress(input: CompressionInput): Promise<CompressionResult> {
    const baseUrl = this.config.get("HEADROOM_PROXY_URL", { infer: true });
    if (!baseUrl) {
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }

    const url = `${baseUrl.replace(/\/$/, "")}/v1/compress`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(HEADROOM_COMPRESSION_TIMEOUT_MS),
        body: JSON.stringify({ messages: input.messages, model: input.model }),
      });
      if (!res.ok) {
        this.logger.error(`Headroom ${res.status}: ${await res.text().catch(() => "")}`);
        throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
      }
      const data = (await res.json()) as HeadroomCompressResponse;
      const messages = data.messages ?? input.messages;
      const tokensBefore = data.tokens_before ?? 0;
      const tokensAfter = data.tokens_after ?? 0;
      const tokensSaved = data.tokens_saved ?? Math.max(0, tokensBefore - tokensAfter);
      return {
        messages,
        tokensBefore,
        tokensAfter,
        tokensSaved,
        compressionRatio: data.compression_ratio ?? 0,
        compressed: tokensSaved > 0,
      };
    } catch (err) {
      if (err instanceof DomainError) throw err;
      this.logger.error(`Headroom compress failed: ${String(err)}`);
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
