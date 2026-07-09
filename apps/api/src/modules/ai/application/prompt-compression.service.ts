import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../../config/env.validation";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import {
  CONTEXT_COMPRESSION_PORT,
  type ContextCompressionPort,
} from "../domain/context-compression.port";

export interface CompressedCoachPrompt {
  system: string;
  user: string;
  compression?: {
    tokensBefore: number;
    tokensAfter: number;
    tokensSaved: number;
    compressionRatio: number;
  };
}

/**
 * Optional Headroom compression for coach chat prompts. Verified RAG blocks stay verbatim (§4 #1).
 * Gated by `ai.compression.enabled` + `HEADROOM_PROXY_URL`; failures fall back to uncompressed.
 */
@Injectable()
export class PromptCompressionService {
  private readonly logger = new Logger(PromptCompressionService.name);

  constructor(
    @Inject(CONTEXT_COMPRESSION_PORT) private readonly compression: ContextCompressionPort,
    private readonly configRegistry: ConfigRegistryService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async maybeCompress(input: {
    systemCore: string;
    ragBlock: string | null;
    user: string;
  }): Promise<CompressedCoachPrompt> {
    const joinSystem = (core: string) =>
      input.ragBlock ? `${core}\n\n${input.ragBlock}` : core;

    const enabled = await this.configRegistry.get("ai.compression.enabled");
    const proxyUrl = this.config.get("HEADROOM_PROXY_URL", { infer: true });
    if (!enabled || !proxyUrl) {
      return { system: joinSystem(input.systemCore), user: input.user };
    }

    try {
      const model = this.config.get("OPENAI_MODEL", { infer: true });
      const result = await this.compression.compress({
        model,
        messages: [
          { role: "system", content: input.systemCore },
          { role: "user", content: input.user },
        ],
      });

      const compressedSystem =
        result.messages.find((m) => m.role === "system")?.content ?? input.systemCore;
      const compressedUser =
        result.messages.find((m) => m.role === "user")?.content ?? input.user;

      if (result.compressed) {
        this.logger.debug(
          `Headroom saved ${result.tokensSaved} tokens (${(result.compressionRatio * 100).toFixed(0)}%)`,
        );
      }

      return {
        system: joinSystem(compressedSystem),
        user: compressedUser,
        compression: result.compressed
          ? {
              tokensBefore: result.tokensBefore,
              tokensAfter: result.tokensAfter,
              tokensSaved: result.tokensSaved,
              compressionRatio: result.compressionRatio,
            }
          : undefined,
      };
    } catch (err) {
      this.logger.warn(`Prompt compression skipped: ${String(err)}`);
      return { system: joinSystem(input.systemCore), user: input.user };
    }
  }
}
