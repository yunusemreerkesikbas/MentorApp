import { Injectable } from "@nestjs/common";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import {
  mistakeNotebookEntries,
  mistakeNotebookPages,
} from "../../../database/schema";

export type MistakeNotebookEntryRow =
  typeof mistakeNotebookEntries.$inferSelect;
export type MistakeNotebookPageRow = typeof mistakeNotebookPages.$inferSelect;

export interface CreateNotebookEntryRow {
  examId: string;
  source: string;
  communityThreadId: string | null;
  mockExamId: string | null;
  storageKey: string | null;
  subjectRef: string | null;
  topicRef: string | null;
  errorType: string;
  note: string | null;
  solutionStorageKey: string | null;
  solutionNote: string | null;
  nextReviewAt: Date;
}

/**
 * Every R2 key one entry row holds, in the shape the orphan sweep wants: a flat list with the
 * nulls already gone.
 *
 * Its own function so the "did we remember every photo column?" question has one answer with a
 * test on it — the sweep deletes whatever these keys do not name, so a column forgotten here is a
 * column whose photos disappear a day later.
 */
export function notebookEntryImageKeys(row: {
  storageKey: string | null;
  solutionStorageKey: string | null;
}): string[] {
  return [row.storageKey, row.solutionStorageKey].filter(
    (key): key is string => key != null,
  );
}

export interface UpdateNotebookEntryRow {
  subjectRef?: string | null;
  topicRef?: string | null;
  errorType?: string;
  note?: string | null;
  solutionStorageKey?: string | null;
  solutionNote?: string | null;
  status?: string;
  /** Moves with `status`: the due scan reads this date, so archiving must clear it. */
  nextReviewAt?: Date | null;
  /** Reset when a card re-enters the rotation — the ladder assumes uninterrupted spacing. */
  reviewCount?: number;
}

export interface NotebookCounts {
  entryCount: number;
  dueCount: number;
  healedCount: number;
  pageCount: number;
}

/** Data access for the mistake notebook (entries + per-page layout documents). */
@Injectable()
export class MistakeNotebookRepository {
  async createEntry(
    tx: DatabaseTx,
    userId: string,
    input: CreateNotebookEntryRow,
  ): Promise<MistakeNotebookEntryRow> {
    const rows = await tx
      .insert(mistakeNotebookEntries)
      .values({ userId, ...input })
      .returning();
    return rows[0]!;
  }

  async findEntry(
    tx: DatabaseTx,
    userId: string,
    entryId: string,
  ): Promise<MistakeNotebookEntryRow | undefined> {
    const rows = await tx
      .select()
      .from(mistakeNotebookEntries)
      .where(
        and(
          eq(mistakeNotebookEntries.id, entryId),
          eq(mistakeNotebookEntries.userId, userId),
        ),
      )
      .limit(1);
    return rows[0];
  }

  /**
   * Hydrate exactly the entries a page references. Ids come from the page document, so the caller
   * passes a bounded list (`NOTEBOOK_PAGE_MAX_ENTRIES`) — no pagination needed, and no reason to
   * ship the whole notebook to render one page.
   */
  async listEntriesByIds(
    tx: DatabaseTx,
    userId: string,
    entryIds: string[],
  ): Promise<MistakeNotebookEntryRow[]> {
    if (entryIds.length === 0) return [];
    return tx
      .select()
      .from(mistakeNotebookEntries)
      .where(
        and(
          eq(mistakeNotebookEntries.userId, userId),
          inArray(mistakeNotebookEntries.id, entryIds),
        ),
      );
  }

  /** Entries whose review moment has arrived. Single index scan on (user_id, next_review_at). */
  async listDueEntries(
    tx: DatabaseTx,
    userId: string,
    now: Date,
    limit: number,
  ): Promise<MistakeNotebookEntryRow[]> {
    return tx
      .select()
      .from(mistakeNotebookEntries)
      .where(
        and(
          eq(mistakeNotebookEntries.userId, userId),
          isNotNull(mistakeNotebookEntries.nextReviewAt),
          lte(mistakeNotebookEntries.nextReviewAt, now),
        ),
      )
      .orderBy(asc(mistakeNotebookEntries.nextReviewAt))
      .limit(limit);
  }

