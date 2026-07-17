import { Injectable } from "@nestjs/common";
import type {
  VisionCategorizeInput,
  VisionCategorizeResult,
  VisionPort,
} from "../../domain/vision.port";
import { PHOTO_MODEL_FAKE } from "../../domain/photo-classify.constants";

/**
 * Deterministic fake vision (dev/test). Picks the first allowed subject and its first topic so e2e can assert
 * without a real Gemini key.
 */
@Injectable()
export class FakeVisionAdapter implements VisionPort {
  async categorizeImage(
    input: VisionCategorizeInput,
  ): Promise<VisionCategorizeResult> {
    const subjectSlug = input.allowedSubjects[0]?.slug ?? null;
    const topicSlug =
      input.allowedTopics.find((topic) => topic.subjectSlug === subjectSlug)
        ?.slug ?? null;
    return {
      subjectSlug,
      topicSlug,
      model: PHOTO_MODEL_FAKE,
      promptTokens: 100,
      completionTokens: 10,
    };
  }
}
