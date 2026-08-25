import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type {
  CreateNotebookInput,
  NotebookDto,
  NotebookEntryDto,
  NotebookImageUploadUrlDto,
  NotebookKind,
  Paginated,
  NotebookOverviewDto,
  NotebookPageDoc,
  NotebookPageDto,
  NotebookSummaryDto,
  UpdateNotebookInput,
} from "@mentor/types";
import {
  NOTEBOOK_IMAGE_MAX_BYTES,
  NOTEBOOK_IMAGE_MIMES,
  type ListNotebooksQuery,
  notebookPageIndexSchema,
  type CreateNotebookEntryInput,
  type ListNotebookEntriesQuery,
  type NotebookPageDocInput,
  type UpdateNotebookEntryInput,
} from "@mentor/validation";
import {
  ForbiddenError,
  NotFoundError,
  ValidationFailedError,
} from "../../../common/errors/domain-error";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import {
  STORAGE_PORT,
  type StoragePort,
} from "../../../shared/ports/storage.port";
import { ContentService } from "../../content/application/content.service";
import { advanceReview, firstReviewAt } from "../domain/notebook-review.policy";
import {
  CoachingEventTopic,
  NotebookEntryReviewed,
} from "../domain/coaching.events";
import {
  MistakeNotebookRepository,
  type MistakeNotebookEntryRow,
  type NotebookSummaryRow,
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

  async listNotebooks(
    actor: { userId: string; orgId: string | null },
    query: ListNotebooksQuery,
  ): Promise<Paginated<NotebookSummaryDto>> {
    const result = await withUserContext(
      this.db,
      { userId: actor.userId },
      async (tx) => {
        await this.notebook.ensureMistakeNotebook(
          tx,
          actor.userId,
          actor.orgId,
        );
        return this.notebook.listNotebooks(tx, actor.userId, query, new Date());
      },
    );
    return {
      items: await this.toNotebookDtos(result.items),
      total: result.total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async createNotebook(
    actor: { userId: string; orgId: string | null },
    input: CreateNotebookInput,
  ): Promise<NotebookDto> {
    await this.assertNotebookSubject(
      input.examId ?? null,
      input.subjectRef ?? null,
    );
    const row = await withUserContext(this.db, { userId: actor.userId }, (tx) =>
      this.notebook.createNotebook(tx, actor.userId, actor.orgId, {
        examId: input.examId ?? null,
        subjectRef: input.subjectRef ?? null,
        title: input.title.trim(),
        coverColor: input.cover.color,
        coverMaterial: input.cover.material,
      }),
    );
    return this.toNotebookDto(row);
  }

  async getNotebook(userId: string, notebookId: string): Promise<NotebookDto> {
    const row = await withUserContext(this.db, { userId }, (tx) =>
      this.notebook.findNotebook(tx, userId, notebookId),
    );
    if (!row) throw new NotFoundError({ reason: "notebook_missing" });
    return this.toNotebookDto(row);
  }

  async updateNotebook(
    userId: string,
    notebookId: string,
    input: UpdateNotebookInput,
  ): Promise<NotebookDto> {
    const row = await withUserContext(this.db, { userId }, async (tx) => {
      const current = await this.notebook.findNotebook(tx, userId, notebookId);
      if (!current) throw new NotFoundError({ reason: "notebook_missing" });
      if (current.kind === "CUSTOM" && input.title === null) {
        throw new ValidationFailedError({
          reason: "custom_notebook_title_required",
        });
      }
      if (
        current.kind === "MISTAKE" &&
        (input.examId !== undefined || input.subjectRef !== undefined)
      ) {
        throw new ForbiddenError({ reason: "system_notebook_scope_protected" });
      }

      const examId = input.examId === undefined ? current.examId : input.examId;
      const subjectRef =
        input.subjectRef === undefined ? current.subjectRef : input.subjectRef;
      await this.assertNotebookSubject(examId, subjectRef);
      return this.notebook.updateNotebook(tx, userId, notebookId, {
        ...(input.title === undefined
          ? {}
          : { title: input.title === null ? null : input.title.trim() }),
        ...(input.examId === undefined ? {} : { examId: input.examId }),
        ...(input.subjectRef === undefined
          ? {}
          : { subjectRef: input.subjectRef }),
        ...(input.cover
          ? {
              coverColor: input.cover.color,
              coverMaterial: input.cover.material,
            }
          : {}),
      });
    });
    if (!row) throw new NotFoundError({ reason: "notebook_missing" });
    return this.toNotebookDto(row);
  }

  async deleteNotebook(userId: string, notebookId: string): Promise<void> {
    await withUserContext(this.db, { userId }, async (tx) => {
      const current = await this.notebook.findNotebook(tx, userId, notebookId);
      if (!current) throw new NotFoundError({ reason: "notebook_missing" });
      if (current.kind === "MISTAKE") {
        throw new ForbiddenError({ reason: "system_notebook_protected" });
      }
      await this.notebook.deleteNotebook(tx, userId, notebookId);
    });
  }

  async getOverview(userId: string): Promise<NotebookOverviewDto> {
    const now = new Date();
    const { counts, notebook } = await withUserContext(
      this.db,
      { userId },
      async (tx) => {
        const system = await this.notebook.ensureMistakeNotebook(
          tx,
          userId,
          null,
        );
        return {
          counts: await this.notebook.countsFor(tx, userId, now, system.id),
          notebook: await this.notebook.findNotebook(tx, userId, system.id),
        };
      },
    );
    const metadata = await this.toNotebookDto(notebook!);
    return {
      ...counts,
      notebook: {
        ...metadata,
        pageCount: counts.pageCount,
        dueCount: counts.dueCount,
      },
    };
  }

  /**
   * One page, with only the entries it actually shows.
   *
   * A page the user has not saved yet is returned as an empty document rather than a 404: turning
   * to a blank page is a normal thing to do in a notebook, and making the client special-case
   * "does this page exist" would put the book's structure in two places.
   */
  async getPage(userId: string, pageIndex: number): Promise<NotebookPageDto> {
    const system = await withUserContext(this.db, { userId }, (tx) =>
      this.notebook.ensureMistakeNotebook(tx, userId, null),
    );
    return this.getNotebookPage(userId, system.id, pageIndex);
  }

  async getNotebookPage(
    userId: string,
    notebookId: string,
    pageIndex: number,
  ): Promise<NotebookPageDto> {
    assertPageIndex(pageIndex);
    const { doc, entries } = await withUserContext(
      this.db,
      { userId },
      async (tx) => {
        const book = await this.notebook.findNotebook(tx, userId, notebookId);
        if (!book) throw new NotFoundError({ reason: "notebook_missing" });
        const row = await this.notebook.findPage(
          tx,
          userId,
          notebookId,
          pageIndex,
        );
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
    const system = await withUserContext(this.db, { userId }, (tx) =>
      this.notebook.ensureMistakeNotebook(tx, userId, null),
    );
    return this.putNotebookPage(userId, system.id, pageIndex, doc);
  }

  async putNotebookPage(
    userId: string,
    notebookId: string,
    pageIndex: number,
    doc: NotebookPageDocInput,
  ): Promise<NotebookPageDto> {
    assertPageIndex(pageIndex);
    const entryIds = doc.items.flatMap((item) =>
      item.kind === "entry" ? [item.entryId] : [],
    );

    const entries = await withUserContext(this.db, { userId }, async (tx) => {
      const book = await this.notebook.findNotebook(tx, userId, notebookId);
      if (!book) throw new NotFoundError({ reason: "notebook_missing" });
      if (book.kind === "CUSTOM" && entryIds.length > 0) {
        throw new ValidationFailedError({
          reason: "custom_notebook_entry_forbidden",
        });
      }
      const owned = await this.notebook.listEntriesByIds(tx, userId, entryIds);
      if (owned.length !== entryIds.length) {
        throw new ValidationFailedError({ reason: "unknown_entry_ref" });
      }
      await this.notebook.upsertPage(tx, userId, notebookId, pageIndex, doc);
      return owned;
    });

    return {
      pageIndex,
      doc: doc as NotebookPageDoc,
      entries: await this.toEntryDtos(entries),
    };
  }

  private async assertNotebookSubject(
    examId: string | null,
    subjectRef: string | null,
  ): Promise<void> {
    if (!subjectRef) return;
    if (!examId)
      throw new ValidationFailedError({ reason: "subject_requires_exam" });
    const subjects = await this.content.getValidSubjectSlugsForExam(examId);
    if (!subjects.has(subjectRef)) {
      throw new ValidationFailedError({ reason: "unknown_subject_ref" });
    }
  }

  private async toNotebookDtos(
    rows: NotebookSummaryRow[],
  ): Promise<NotebookSummaryDto[]> {
    return Promise.all(rows.map((row) => this.toNotebookDto(row)));
  }

  private async toNotebookDto(row: NotebookSummaryRow): Promise<NotebookDto> {
    const subjects = row.examId
      ? await this.content.listExamSubjectsByExamId(row.examId)
      : [];
    return {
      id: row.id,
      kind: row.kind as NotebookKind,
      examId: row.examId,
      subjectRef: row.subjectRef,
      subjectName:
        subjects.find((subject) => subject.slug === row.subjectRef)?.name ??
        null,
      title: row.title,
      cover: {
        color: row.coverColor as NotebookDto["cover"]["color"],
        material: row.coverMaterial as NotebookDto["cover"]["material"],
      },
      pageCount: row.pageCount,
      dueCount: row.dueCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
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
  private assertOwnStorageKey(
    userId: string,
    key: string | null | undefined,
  ): void {
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
    await this.assertLabelsBelongToExam(
      input.examId,
      input.subjectRef,
      input.topicRef,
    );

    const row = await withUserContext(this.db, { userId }, async (tx) => {
      await this.notebook.ensureMistakeNotebook(tx, userId, null);
      return this.notebook.createEntry(tx, userId, {
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
      });
    });
    const [dto] = await this.toEntryDtos([row]);
    return dto!;
  }

  /**
   * The notebook's index — every entry, newest first, regardless of whether it sits on a page.
   *
   * The book shows what has been arranged and the deck shows what is due; an entry taken off a page
   * (or never placed, because the page was full) fell through both. This is the screen that can
   * reach it, which also makes it the screen from which it can finally be corrected or deleted.
   */
  async listEntries(
    userId: string,
    query: ListNotebookEntriesQuery,
  ): Promise<Paginated<NotebookEntryDto>> {
    const { items, total } = await withUserContext(this.db, { userId }, (tx) =>
      this.notebook.listEntries(tx, userId, query),
    );
    return {
      items: await this.toEntryDtos(items),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async updateEntry(
    userId: string,
    entryId: string,
    patch: UpdateNotebookEntryInput,
  ): Promise<NotebookEntryDto> {
    const row = await withUserContext(this.db, { userId }, async (tx) => {
      const existing = await this.notebook.findEntry(tx, userId, entryId);
      if (!existing)
        throw new NotFoundError({ reason: "notebook_entry_missing" });

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
        ...(patch.subjectRef !== undefined
          ? { subjectRef: patch.subjectRef ?? null }
          : {}),
        ...(patch.topicRef !== undefined
          ? { topicRef: patch.topicRef ?? null }
          : {}),
        ...(patch.errorType !== undefined
          ? { errorType: patch.errorType }
          : {}),
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
        ...(patch.status !== undefined && patch.status !== existing.status
          ? {
              status: patch.status,
              /*
               * Status and schedule move together, or neither means anything.
               *
               * The write schema has always accepted this field and the service has always written
               * it straight through, leaving `nextReviewAt` alone — so archiving a card left it in
               * the due scan (which reads the date, never the status) and reactivating a healed one
               * left it with no date at all, quietly doing nothing. The DTO's own comment promised
               * the opposite. This is that promise, kept.
               *
               * Coming back starts the ladder over rather than resuming it: the ladder's whole
               * premise is uninterrupted spacing, and a card that sat outside the rotation for an
               * unknown stretch has none. A student re-adding a healed card is saying they no
               * longer trust it — with the count left at three, their first correct answer would
               * heal it again on the spot.
               */
              ...(patch.status === "ARCHIVED"
                ? { nextReviewAt: null }
                : { nextReviewAt: firstReviewAt(), reviewCount: 0 }),
            }
          : {}),
      });
      if (!updated)
        throw new NotFoundError({ reason: "notebook_entry_missing" });
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
      const linked = await this.notebook.linkThread(
        tx,
        userId,
        entryId,
        threadId,
      );
      if (!linked)
        throw new NotFoundError({ reason: "notebook_entry_missing" });
      return linked;
    });
    const [dto] = await this.toEntryDtos([row]);
    return dto!;
  }

  /**
   * An answer was accepted on a thread somebody linked. Called by the forum-event listener, which
   * knows a thread but not whose notebook it belongs to — so this runs in SERVICE context.
   */
  async markCommunityAnswered(
    threadId: string,
    answeredAt: Date,
  ): Promise<number> {
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
      if (!existing)
        throw new NotFoundError({ reason: "notebook_entry_missing" });
      // The card's own due date decides whether this is a scheduled review or an early one; the
      // client never says which, so it cannot claim a promotion it did not wait for.
      const outcome = advanceReview({
        reviewCount: existing.reviewCount,
        solved,
        dueAt: existing.nextReviewAt,
        status: existing.status as "ACTIVE" | "HEALED" | "ARCHIVED",
        now,
      });
      const updated = await this.notebook.recordReview(
        tx,
        userId,
        entryId,
        outcome,
        now,
      );
      if (!updated)
        throw new NotFoundError({ reason: "notebook_entry_missing" });
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
      if (topicRef)
        throw new ValidationFailedError({ reason: "topic_without_subject" });
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
    if (!known)
      throw new ValidationFailedError({ reason: "unknown_topic_ref" });
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
                item.subjectSlug === row.subjectRef &&
                item.slug === row.topicRef,
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