  async updateEntry(
    tx: DatabaseTx,
    userId: string,
    entryId: string,
    patch: UpdateNotebookEntryRow,
  ): Promise<MistakeNotebookEntryRow | undefined> {
    const rows = await tx
      .update(mistakeNotebookEntries)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(
        and(
          eq(mistakeNotebookEntries.id, entryId),
          eq(mistakeNotebookEntries.userId, userId),
        ),
      )
      .returning();
    return rows[0];
  }

  /** Record a review outcome. `nextReviewAt: null` is what takes the row out of the due scan. */
  async recordReview(
    tx: DatabaseTx,
    userId: string,
    entryId: string,
    outcome: { nextReviewAt: Date | null; status: string; reviewCount: number },
    reviewedAt: Date,
  ): Promise<MistakeNotebookEntryRow | undefined> {
    const rows = await tx
      .update(mistakeNotebookEntries)
      .set({
        nextReviewAt: outcome.nextReviewAt,
        status: outcome.status,
        reviewCount: outcome.reviewCount,
        lastReviewedAt: reviewedAt,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(mistakeNotebookEntries.id, entryId),
          eq(mistakeNotebookEntries.userId, userId),
        ),
      )
      .returning();
    return rows[0];
  }

  async deleteEntry(
    tx: DatabaseTx,
    userId: string,
    entryId: string,
  ): Promise<MistakeNotebookEntryRow | undefined> {
    const rows = await tx
      .delete(mistakeNotebookEntries)
      .where(
        and(
          eq(mistakeNotebookEntries.id, entryId),
          eq(mistakeNotebookEntries.userId, userId),
        ),
      )
      .returning();
    return rows[0];
  }

  /** Cover-screen numbers in one round-trip; the cover renders nothing else. */
  /**
   * The index: a user's entries, newest first, with the two filters the table is indexed for.
   *
   * `desc(createdAt)` rides `mistake_notebook_user_created_idx` and the subject filter rides
   * `mistake_notebook_user_subject_idx` — both were created with `0077` and had no query until now.
   */
  async listEntries(
    tx: DatabaseTx,
    userId: string,
    filters: {
      subjectRef?: string;
      errorType?: string;
      status?: string;
      page: number;
      pageSize: number;
    },
  ): Promise<{ items: MistakeNotebookEntryRow[]; total: number }> {
    const where = and(
      eq(mistakeNotebookEntries.userId, userId),
      ...(filters.subjectRef
        ? [eq(mistakeNotebookEntries.subjectRef, filters.subjectRef)]
        : []),
      ...(filters.errorType
        ? [eq(mistakeNotebookEntries.errorType, filters.errorType)]
        : []),
      ...(filters.status
        ? [eq(mistakeNotebookEntries.status, filters.status)]
        : []),
    );
    const [items, totalRow] = await Promise.all([
      tx
        .select()
        .from(mistakeNotebookEntries)
        .where(where)
        .orderBy(desc(mistakeNotebookEntries.createdAt))
        .limit(filters.pageSize)
        .offset((filters.page - 1) * filters.pageSize),
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(mistakeNotebookEntries)
        .where(where),
    ]);
    return { items, total: totalRow[0]?.count ?? 0 };
  }

