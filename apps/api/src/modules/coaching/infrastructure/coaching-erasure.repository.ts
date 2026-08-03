import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import {
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

      await tx
        .update(planTasks)
        .set({ title: ERASED_TASK_TITLE })
        .where(eq(planTasks.userId, userId));

      return { photoStorageKeys: photos.map((p) => p.storageKey) };
    });
  }
}
