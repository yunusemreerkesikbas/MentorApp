import { Injectable } from "@nestjs/common";

import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { NotebookReviewQuery } from "@mentor/validation";
import type { DatabaseTx } from "../../../database/drizzle";
import {
  mistakeNotebookEntries as entries,
  notebookReviews as reviews,
} from "../../../database/schema";

/** Review history is queried with live entry labels, never copies of notes or photos. */
@Injectable()
export class NotebookReviewRepository {
  async lockEntry(tx: DatabaseTx, userId: string, id: string) {
    const [row] = await tx
      .select()
      .from(entries)
      .where(and(eq(entries.userId, userId), eq(entries.id, id)))
      .for("update");
    return row;
  }
  async findReview(tx: DatabaseTx, userId: string, id: string) {
    const [row] = await tx
      .select()
      .from(reviews)
      .where(and(eq(reviews.userId, userId), eq(reviews.id, id)));
    return row;
  }
  async insert(tx: DatabaseTx, row: typeof reviews.$inferInsert) {
    await tx.insert(reviews).values(row);
  }
  private scope(userId: string, q: NotebookReviewQuery) {
    return and(
      eq(entries.userId, userId),
      q.examId ? eq(entries.examId, q.examId) : undefined,
      q.subjectRef ? eq(entries.subjectRef, q.subjectRef) : undefined,
      q.topicRef ? eq(entries.topicRef, q.topicRef) : undefined,
      q.errorType ? eq(entries.errorType, q.errorType) : undefined,
    );
  }
  async summary(
    tx: DatabaseTx,
    userId: string,
    q: NotebookReviewQuery,
    since: Date,
    now: Date,
  ) {
    const [stats] = await tx
      .select({
        workedCount: sql<number>`count(distinct ${reviews.entryId})::int`,
        revisitCount: sql<number>`count(distinct ${reviews.entryId}) filter (where ${entries.status} = 'ACTIVE' and not ${reviews.solved} and not exists (select 1 from notebook_reviews newer where newer.entry_id = ${reviews.entryId} and (newer.reviewed_at, newer.id) > (${reviews.reviewedAt}, ${reviews.id})))::int`,
        completedCount: sql<number>`count(distinct ${reviews.entryId}) filter (where ${reviews.beforeStatus} <> 'HEALED' and ${reviews.afterStatus} = 'HEALED')::int`,
      })
      .from(reviews)
      .innerJoin(entries, eq(entries.id, reviews.entryId))
      .where(
        and(
          this.scope(userId, q),
          eq(reviews.userId, userId),
          gte(reviews.reviewedAt, since),
          lte(reviews.reviewedAt, now),
        ),
      );
    const [due] = await tx
      .select({ dueCount: sql<number>`count(*)::int` })
      .from(entries)
      .where(
        and(
          this.scope(userId, q),
          eq(entries.status, "ACTIVE"),
          lte(entries.nextReviewAt, now),
        ),
      );
    return {
      ...stats!,
      dueCount: due?.dueCount ?? 0,
      since: since.toISOString(),
      days: q.days,
    };
  }
  async history(
    tx: DatabaseTx,
    userId: string,
    q: NotebookReviewQuery,
    since: Date,
    now: Date,
  ) {
    const where = and(
      this.scope(userId, q),
      eq(reviews.userId, userId),
      gte(reviews.reviewedAt, since),
      lte(reviews.reviewedAt, now),
    );
    const [items, totals] = await Promise.all([
      tx
        .select({
          id: reviews.id,
          entryId: entries.id,
          examId: entries.examId,
          subjectRef: entries.subjectRef,
          topicRef: entries.topicRef,
          solved: reviews.solved,
          early: reviews.early,
          reviewedAt: reviews.reviewedAt,
          nextReviewAt: reviews.nextReviewAt,
        })
        .from(reviews)
        .innerJoin(entries, eq(entries.id, reviews.entryId))
        .where(where)
        .orderBy(desc(reviews.reviewedAt), desc(reviews.id))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      tx
        .select({ total: sql<number>`count(*)::int` })
        .from(reviews)
        .innerJoin(entries, eq(entries.id, reviews.entryId))
        .where(where),
    ]);
    return {
      items,
      total: totals[0]?.total ?? 0,
      page: q.page,
      pageSize: q.pageSize,
    };
  }
  async focuses(tx: DatabaseTx, userId: string, examId?: string) {
    return tx
      .selectDistinct({
        subjectRef: entries.subjectRef,
        topicRef: entries.topicRef,
        examId: entries.examId,
      })
      .from(entries)
      .where(
        and(
          eq(entries.userId, userId),
          examId ? eq(entries.examId, examId) : undefined,
        ),
      )
      .orderBy(asc(entries.subjectRef), asc(entries.topicRef));
  }
}
