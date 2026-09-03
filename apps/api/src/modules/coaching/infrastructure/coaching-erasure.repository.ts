import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import {
  mistakeNotebookEntries,
  notebooks,
  mockExamPhotoCategorizations,
  mockExams,
  moodCheckins,
  planTasks,
  preferenceScenarios,
  studySessions,
  visionBoards,
} from "../../../database/schema";
import { acquireUserPlanLock } from "./plan-task.repository";

/** `plan_tasks.title` is NOT NULL — scrubbed to a neutral placeholder rather than nulled. */
export const ERASED_TASK_TITLE = "Silinmiş görev";

/**
 * Storage keys of the photos inside a vision-board document. Defensive rather than typed: this
 * runs on rows written by older versions of the app, and an erasure must not throw because one
 * user's board predates a shape change — a key we fail to read is an object we never delete.
 */
function visionBoardImageKeys(board: unknown): string[] {
  const items = (board as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    const key = (item as { kind?: unknown; storageKey?: unknown })?.storageKey;
    return typeof key === "string" && key.length > 0 ? [key] : [];
  });
}

/**
 * KVKK erasure for coaching (W2). One SERVICE-ctx transaction so the scrub is atomic.
 *
 * Erased: everything the user typed or the AI wrote about them (mood/session notes, vision board,
 * task titles, ghost narration, uploaded question photos).
 * KEPT: the numbers (mock-exam nets, session durations, streak, activity) — no free text, still useful
 * as aggregate signal after the account is anonymized.
 *
 * Returns the photo storage keys so the caller can delete the objects (best-effort, outside the tx).
 */
@Injectable()
export class CoachingErasureRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async eraseUserData(userId: string): Promise<{ photoStorageKeys: string[] }> {
    return withServiceContext(this.db, async (tx) => {
      await acquireUserPlanLock(tx, userId);
      // Collect the photo objects before dropping their rows.
      const photos = await tx
        .select({ storageKey: mockExamPhotoCategorizations.storageKey })
        .from(mockExamPhotoCategorizations)
        .where(eq(mockExamPhotoCategorizations.userId, userId));

      await tx
        .delete(mockExamPhotoCategorizations)
        .where(eq(mockExamPhotoCategorizations.userId, userId));

      // Same for the vision board's collage photos: they are only ever named from inside the
      // jsonb document, so once the row is gone nothing can find the objects again. Read them
      // out first or they stay at a public R2 URL forever.
      const boards = await tx
        .select({ board: visionBoards.board })
        .from(visionBoards)
        .where(eq(visionBoards.userId, userId));
      const boardImageKeys = boards.flatMap((row) =>
        visionBoardImageKeys(row.board),
      );

      // Mistake notebook: the entries hold the user's own confessions about what they get wrong,
      // and the photos are of exam questions they were sitting with. Wholly personal — nothing
      // here has aggregate value worth keeping, so both tables go. The keys are columns rather
      // than jsonb, so unlike the board this needs no defensive unfolding.
      const notebookPhotos = await tx
        .select({
          storageKey: mistakeNotebookEntries.storageKey,
          solutionStorageKey: mistakeNotebookEntries.solutionStorageKey,
        })
        .from(mistakeNotebookEntries)
        .where(eq(mistakeNotebookEntries.userId, userId));
      const notebookImageKeys = notebookPhotos.flatMap((row) =>
        [row.storageKey, row.solutionStorageKey].filter(
          (key): key is string => key !== null,
        ),
      );
      await tx
        .delete(mistakeNotebookEntries)
        .where(eq(mistakeNotebookEntries.userId, userId));
      // Pages cascade from the collection root.
      await tx.delete(notebooks).where(eq(notebooks.userId, userId));

      // Wholly personal — drop the row.
      await tx.delete(visionBoards).where(eq(visionBoards.userId, userId));
      await tx
        .delete(preferenceScenarios)
        .where(eq(preferenceScenarios.userId, userId));

      // Rows with analytic value — scrub only the free text / AI narration.
      await tx
        .update(moodCheckins)
        .set({ struggleNote: null, aiReflection: null })
        .where(eq(moodCheckins.userId, userId));

      await tx
        .update(studySessions)
        .set({ struggleNote: null, aiReflection: null })
        .where(eq(studySessions.userId, userId));

      await tx
        .update(mockExams)
        .set({ aiGhostNarration: null })
        .where(eq(mockExams.userId, userId));

      // `coachNote` goes too: it is a coach's instruction written FOR this person, so it cannot
      // outlive them any more than the title can.
      await tx
        .update(planTasks)
        .set({ title: ERASED_TASK_TITLE, coachNote: null, description: null })
        .where(eq(planTasks.userId, userId));

      return {
        photoStorageKeys: [
          ...photos.map((p) => p.storageKey),
          ...boardImageKeys,
          ...notebookImageKeys,
        ],
      };
    });
  }
}
