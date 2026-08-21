import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type {
  NotebookEntryDto,
  NotebookImageUploadUrlDto,
  NotebookOverviewDto,
  NotebookPageDoc,
  NotebookPageDto,
} from "@mentor/types";
import {
  NOTEBOOK_IMAGE_MAX_BYTES,
  NOTEBOOK_IMAGE_MIMES,
  notebookPageIndexSchema,
  type CreateNotebookEntryInput,
  type NotebookPageDocInput,
  type UpdateNotebookEntryInput,
} from "@mentor/validation";
import {
  NotFoundError,
  ValidationFailedError,
} from "../../../common/errors/domain-error";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { STORAGE_PORT, type StoragePort } from "../../../shared/ports/storage.port";
import { ContentService } from "../../content/application/content.service";
import { advanceReview, firstReviewAt } from "../domain/notebook-review.policy";
import { CoachingEventTopic, NotebookEntryReviewed } from "../domain/coaching.events";
import {
  MistakeNotebookRepository,
  type MistakeNotebookEntryRow,
} from "../infrastructure/mistake-notebook.repository";

/** Public prefix all notebook photos live under; the orphan sweep lists exactly this. */
export const NOTEBOOK_PREFIX = "notebook/";
/** An object younger than this belongs to a card the user has not finished composing. */
const NOTEBOOK_ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;
/** Fixed work per sweep pass; the next pass picks up whatever is left. */
const NOTEBOOK_ORPHAN_SWEEP_BATCH = 500;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** A page the user has never saved. Ruled paper, nothing on it — the blank page they turn to. */
const EMPTY_PAGE: NotebookPageDoc = {
  version: 1,
  paper: "ruled",
  items: [],
  ink: [],
};

/** The strip only ever shows a handful; a due list longer than this is a wall of guilt, not a nudge. */
const DUE_LIMIT = 20;

/**
 * The page index arrives as a path segment, so `ParseIntPipe` is the only thing between the request
 * and the database — and it happily passes -1 or 10^9. Bounding it here keeps a crafted URL from
 * seeding an unreachable page nobody can ever turn to.
 */
function assertPageIndex(pageIndex: number): void {
  const parsed = notebookPageIndexSchema.safeParse(pageIndex);
  if (!parsed.success) {
    throw new ValidationFailedError({ reason: "invalid_page_index" });
  }
}

/**
 * Mistake notebook ("yanlış defteri") — the wrong answers a student chose to keep, plus the page
 * layout they arranged them into.
 *
 * The feature exists for one field: `errorType`. A student already knows the subject and topic of
 * every mistake; what they never track is *why* they lost the point, and "you keep making careless
 * slips in a topic you know" is a different study decision from "you do not know this topic".
 * That field is collected with one tap and never inferred by a model (§4 #2).
 */
@Injectable()
export class MistakeNotebookService {
  private readonly logger = new Logger(MistakeNotebookService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly notebook: MistakeNotebookRepository,
    private readonly content: ContentService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Optional() private readonly events?: EventEmitter2,
  ) {}

  async getOverview(userId: string): Promise<NotebookOverviewDto> {
    const now = new Date();
    const counts = await withUserContext(this.db, { userId }, (tx) =>
      this.notebook.countsFor(tx, userId, now),
    );
    return counts;
  }

  /**
   * One page, with only the entries it actually shows.
   *
   * A page the user has not saved yet is returned as an empty document rather than a 404: turning
   * to a blank page is a normal thing to do in a notebook, and making the client special-case
   * "does this page exist" would put the book's structure in two places.
   */
  async getPage(userId: string, pageIndex: number): Promise<NotebookPageDto> {
    assertPageIndex(pageIndex);
    const { doc, entries } = await withUserContext(
      this.db,
      { userId },
      async (tx) => {
        const row = await this.notebook.findPage(tx, userId, pageIndex);
        /*
         * Spread over the empty page rather than casting the stored value straight across. The
         * write schema defaults new fields, but that only runs on the way in — a row written
         * before a field existed comes back out of jsonb without it, and the cast would promise
         * the client a property that is actually `undefined`. `ink` is the first field to have
         * that problem; this makes it the last, without a backfill migration.
         */
        const stored = row?.doc as Partial<NotebookPageDoc> | undefined;
        const page: NotebookPageDoc = stored
          ? { ...EMPTY_PAGE, ...stored }
          : EMPTY_PAGE;
        const entryIds = page.items.flatMap((item) =>
          item.kind === "entry" ? [item.entryId] : [],
        );
        return {
          doc: page,
          entries: await this.notebook.listEntriesByIds(tx, userId, entryIds),
        };
      },
    );
    return { pageIndex, doc, entries: await this.toEntryDtos(entries) };
  }