  async countsFor(
    tx: DatabaseTx,
    userId: string,
    now: Date,
  ): Promise<NotebookCounts> {
    const [entries] = await tx
      .select({
        entryCount: count(),
        dueCount:
          sql<number>`count(*) FILTER (WHERE ${mistakeNotebookEntries.nextReviewAt} IS NOT NULL AND ${mistakeNotebookEntries.nextReviewAt} <= ${now})`.mapWith(
            Number,
          ),
        healedCount:
          sql<number>`count(*) FILTER (WHERE ${mistakeNotebookEntries.status} = 'HEALED')`.mapWith(
            Number,
          ),
      })
      .from(mistakeNotebookEntries)
      .where(eq(mistakeNotebookEntries.userId, userId));
    const [pages] = await tx
      .select({ pageCount: count() })
      .from(mistakeNotebookPages)
      .where(eq(mistakeNotebookPages.userId, userId));
    return {
      entryCount: entries?.entryCount ?? 0,
      dueCount: entries?.dueCount ?? 0,
      healedCount: entries?.healedCount ?? 0,
      pageCount: pages?.pageCount ?? 0,
    };
  }

  async findPage(
    tx: DatabaseTx,
    userId: string,
    pageIndex: number,
  ): Promise<MistakeNotebookPageRow | undefined> {
    const rows = await tx
      .select()
      .from(mistakeNotebookPages)
      .where(
        and(
          eq(mistakeNotebookPages.userId, userId),
          eq(mistakeNotebookPages.pageIndex, pageIndex),
        ),
      )
      .limit(1);
    return rows[0];
  }

  /** Upsert on (user_id, page_index) — the client saves a page it may or may not have created. */
  async upsertPage(
    tx: DatabaseTx,
    userId: string,
    pageIndex: number,
    doc: unknown,
  ): Promise<MistakeNotebookPageRow> {
    const rows = await tx
      .insert(mistakeNotebookPages)
      .values({ userId, pageIndex, doc })
      .onConflictDoUpdate({
        target: [mistakeNotebookPages.userId, mistakeNotebookPages.pageIndex],
        set: { doc, updatedAt: sql`now()` },
      })
      .returning();
    return rows[0]!;
  }

  /** Attach the forum thread the user just asked this mistake in. */
  async linkThread(
    tx: DatabaseTx,
    userId: string,
    entryId: string,
    threadId: string,
  ): Promise<MistakeNotebookEntryRow | undefined> {
    const rows = await tx
      .update(mistakeNotebookEntries)
      .set({ communityThreadId: threadId, updatedAt: sql`now()` })
      .where(
        and(
          eq(mistakeNotebookEntries.id, entryId),
          eq(mistakeNotebookEntries.userId, userId),
        ),
      )
      .returning();
    return rows[0];
  }

  /**
   * Mark every entry pointing at a thread as answered.
   *
   * Service-scoped and not filtered by user, because the caller is the accepted-answer listener:
   * it knows a thread, not whose notebook the thread came from. Plural on purpose — two students
   * can link the same question, and both of their cards deserve the answer.
   */
  async markThreadAnswered(
    tx: DatabaseTx,
    threadId: string,
    answeredAt: Date,
  ): Promise<number> {
    const rows = await tx
      .update(mistakeNotebookEntries)
      .set({ communityAnsweredAt: answeredAt, updatedAt: sql`now()` })
      .where(eq(mistakeNotebookEntries.communityThreadId, threadId))
      .returning({ id: mistakeNotebookEntries.id });
    return rows.length;
  }

  /**
   * Which subjects the user keeps writing down lately.
   *
   * Scoped by a recency window rather than by "which mock exams were recent", the way the retired
   * photo-categorization query was: most mistakes are caught while studying and carry no
   * `mock_exam_id`, so an exam-attempt scope would throw away the majority of the signal.
   */
  async listSubjectSignals(
    tx: DatabaseTx,
    userId: string,
    examId: string | undefined,
    since: Date,
  ): Promise<Array<{ subjectRef: string; count: number }>> {
    const rows = await tx
      .select({
        subjectRef: mistakeNotebookEntries.subjectRef,
        count: sql<number>`count(*)::int`,
      })
      .from(mistakeNotebookEntries)
      .where(
        and(
          eq(mistakeNotebookEntries.userId, userId),
          examId ? eq(mistakeNotebookEntries.examId, examId) : undefined,
          isNotNull(mistakeNotebookEntries.subjectRef),
          gte(mistakeNotebookEntries.createdAt, since),
        ),
      )
      .groupBy(mistakeNotebookEntries.subjectRef)
      .orderBy(desc(sql`count(*)`));
    return rows.map((row) => ({ ...row, subjectRef: row.subjectRef! }));
  }

