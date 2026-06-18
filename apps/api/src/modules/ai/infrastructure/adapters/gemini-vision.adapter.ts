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

/**
 * Gemini Flash vision adapter (fetch — no extra dependency). Classifies exam question photos
 * into editorial subject slugs only (§4 #2).
 */
@Injectable()
export class GeminiVisionAdapter implements VisionPort {
  private readonly logger = new Logger(GeminiVisionAdapter.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async categorizeImage(input: VisionCategorizeInput): Promise<VisionCategorizeResult> {
    const apiKey = this.config.get("GEMINI_API_KEY", { infer: true });
    if (!apiKey) {
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
    const model = this.config.get("GEMINI_MODEL", { infer: true });
    const subjectList = JSON.stringify(
      input.allowedSubjects.map((s) => ({ slug: s.slug, name: s.name })),
    );
    const userPrompt =
      `Aşağıdaki ders listesinden görseldeki soruya en uygun slug(ları) seç. JSON only.\nDersler: ${subjectList}`;

    const base64 = input.imageBytes.toString("base64");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: PHOTO_CLASSIFY_SYSTEM }] },
          contents: [
            {
              parts: [
                { text: userPrompt },
                {
                  inlineData: {
                    mimeType: input.mimeType,
                    data: base64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 128,
            responseMimeType: "application/json",
          },
        }),
      });
      if (!res.ok) {
        this.logger.error(`Gemini vision ${res.status}: ${await res.text().catch(() => "")}`);
        throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
      }
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) {
        throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
      }
      const parsed = JSON.parse(text) as { subjectSlugs?: string[] };
      const subjectSlugs = Array.isArray(parsed.subjectSlugs)
        ? parsed.subjectSlugs.filter((s) => typeof s === "string")
        : [];
      return {
        subjectSlugs,
        model: model,
        promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      };
    } catch (err) {
      if (err instanceof DomainError) throw err;
      this.logger.error(`Gemini vision failed: ${String(err)}`);
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
