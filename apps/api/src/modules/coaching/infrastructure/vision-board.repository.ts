import { Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import { visionBoards } from "../../../database/schema";

export type VisionBoardRow = typeof visionBoards.$inferSelect;

export interface VisionInput {
  goalTitle: string;
  targetCity: string | null;
  motivation: string | null;
}

/** Data access for `vision_boards` (one per user; upsert on the unique (user_id) index). */
@Injectable()
export class VisionBoardRepository {
  /**
   * Upsert the user's single vision board. The cached premium AI note is invalidated ONLY when the
   * goal/city/motivation actually changes — re-saving identical content (or a panel reload) keeps the
   * existing note, so it never triggers a fresh LLM call (cost control, §7). `IS NOT DISTINCT FROM`
   * is NULL-safe for the optional fields.
   */
  async upsert(tx: DatabaseTx, userId: string, input: VisionInput): Promise<VisionBoardRow> {
    const unchanged = sql`${visionBoards.goalTitle} = ${input.goalTitle} AND ${visionBoards.targetCity} IS NOT DISTINCT FROM ${input.targetCity} AND ${visionBoards.motivation} IS NOT DISTINCT FROM ${input.motivation}`;
    const rows = await tx
      .insert(visionBoards)
      .values({
        userId,
        goalTitle: input.goalTitle,
        targetCity: input.targetCity,
        motivation: input.motivation,
      })
      .onConflictDoUpdate({
        target: [visionBoards.userId],
        set: {
          goalTitle: input.goalTitle,
          targetCity: input.targetCity,
          motivation: input.motivation,
          updatedAt: sql`now()`,
          aiNote: sql`CASE WHEN ${unchanged} THEN ${visionBoards.aiNote} ELSE NULL END`,
          aiModel: sql`CASE WHEN ${unchanged} THEN ${visionBoards.aiModel} ELSE NULL END`,
          aiLocale: sql`CASE WHEN ${unchanged} THEN ${visionBoards.aiLocale} ELSE NULL END`,
          aiNoteAt: sql`CASE WHEN ${unchanged} THEN ${visionBoards.aiNoteAt} ELSE NULL END`,
        },
      })
      .returning();
    return rows[0]!;
  }

  /** Cache the premium AI motivation note in place (idempotent; tx owns RLS). */
  async setAiNote(
    tx: DatabaseTx,
    userId: string,
    note: string,
    model: string,
    locale: string,
  ): Promise<void> {
    await tx
      .update(visionBoards)
      .set({ aiNote: note, aiModel: model, aiLocale: locale, aiNoteAt: new Date() })
      .where(eq(visionBoards.userId, userId));
  }

  async findByUser(tx: DatabaseTx, userId: string): Promise<VisionBoardRow | undefined> {
    const rows = await tx
      .select()
      .from(visionBoards)
      .where(eq(visionBoards.userId, userId))
      .limit(1);
    return rows[0];
  }
}
