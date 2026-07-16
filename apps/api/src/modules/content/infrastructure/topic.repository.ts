import { Injectable } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { examTopics, subjects, topics } from "../../../database/schema";

export interface ExamTopicRow {
  subjectSlug: string;
  subjectName: string;
  slug: string;
  name: string;
  sortOrder: number;
}

@Injectable()
export class TopicRepository {
  async findByParentAndSlug(
    db: Database | DatabaseTx,
    subjectId: string,
    slug: string,
  ) {
    const rows = await db
      .select()
      .from(topics)
      .where(and(eq(topics.subjectId, subjectId), eq(topics.slug, slug)))
      .limit(1);
    return rows[0];
  }

  async upsert(
    tx: DatabaseTx,
    data: { subjectId: string; slug: string; name: string },
  ) {
    const rows = await tx
      .insert(topics)
      .values(data)
      .onConflictDoUpdate({
        target: [topics.subjectId, topics.slug],
        set: { name: data.name, updatedAt: new Date() },
      })
      .returning();
    return rows[0]!;
  }

  async linkExam(
    tx: DatabaseTx,
    data: { examId: string; topicId: string; sortOrder: number },
  ): Promise<void> {
    await tx
      .insert(examTopics)
      .values(data)
      .onConflictDoUpdate({
        target: [examTopics.examId, examTopics.topicId],
        set: { sortOrder: data.sortOrder },
      });
  }

  async listByExamId(
    db: Database | DatabaseTx,
    examId: string,
  ): Promise<ExamTopicRow[]> {
    return db
      .select({
        subjectSlug: subjects.slug,
        subjectName: subjects.name,
        slug: topics.slug,
        name: topics.name,
        sortOrder: examTopics.sortOrder,
      })
      .from(examTopics)
      .innerJoin(topics, eq(examTopics.topicId, topics.id))
      .innerJoin(subjects, eq(topics.subjectId, subjects.id))
      .where(eq(examTopics.examId, examId))
      .orderBy(asc(examTopics.sortOrder), asc(topics.name));
  }
}
