import { Inject, Injectable } from "@nestjs/common";
import type { NotebookReviewQuery } from "@mentor/validation";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { CONTENT_PORT, type ContentPort } from "../domain/content.port";
import { NotebookReviewRepository } from "../infrastructure/notebook-review.repository";
import { notebookReviewWindow } from "../domain/notebook-review-window";
@Injectable()
export class NotebookReviewService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(CONTENT_PORT) private readonly content: ContentPort,
    private readonly repository: NotebookReviewRepository,
  ) {}
  async summary(userId: string, q: NotebookReviewQuery) {
    const now = new Date();
    return withUserContext(this.db, { userId }, async (tx) => {
      const repo = this.repository;
      const [stats, focuses] = await Promise.all([
        repo.summary(tx, userId, q, notebookReviewWindow(q.days, now), now),
        repo.focuses(tx, userId, q.examId),
      ]);
      const exams = [...new Set(focuses.map((f) => f.examId))];
      const labels = await Promise.all(
        exams.map(async (id) => ({
          id,
          subjects: await this.content.listExamSubjects(id),
          topics: await this.content.listExamTopics(id),
        })),
      );
      return {
        ...stats,
        focuses: focuses.map((f) => {
          const taxonomy = labels.find((l) => l.id === f.examId);
          return {
            ...f,
            subjectName:
              taxonomy?.subjects.find((s) => s.slug === f.subjectRef)?.name ??
              f.subjectRef,
            topicName:
              taxonomy?.topics.find(
                (t) => t.subjectSlug === f.subjectRef && t.slug === f.topicRef,
              )?.name ?? f.topicRef,
          };
        }),
      };
    });
  }
  async history(userId: string, q: NotebookReviewQuery) {
    const now = new Date();
    return withUserContext(this.db, { userId }, async (tx) => {
      const result = await this.repository.history(
        tx,
        userId,
        q,
        notebookReviewWindow(q.days, now),
        now,
      );
      const exams = [...new Set(result.items.map((i) => i.examId))];
      const labels = await Promise.all(
        exams.map(async (id) => ({
          id,
          subjects: await this.content.listExamSubjects(id),
          topics: await this.content.listExamTopics(id),
        })),
      );
      return {
        ...result,
        items: result.items.map((i) => {
          const taxonomy = labels.find((l) => l.id === i.examId);
          return {
            ...i,
            reviewedAt: i.reviewedAt.toISOString(),
            nextReviewAt: i.nextReviewAt?.toISOString() ?? null,
            subjectName:
              taxonomy?.subjects.find((s) => s.slug === i.subjectRef)?.name ??
              i.subjectRef,
            topicName:
              taxonomy?.topics.find(
                (t) => t.subjectSlug === i.subjectRef && t.slug === i.topicRef,
              )?.name ?? i.topicRef,
          };
        }),
      };
    });
  }
}
