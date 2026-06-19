import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { CategorizePhotoResultDto } from "@mentor/types";
import type { CategorizePhotoInput } from "@mentor/validation";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { ContentService } from "../../content/application/content.service";
import { MockExamService } from "../../coaching/application/mock-exam.service";
import { STORAGE_PORT, type StoragePort } from "../../../shared/ports/storage.port";
import { VISION_PORT, type VisionPort } from "../domain/vision.port";
import { estimateCostMicros } from "../domain/ai.constants";
import {
  PHOTO_MAX_BYTES,
} from "../domain/photo-classify.constants";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";
import { isValidPhotoStorageKey } from "./photo-upload.service";
import { PhotoAccessService } from "./photo-access.service";

/**
 * Premium photo → subject categorization (§4 #2 classify-only, never solve).
 */
@Injectable()
export class PhotoCategorizeService {
  constructor(
    @Inject(VISION_PORT) private readonly vision: VisionPort,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly config: ConfigRegistryService,
    private readonly content: ContentService,
    private readonly mockExams: MockExamService,
    private readonly usage: AiUsageRepository,
    private readonly photoAccess: PhotoAccessService,
  ) {}

  async categorize(
    userId: string,
    rolesHint: string[] | undefined,
    mockExamId: string,
    input: CategorizePhotoInput,
  ): Promise<CategorizePhotoResultDto> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }

    // Idempotent retry: return the already-recorded result without re-gating or re-running vision
    // (a retry of the user's own prior categorization, so no premium/cap re-check needed).
    if (input.clientRequestId) {
      const existing = await this.mockExams.findPhotoCategorizationsByClientRequestId(
        userId,
        input.clientRequestId,
      );
      if (existing.length > 0) {
        const wrongExam = existing.some((row) => row.mockExamId !== mockExamId);
        if (wrongExam) {
          throw new DomainError(ErrorCode.CONFLICT, HttpStatus.CONFLICT);
        }
        const owned = await this.mockExams.getOwnedMockExam(userId, mockExamId);
        const taxonomy = await this.content.listExamSubjectsByExamId(owned.examId);
        const slugToName = new Map(taxonomy.map((s) => [s.slug, s.name]));
        const slugs = [...new Set(existing.map((r) => r.subjectRef))];
        return {
          subjectRefs: slugs.map((slug) => ({
            slug,
            name: slugToName.get(slug) ?? slug,
          })),
        };
      }
    }

    // Authorize (premium + monthly cap) BEFORE validating resource details for a NEW categorization,
    // so free users get a consistent PAYMENT_PREMIUM_REQUIRED (403), not input-validation behavior.
    await this.photoAccess.assertCanCategorize(userId, rolesHint);

    if (!isValidPhotoStorageKey(userId, input.storageKey)) {
      throw new DomainError(ErrorCode.AI_PHOTO_INVALID_IMAGE, HttpStatus.BAD_REQUEST);
    }

    const owned = await this.mockExams.getOwnedMockExam(userId, mockExamId);

    const imageBytes = await this.storage.readObject(input.storageKey);
    if (!imageBytes || imageBytes.length === 0) {
      throw new DomainError(ErrorCode.AI_PHOTO_INVALID_IMAGE, HttpStatus.BAD_REQUEST);
    }
    if (imageBytes.length > PHOTO_MAX_BYTES) {
      throw new DomainError(ErrorCode.PAYLOAD_TOO_LARGE, HttpStatus.PAYLOAD_TOO_LARGE);
    }

    const taxonomy = await this.content.listExamSubjectsByExamId(owned.examId);
    const allowedSubjects = taxonomy.map((s) => ({ slug: s.slug, name: s.name }));
    const mimeType = input.storageKey.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

    const visionResult = await this.vision.categorizeImage({
      imageBytes,
      mimeType,
      allowedSubjects,
    });

    const allowedSlugs = new Set(allowedSubjects.map((s) => s.slug));
    const validSlugs = [...new Set(visionResult.subjectSlugs.filter((s) => allowedSlugs.has(s)))];

    await this.mockExams.recordPhotoCategorizations(
      userId,
      mockExamId,
      validSlugs,
      input.storageKey,
      input.clientRequestId,
    );

    await this.usage.append({
      userId,
      model: visionResult.model,
      promptTokens: visionResult.promptTokens,
      completionTokens: visionResult.completionTokens,
      costMicros: estimateCostMicros(
        visionResult.model,
        visionResult.promptTokens,
        visionResult.completionTokens,
      ),
    });

    const slugToName = new Map(allowedSubjects.map((s) => [s.slug, s.name]));
    return {
      subjectRefs: validSlugs.map((slug) => ({
        slug,
        name: slugToName.get(slug) ?? slug,
      })),
    };
  }
}
