import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { CategorizePhotoResultDto } from "@mentor/types";
import type { CategorizePhotoInput } from "@mentor/validation";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { ContentService } from "../../content/application/content.service";
import { MockExamService } from "../../coaching/application/mock-exam.service";
import {
  STORAGE_PORT,
  type StoragePort,
} from "../../../shared/ports/storage.port";
import { VISION_PORT, type VisionPort } from "../domain/vision.port";
import { AiUsageFeature, estimateCostMicros } from "../domain/ai.constants";
import { PHOTO_MAX_BYTES } from "../domain/photo-classify.constants";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";
import { AiBudgetGuard } from "./ai-budget.guard";
import { isValidPhotoStorageKey } from "./photo-upload.service";
import { PhotoAccessService } from "./photo-access.service";

/** Premium single-question photo → subject/topic classification; never solves. */
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
    private readonly budget: AiBudgetGuard,
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

    if (input.clientRequestId) {
      const existing =
        await this.mockExams.findPhotoCategorizationsByClientRequestId(
          userId,
          input.clientRequestId,
        );
      if (existing.length > 0) {
        if (existing.some((row) => row.mockExamId !== mockExamId)) {
          throw new DomainError(ErrorCode.CONFLICT, HttpStatus.CONFLICT);
        }
        const owned = await this.mockExams.getOwnedMockExam(userId, mockExamId);
        const [subjects, topics] = await Promise.all([
          this.content.listExamSubjectsByExamId(owned.examId),
          this.content.listExamTopicsByExamId(owned.examId),
        ]);
        return this.toResult(existing, subjects, topics);
      }
    }

    await this.photoAccess.assertCanCategorize(userId, rolesHint);
    if (!isValidPhotoStorageKey(userId, input.storageKey)) {
      throw new DomainError(
        ErrorCode.AI_PHOTO_INVALID_IMAGE,
        HttpStatus.BAD_REQUEST,
      );
    }

    const owned = await this.mockExams.getOwnedMockExam(userId, mockExamId);
    const imageBytes = await this.storage.readObject(input.storageKey);
    if (!imageBytes?.length) {
      throw new DomainError(
        ErrorCode.AI_PHOTO_INVALID_IMAGE,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (imageBytes.length > PHOTO_MAX_BYTES) {
      throw new DomainError(
        ErrorCode.PAYLOAD_TOO_LARGE,
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    const [subjects, topics] = await Promise.all([
      this.content.listExamSubjectsByExamId(owned.examId),
      this.content.listExamTopicsByExamId(owned.examId),
    ]);
    const allowedSubjects = subjects.map(({ slug, name }) => ({ slug, name }));
    const allowedTopics = topics.map(({ subjectSlug, slug, name }) => ({
      subjectSlug,
      slug,
      name,
    }));
    const mimeType = input.storageKey.toLowerCase().endsWith(".png")
      ? "image/png"
      : "image/jpeg";

    await this.budget.assertWithinBudget();
    const visionResult = await this.vision.categorizeImage({
      imageBytes,
      mimeType,
      allowedSubjects,
      allowedTopics,
    });

    const subject = allowedSubjects.find(
      (item) => item.slug === visionResult.subjectSlug,
    );
    const topic = subject
      ? allowedTopics.find(
          (item) =>
            item.subjectSlug === subject.slug &&
            item.slug === visionResult.topicSlug,
        )
      : undefined;
    const classifications = subject
      ? [{ subjectRef: subject.slug, topicRef: topic?.slug ?? null }]
      : [];

    await this.mockExams.recordPhotoCategorizations(
      userId,
      mockExamId,
      classifications,
      input.storageKey,
      input.clientRequestId,
    );
    await this.usage.append({
      userId,
      model: visionResult.model,
      feature: AiUsageFeature.VISION,
      promptTokens: visionResult.promptTokens,
      completionTokens: visionResult.completionTokens,
      costMicros: estimateCostMicros(
        visionResult.model,
        visionResult.promptTokens,
        visionResult.completionTokens,
      ),
    });

    return {
      subjectRefs: subject ? [{ slug: subject.slug, name: subject.name }] : [],
      topicRefs:
        topic && subject
          ? [
              {
                slug: topic.slug,
                name: topic.name,
                subjectSlug: subject.slug,
                subjectName: subject.name,
              },
            ]
          : [],
    };
  }

  private toResult(
    rows: Array<{ subjectRef: string; topicRef: string | null }>,
    subjects: Array<{ slug: string; name: string }>,
    topics: Array<{
      subjectSlug: string;
      subjectName: string;
      slug: string;
      name: string;
    }>,
  ): CategorizePhotoResultDto {
    const subjectBySlug = new Map(
      subjects.map((subject) => [subject.slug, subject]),
    );
    const uniqueSubjects = [...new Set(rows.map((row) => row.subjectRef))];
    const topicKeys = new Set(
      rows.flatMap((row) =>
        row.topicRef ? [row.subjectRef + ":" + row.topicRef] : [],
      ),
    );
    return {
      subjectRefs: uniqueSubjects.map((slug) => ({
        slug,
        name: subjectBySlug.get(slug)?.name ?? slug,
      })),
      topicRefs: topics
        .filter((topic) => topicKeys.has(topic.subjectSlug + ":" + topic.slug))
        .map((topic) => ({
          slug: topic.slug,
          name: topic.name,
          subjectSlug: topic.subjectSlug,
          subjectName: topic.subjectName,
        })),
    };
  }
}
