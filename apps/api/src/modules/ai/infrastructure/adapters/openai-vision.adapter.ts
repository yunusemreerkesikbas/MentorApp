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

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

/**
 * OpenAI vision adapter (fetch — mirrors GeminiVisionAdapter). Selected by VISION_PROVIDER=openai
 * so chat + vision can run on a single OPENAI_API_KEY. Classifies exam question photos into
 * editorial subject slugs only (§4 #2 — never solves).
 */
@Injectable()
export class OpenAiVisionAdapter implements VisionPort {
  private readonly logger = new Logger(OpenAiVisionAdapter.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async categorizeImage(input: VisionCategorizeInput): Promise<VisionCategorizeResult> {
    const apiKey = this.config.get("OPENAI_API_KEY", { infer: true });
    if (!apiKey) {
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
    const model = this.config.get("OPENAI_MODEL", { infer: true });
    const subjectList = JSON.stringify(
      input.allowedSubjects.map((s) => ({ slug: s.slug, name: s.name })),
    );
    const userPrompt =
      `Aşağıdaki ders listesinden görseldeki soruya en uygun slug(ları) seç. JSON only.\nDersler: ${subjectList}`;
    const dataUrl = `data:${input.mimeType};base64,${input.imageBytes.toString("base64")}`;

    try {
      const res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: PHOTO_CLASSIFY_SYSTEM },
            {
              role: "user",
              content: [
                { type: "text", text: userPrompt },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
          response_format: { type: "json_object" },
          // Same bounds as the Gemini vision adapter (§7 cost cap).
          temperature: 0.1,
          max_tokens: 128,
        }),
      });
      if (!res.ok) {
        this.logger.error(`OpenAI vision ${res.status}: ${await res.text().catch(() => "")}`);
        throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) {
        throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
      }
      const parsed = JSON.parse(text) as { subjectSlugs?: string[] };
      const subjectSlugs = Array.isArray(parsed.subjectSlugs)
        ? parsed.subjectSlugs.filter((s) => typeof s === "string")
        : [];
      return {
        subjectSlugs,
        model,
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
      };
    } catch (err) {
      if (err instanceof DomainError) throw err;
      this.logger.error(`OpenAI vision failed: ${String(err)}`);
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
