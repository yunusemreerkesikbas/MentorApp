import { HttpStatus, Injectable } from "@nestjs/common";
import { DomainError } from "../../../../common/errors/domain-error";
import { ErrorCode } from "../../../../common/errors/error-code";
import type { LlmCompleteInput, LlmPort, LlmResult, LlmStreamEvent } from "../../domain/llm.port";
import type { VisionCategorizeInput, VisionCategorizeResult, VisionPort } from "../../domain/vision.port";

/** Deployment-level closure remains authoritative even if a stored AI flag is changed. */
@Injectable()
export class DisabledAiAdapter implements LlmPort, VisionPort {
  async complete(_input: LlmCompleteInput): Promise<LlmResult> {
    this.unavailable();
  }

  async *completeStream(_input: LlmCompleteInput): AsyncIterable<LlmStreamEvent> {
    yield this.unavailable();
  }

  async embed(_text: string): Promise<number[]> {
    this.unavailable();
  }

  async categorizeImage(_input: VisionCategorizeInput): Promise<VisionCategorizeResult> {
    this.unavailable();
  }

  private unavailable(): never {
    throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
  }
}
