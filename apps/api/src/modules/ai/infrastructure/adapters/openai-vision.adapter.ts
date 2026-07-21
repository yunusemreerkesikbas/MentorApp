import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../../../config/env.validation";
import { DomainError } from "../../../../common/errors/domain-error";
import { ErrorCode } from "../../../../common/errors/error-code";
import { AI_REQUEST_TIMEOUT_MS } from "../../domain/ai.constants";
import type {
  VisionCategorizeInput,
  VisionCategorizeResult,
  VisionPort,
} from "../../domain/vision.port";
import { PHOTO_CLASSIFY_SYSTEM } from "../../domain/photo-classify.constants";
import { collectOutputText, providerErrorLog } from "./openai-responses.util";

const OPENAI_URL = "https://api.openai.com/v1/responses";

/**
 * OpenAI vision adapter (fetch — mirrors the LLM adapter, on the Responses API). Selected by
 * VISION_PROVIDER=openai so chat + vision can run on a single OPENAI_API_KEY. Classifies exam
 * question photos into editorial subject/topic slugs (§4 #2 — never solves). The image is a typed
 * `input_image` content part; JSON output is requested via `text.format` (not `response_format`).
 */
@Injectable()
export class OpenAiVisionAdapter implements VisionPort {
  private readonly logger = new Logger(OpenAiVisionAdapter.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async categorizeImage(
    input: VisionCategorizeInput,
  ): Promise<VisionCategorizeResult> {
    const apiKey = this.config.get("OPENAI_API_KEY", { infer: true });
    if (!apiKey) {
      throw new DomainError(
        ErrorCode.AI_PROVIDER_ERROR,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const model = this.config.get("OPENAI_MODEL", { infer: true });
    const taxonomy = JSON.stringify({
      subjects: input.allowedSubjects,
      topics: input.allowedTopics,
    });
    const userPrompt = `Bu whitelist içinden tek subjectSlug ve ona bağlı topicSlug seç. JSON only.\nTaksonomi: ${taxonomy}`;
    const dataUrl = `data:${input.mimeType};base64,${input.imageBytes.toString("base64")}`;

    try {
      const res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          model,
          instructions: PHOTO_CLASSIFY_SYSTEM,
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: userPrompt },
                { type: "input_image", image_url: dataUrl },
              ],
            },
          ],
          text: { format: { type: "json_object" } },
          // Same bounds as the Gemini vision adapter (§7 cost cap).
          temperature: 0.1,
          max_output_tokens: 128,
        }),
      });
      if (!res.ok) {
        this.logger.error(providerErrorLog("vision", res));
        throw new DomainError(
          ErrorCode.AI_PROVIDER_ERROR,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      const data = (await res.json()) as {
        status?: string;
        output?: unknown;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const text = collectOutputText(data.output).trim();
      if (!text || data.status === "incomplete" || data.status === "failed") {
        throw new DomainError(
          ErrorCode.AI_PROVIDER_ERROR,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      const parsed = JSON.parse(text) as {
        subjectSlug?: unknown;
        topicSlug?: unknown;
      };
      return {
        subjectSlug:
          typeof parsed.subjectSlug === "string" ? parsed.subjectSlug : null,
        topicSlug:
          typeof parsed.topicSlug === "string" ? parsed.topicSlug : null,
        model,
        promptTokens: data.usage?.input_tokens ?? 0,
        completionTokens: data.usage?.output_tokens ?? 0,
      };
    } catch (err) {
      if (err instanceof DomainError) throw err;
      this.logger.error("OpenAI vision request failed");
      throw new DomainError(
        ErrorCode.AI_PROVIDER_ERROR,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
