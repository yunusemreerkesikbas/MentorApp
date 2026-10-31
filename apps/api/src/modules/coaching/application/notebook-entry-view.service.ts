import { Inject, Injectable } from "@nestjs/common";
import type { NotebookEntryDto } from "@mentor/types";
import {
  DomainError,
  ForbiddenError,
} from "../../../common/errors/domain-error";
import {
  STORAGE_PORT,
  type StoragePort,
} from "../../../shared/ports/storage.port";
import type { StorageReadActor } from "../../../shared/storage/storage-budget.types";
import { ContentService } from "../../content/application/content.service";
import type { MistakeNotebookEntryRow } from "../infrastructure/mistake-notebook.repository";

interface ExamTaxonomy {
  subjects: Array<{ slug: string; name: string }>;
  topics: Array<{ subjectSlug: string; slug: string; name: string }>;
}

/** Projection only: backend evidence carries keys; authenticated HTTP carries its exact session. */
@Injectable()
export class NotebookEntryViewService {
  constructor(
    private readonly content: ContentService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async toDtos(
    userId: string,
    rows: MistakeNotebookEntryRow[],
    actor?: StorageReadActor,
  ): Promise<NotebookEntryDto[]> {
    if (actor && actor.userId !== userId) throw new ForbiddenError();
    if (rows.length === 0) return [];
    const taxonomies = await this.taxonomiesFor(rows.map((row) => row.examId));
    return Promise.all(
      rows.map(async (row) => {
        const names = notebookLabelNames(
          taxonomies.get(row.examId),
          row.subjectRef,
          row.topicRef,
        );
        const [url, solutionUrl] = await Promise.all([
          this.photoUrl(row.storageKey, actor),
          this.photoUrl(row.solutionStorageKey, actor),
        ]);
        return {
          id: row.id,
          mockExamId: row.mockExamId,
          storageKey: row.storageKey,
          url,
          subjectRef: row.subjectRef,
          subjectName: names.subjectName,
          topicRef: row.topicRef,
          topicName: names.topicName,
          errorType: row.errorType as NotebookEntryDto["errorType"],
          note: row.note,
          solutionStorageKey: row.solutionStorageKey,
          solutionUrl,
          solutionNote: row.solutionNote,
          status: row.status as NotebookEntryDto["status"],
          reviewCount: row.reviewCount,
          source: row.source as NotebookEntryDto["source"],
          communityThreadId: row.communityThreadId,
          communityAnsweredAt: row.communityAnsweredAt?.toISOString() ?? null,
          lastReviewedAt: row.lastReviewedAt?.toISOString() ?? null,
          nextReviewAt: row.nextReviewAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        };
      }),
    );
  }
  async taxonomiesFor(examIds: string[]): Promise<Map<string, ExamTaxonomy>> {
    return new Map(
      await Promise.all(
        [...new Set(examIds)].map(async (examId) => {
          const [subjects, topics] = await Promise.all([
            this.content.listExamSubjectsByExamId(examId),
            this.content.listExamTopicsByExamId(examId),
          ]);
          return [examId, { subjects, topics }] as const;
        }),
      ),
    );
  }
  private async photoUrl(
    key: string | null,
    actor?: StorageReadActor,
  ): Promise<string | null> {
    if (!key || !actor) return null;
    try {
      return await this.storage.getPrivateUrl(key, actor);
    } catch (error) {
      if (
        error instanceof DomainError &&
        error.code === "STORAGE_TEMPORARILY_UNAVAILABLE"
      )
        return null;
      throw error;
    }
  }
}

/** Preserve a stored slug if editorial taxonomy no longer contains it. */
export function notebookLabelNames(
  taxonomy: ExamTaxonomy | undefined,
  subjectRef: string | null,
  topicRef: string | null,
) {
  const subject = subjectRef
    ? taxonomy?.subjects.find((item) => item.slug === subjectRef)
    : undefined;
  const topic =
    subjectRef && topicRef
      ? taxonomy?.topics.find(
          (item) => item.subjectSlug === subjectRef && item.slug === topicRef,
        )
      : undefined;
  return {
    subjectName: subject?.name ?? subjectRef,
    topicName: topic?.name ?? topicRef,
  };
}
