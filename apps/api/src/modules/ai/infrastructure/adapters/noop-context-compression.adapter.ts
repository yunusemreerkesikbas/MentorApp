import { Injectable } from "@nestjs/common";
import type {
  CompressionInput,
  CompressionResult,
  ContextCompressionPort,
} from "../../domain/context-compression.port";

/** Passthrough when Headroom proxy is not configured. */
@Injectable()
export class NoopContextCompressionAdapter implements ContextCompressionPort {
  async compress(input: CompressionInput): Promise<CompressionResult> {
    return {
      messages: input.messages,
      tokensBefore: 0,
      tokensAfter: 0,
      tokensSaved: 0,
      compressionRatio: 0,
      compressed: false,
    };
  }
}