  async listTopicSignals(
    tx: DatabaseTx,
    userId: string,
    examId: string | undefined,
    since: Date,
  ): Promise<
    Array<{
      subjectRef: string;
      topicRef: string;
      count: number;
      latestAt: Date;
    }>
  > {
    const rows = await tx
      .select({
        subjectRef: mistakeNotebookEntries.subjectRef,
        topicRef: mistakeNotebookEntries.topicRef,
        count: sql<number>`count(*)::int`,
        latestAt: sql<Date>`max(${mistakeNotebookEntries.createdAt})`,
      })
      .from(mistakeNotebookEntries)
      .where(
        and(
          eq(mistakeNotebookEntries.userId, userId),
          examId ? eq(mistakeNotebookEntries.examId, examId) : undefined,
          isNotNull(mistakeNotebookEntries.subjectRef),
          isNotNull(mistakeNotebookEntries.topicRef),
          gte(mistakeNotebookEntries.createdAt, since),
        ),
      )
      .groupBy(
        mistakeNotebookEntries.subjectRef,
        mistakeNotebookEntries.topicRef,
      )
      .orderBy(
        desc(sql`count(*)`),
        desc(sql`max(${mistakeNotebookEntries.createdAt})`),
      );
    return rows.map((row) => ({
      ...row,
      subjectRef: row.subjectRef!,
      topicRef: row.topicRef!,
    }));
  }

  /**
   * The distribution the whole feature exists to produce.
   *
   * "Eight wrong in Problems" makes a student re-study a topic they already know — usually the
   * wrong call, and a wasted week. "Six of those eight were careless" tells them to slow down
   * instead. Nothing else in the app can answer that, because nothing else asks.
   */
  async listErrorTypeSignals(
    tx: DatabaseTx,
    userId: string,
    examId: string | undefined,
    since: Date,
  ): Promise<Array<{ errorType: string; count: number }>> {
    return tx
      .select({
        errorType: mistakeNotebookEntries.errorType,
        count: sql<number>`count(*)::int`,
      })
      .from(mistakeNotebookEntries)
      .where(
        and(
          eq(mistakeNotebookEntries.userId, userId),
          examId ? eq(mistakeNotebookEntries.examId, examId) : undefined,
          gte(mistakeNotebookEntries.createdAt, since),
        ),
      )
      .groupBy(mistakeNotebookEntries.errorType)
      .orderBy(desc(sql`count(*)`));
  }

  /**
   * Every photo key referenced by any notebook entry, across all users — the orphan sweep's input.
   *
   * Entries own their keys as columns, so unlike the vision board this needs no jsonb unfolding.
   *
   * BOTH photo columns have to be here. The sweep deletes every object under `notebook/` that this
   * method does not name, so a column missing from this select is a column whose photos vanish once
   * the grace period passes. `solution_storage_key` shares the prefix, and was added later than
   * `storage_key` — that is exactly how one gets left out.
   */
  async listAllReferencedImageKeys(tx: DatabaseTx): Promise<string[]> {
    const rows = await tx
      .select({
        storageKey: mistakeNotebookEntries.storageKey,
        solutionStorageKey: mistakeNotebookEntries.solutionStorageKey,
      })
      .from(mistakeNotebookEntries)
      .where(
        or(
          isNotNull(mistakeNotebookEntries.storageKey),
          isNotNull(mistakeNotebookEntries.solutionStorageKey),
        ),
      );
    return rows.flatMap(notebookEntryImageKeys);
  }
}