  /**
   * Replace one page's layout.
   *
   * Every referenced entry is checked to exist and belong to the caller. The schema proves the ids
   * are uuids; only the database knows whose they are, and without this check a crafted document
   * could pin another user's entry — and its photo URL — onto this user's page.
   */
  async putPage(
    userId: string,
    pageIndex: number,
    doc: NotebookPageDocInput,
  ): Promise<NotebookPageDto> {
    assertPageIndex(pageIndex);
    const entryIds = doc.items.flatMap((item) =>
      item.kind === "entry" ? [item.entryId] : [],
    );

    const entries = await withUserContext(this.db, { userId }, async (tx) => {
      const owned = await this.notebook.listEntriesByIds(tx, userId, entryIds);
      if (owned.length !== entryIds.length) {
        throw new ValidationFailedError({ reason: "unknown_entry_ref" });
      }
      await this.notebook.upsertPage(tx, userId, pageIndex, doc);
      return owned;
    });

    return {
      pageIndex,
      doc: doc as NotebookPageDoc,
      entries: await this.toEntryDtos(entries),
    };
  }

  /**
   * Add a mistake to the book.
   *
   * The first review is scheduled here, not on first open: an entry that sits unscheduled is the
   * paper notebook's failure mode — written down once and never returned to.
   */
  /**
   * A stored key must live under the caller's own R2 prefix.
   *
   * The presigned PUT is minted per upload, but the key that finally lands in the row comes from
   * the request body — so without this an entry could be made to point at someone else's object,
   * and `getPublicUrl` would happily hand it back on every read. Both photo columns go through it;
   * the solution key was the one added later, which is how a check like this gets skipped.
   */
  private assertOwnStorageKey(userId: string, key: string | null | undefined): void {
    if (key && !key.startsWith(`${NOTEBOOK_PREFIX}${userId}/`)) {
      throw new ValidationFailedError({ reason: "foreign_storage_key" });
    }
  }

  async createEntry(
    userId: string,
    input: CreateNotebookEntryInput,
  ): Promise<NotebookEntryDto> {
    this.assertOwnStorageKey(userId, input.storageKey);
    this.assertOwnStorageKey(userId, input.solutionStorageKey);
    await this.assertLabelsBelongToExam(input.examId, input.subjectRef, input.topicRef);

    const row = await withUserContext(this.db, { userId }, (tx) =>
      this.notebook.createEntry(tx, userId, {
        examId: input.examId,
        mockExamId: input.mockExamId ?? null,
        storageKey: input.storageKey ?? null,
        subjectRef: input.subjectRef ?? null,
        topicRef: input.topicRef ?? null,
        errorType: input.errorType,
        note: input.note?.trim() ? input.note.trim() : null,
        solutionStorageKey: input.solutionStorageKey ?? null,
        solutionNote: input.solutionNote?.trim()
          ? input.solutionNote.trim()
          : null,
        source: input.source,
        communityThreadId: input.communityThreadId ?? null,
        nextReviewAt: firstReviewAt(),
      }),
    );
    const [dto] = await this.toEntryDtos([row]);
    return dto!;
  }

  async updateEntry(
    userId: string,
    entryId: string,
    patch: UpdateNotebookEntryInput,
  ): Promise<NotebookEntryDto> {
    const row = await withUserContext(this.db, { userId }, async (tx) => {
      const existing = await this.notebook.findEntry(tx, userId, entryId);
      if (!existing) throw new NotFoundError({ reason: "notebook_entry_missing" });

      // Labels are validated against the entry's own exam, not the request's: a patch never moves
      // an entry between exams, so the taxonomy it must satisfy is already fixed.
      if (patch.subjectRef !== undefined || patch.topicRef !== undefined) {
        await this.assertLabelsBelongToExam(
          existing.examId,
          patch.subjectRef ?? existing.subjectRef,
          patch.topicRef ?? existing.topicRef,
        );
      }

      this.assertOwnStorageKey(userId, patch.solutionStorageKey);

      const updated = await this.notebook.updateEntry(tx, userId, entryId, {
        ...(patch.subjectRef !== undefined ? { subjectRef: patch.subjectRef ?? null } : {}),
        ...(patch.topicRef !== undefined ? { topicRef: patch.topicRef ?? null } : {}),
        ...(patch.errorType !== undefined ? { errorType: patch.errorType } : {}),
        ...(patch.note !== undefined
          ? { note: patch.note?.trim() ? patch.note.trim() : null }
          : {}),
        ...(patch.solutionStorageKey !== undefined
          ? { solutionStorageKey: patch.solutionStorageKey ?? null }
          : {}),
        ...(patch.solutionNote !== undefined
          ? {
              solutionNote: patch.solutionNote?.trim()
                ? patch.solutionNote.trim()
                : null,
            }
          : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
      });
      if (!updated) throw new NotFoundError({ reason: "notebook_entry_missing" });
      return updated;
    });
    const [dto] = await this.toEntryDtos([row]);
    return dto!;
  }

  /**
   * Link an entry to the forum thread the user just asked it in.
   *
   * Coaching does not create the thread — the client posts it through the forum's own API and hands
   * back the id. A coaching service calling into forum would be the cross-context call the module
   * rules forbid, and forum already owns every rule about what a question may contain.
   *
   * The thread id is not verified to exist: doing so would require exactly that call. A wrong id
   * degrades to a link that goes nowhere, which is a dead link and not a data leak — the id names
   * a public thread, and nothing about this entry is exposed by it.
   */
  async linkCommunityThread(
    userId: string,
    entryId: string,
    threadId: string,
  ): Promise<NotebookEntryDto> {
    const row = await withUserContext(this.db, { userId }, async (tx) => {
      const linked = await this.notebook.linkThread(tx, userId, entryId, threadId);
      if (!linked) throw new NotFoundError({ reason: "notebook_entry_missing" });
      return linked;
    });
    const [dto] = await this.toEntryDtos([row]);
    return dto!;
  }

  /**
   * An answer was accepted on a thread somebody linked. Called by the forum-event listener, which
   * knows a thread but not whose notebook it belongs to — so this runs in SERVICE context.
   */
  async markCommunityAnswered(threadId: string, answeredAt: Date): Promise<number> {
    return withServiceContext(this.db, (tx) =>
      this.notebook.markThreadAnswered(tx, threadId, answeredAt),
    );
  }

  /** Answer "could you do it this time?" and let the ladder pick the next moment. */
  async reviewEntry(
    userId: string,
    entryId: string,
    solved: boolean,
  ): Promise<NotebookEntryDto> {
    const now = new Date();
    const row = await withUserContext(this.db, { userId }, async (tx) => {
      const existing = await this.notebook.findEntry(tx, userId, entryId);
      if (!existing) throw new NotFoundError({ reason: "notebook_entry_missing" });
      const outcome = advanceReview(existing.reviewCount, solved, now);
      const updated = await this.notebook.recordReview(
        tx,
        userId,
        entryId,
        outcome,
        now,
      );
      if (!updated) throw new NotFoundError({ reason: "notebook_entry_missing" });
      return updated;
    });
    const [dto] = await this.toEntryDtos([row]);
    this.events?.emit(
      CoachingEventTopic.NOTEBOOK_ENTRY_REVIEWED,
      new NotebookEntryReviewed(userId, now),
    );
    return dto!;
  }

  async listDue(userId: string): Promise<NotebookEntryDto[]> {
    const rows = await withUserContext(this.db, { userId }, (tx) =>
      this.notebook.listDueEntries(tx, userId, new Date(), DUE_LIMIT),
    );
    return this.toEntryDtos(rows);
  }

  /**
   * Remove an entry and its photo. The page documents that referenced it keep their item until the
   * client next saves that page — a dangling reference renders as nothing and repairs itself, which
   * is cheaper than rewriting every page on delete.
   */
  async deleteEntry(userId: string, entryId: string): Promise<void> {
    const removed = await withUserContext(this.db, { userId }, (tx) =>
      this.notebook.deleteEntry(tx, userId, entryId),
    );
    if (!removed) throw new NotFoundError({ reason: "notebook_entry_missing" });

    // Best-effort, outside the transaction: a deleted mistake must not keep living at a public R2
    // URL (KVKK), but a storage hiccup must not undo a delete that already landed.
    if (removed.storageKey) {
      try {
        await this.storage.deleteObject(removed.storageKey);
      } catch {
        this.logger.warn(
          `Notebook: could not delete object ${removed.storageKey} for user ${userId}`,
        );
      }
    }
  }

  async createUploadUrl(
    userId: string,
    contentType: (typeof NOTEBOOK_IMAGE_MIMES)[number],
  ): Promise<NotebookImageUploadUrlDto> {
    const key = `${NOTEBOOK_PREFIX}${userId}/${randomUUID()}.${EXTENSIONS[contentType]}`;
    const result = await this.storage.createUploadUrl({ key, contentType });
    return {
      uploadUrl: result.url,
      key: result.key,
      expiresAt: result.expiresAt,
      // Advisory: R2's presigned PUT does not enforce a size, so the client checks before
      // uploading and `createEntry` is the real gate on what ends up referenced.
      maxBytes: NOTEBOOK_IMAGE_MAX_BYTES,
    };
  }

  /**
   * Delete notebook photos no entry references.
   *
   * `deleteEntry` handles the visible leak; this one covers the invisible one — a user who uploads
   * a photo, then closes the sheet without saving the entry. Nothing references those objects, so
   * nothing will ever find them again, and they are personal data sitting at a public URL (KVKK).
   *
   * Bounded per run and grace-windowed, same as the board sweep: an object uploaded seconds ago
   * belongs to a card still being composed, and deleting it would break the save in progress.
   */
  async cleanupOrphanImages(): Promise<{ deleted: number }> {
    const candidates = await this.storage.listObjects(
      NOTEBOOK_PREFIX,
      NOTEBOOK_ORPHAN_SWEEP_BATCH,
    );
    if (candidates.length === 0) return { deleted: 0 };

    const cutoff = Date.now() - NOTEBOOK_ORPHAN_GRACE_MS;
    const referenced = new Set(
      await withServiceContext(this.db, (tx) =>
        this.notebook.listAllReferencedImageKeys(tx),
      ),
    );

    const orphans = candidates.filter(
      (object) =>
        !referenced.has(object.key) &&
        // Unknown age is treated as "too young": never delete on missing metadata.
        object.lastModified != null &&
        object.lastModified.getTime() < cutoff,
    );

    for (const orphan of orphans) {
      await this.storage.deleteObject(orphan.key); // best-effort; a missing object is a no-op
    }
    return { deleted: orphans.length };
  }

  /**
   * Labels are soft refs into the content taxonomy, so nothing at the database level stops a
   * request from inventing one. An invented slug would render as a raw slug in the UI and pollute
   * the weakness map with a subject that does not exist.
   */
  private async assertLabelsBelongToExam(
    examId: string,
    subjectRef: string | null | undefined,
    topicRef: string | null | undefined,
  ): Promise<void> {
    if (!subjectRef) {
      // A topic without its subject has nothing to hang from; the pair is set together or not set.
      if (topicRef) throw new ValidationFailedError({ reason: "topic_without_subject" });
      return;
    }
    const subjects = await this.content.getValidSubjectSlugsForExam(examId);
    if (!subjects.has(subjectRef)) {
      throw new ValidationFailedError({ reason: "unknown_subject_ref" });
    }
    if (!topicRef) return;
    const topics = await this.content.listExamTopicsByExamId(examId);
    const known = topics.some(
      (topic) => topic.subjectSlug === subjectRef && topic.slug === topicRef,
    );
    if (!known) throw new ValidationFailedError({ reason: "unknown_topic_ref" });
  }

  /**
   * Rows → DTOs, resolving slugs to display names and keys to URLs.
   *
   * Taxonomy is fetched once per exam present in the batch rather than per row: a page of twelve
   * entries is almost always one exam, and per-row lookups would turn a page render into twelve
   * round-trips.
   */
  private async toEntryDtos(
    rows: MistakeNotebookEntryRow[],
  ): Promise<NotebookEntryDto[]> {
    if (rows.length === 0) return [];
    const examIds = [...new Set(rows.map((row) => row.examId))];
    const taxonomies = new Map(
      await Promise.all(
        examIds.map(
          async (examId) =>
            [
              examId,
              {
                subjects: await this.content.listExamSubjectsByExamId(examId),
                topics: await this.content.listExamTopicsByExamId(examId),
              },
            ] as const,
        ),
      ),
    );

    return rows.map((row) => {
      const taxonomy = taxonomies.get(row.examId);
      const subject = row.subjectRef
        ? taxonomy?.subjects.find((item) => item.slug === row.subjectRef)
        : undefined;
      const topic =
        row.subjectRef && row.topicRef
          ? taxonomy?.topics.find(
              (item) =>
                item.subjectSlug === row.subjectRef && item.slug === row.topicRef,
            )
          : undefined;
      return {
        id: row.id,
        mockExamId: row.mockExamId,
        storageKey: row.storageKey,
        url: row.storageKey ? this.storage.getPublicUrl(row.storageKey) : null,
        subjectRef: row.subjectRef,
        subjectName: subject?.name ?? row.subjectRef,
        topicRef: row.topicRef,
        topicName: topic?.name ?? row.topicRef,
        errorType: row.errorType as NotebookEntryDto["errorType"],
        note: row.note,
        solutionStorageKey: row.solutionStorageKey,
        solutionUrl: row.solutionStorageKey
          ? this.storage.getPublicUrl(row.solutionStorageKey)
          : null,
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
    });
  }
}
