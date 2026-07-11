import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import { CoachMessageRole, type CoachMessageDto, type Paginated } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { coachMessages } from "../../../database/schema";

type SourceChip = { title: string; slug: string; url: string };
type SuggestedTask = { title: string; subject: string | null };

type CoachMessageRow = typeof coachMessages.$inferSelect;

function toDto(row: CoachMessageRow): CoachMessageDto {
  const task = (row.suggestedTask as SuggestedTask | null) ?? null;
  return {
    id: row.id,
    role: row.role as CoachMessageRole,
    content: row.content,
    sources: (row.sources as SourceChip[] | null) ?? [],
    feedback: row.feedback ?? null,
    ...(task ? { suggestedTask: task } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Persisted coach chat history (W3, multi-turn). Single rolling conversation per user — no thread
 * table. All access runs in the user's RLS context (per-user behavioral data, §4 #6 / KVKK).
 */
@Injectable()
export class CoachMessageRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Persist one exchange (user message + coach reply) atomically after a successful LLM call.
   * Returns the user's total message count so the caller can decide whether to refresh the memory
   * profile (every N messages) without a second query.
   */
  async appendExchange(
    userId: string,
    userContent: string,
    coach: { content: string; model: string; sources: SourceChip[]; suggestedTask?: SuggestedTask },
  ): Promise<{ totalMessages: number }> {
    return withUserContext(this.db, { userId }, async (tx) => {
      await tx.insert(coachMessages).values({
        userId,
        role: CoachMessageRole.USER,
        content: userContent,
      });
      await tx.insert(coachMessages).values({
        userId,
        role: CoachMessageRole.COACH,
        content: coach.content,
        sources: coach.sources,
        model: coach.model,
        suggestedTask: coach.suggestedTask ?? null,
      });
      const totals = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(coachMessages)
        .where(eq(coachMessages.userId, userId));
      return { totalMessages: totals[0]?.n ?? 0 };
    });
  }

  /** Set 👍/👎/none on the user's own COACH message. Returns false when no such row (wrong id/role/owner). */
  async setFeedback(userId: string, messageId: string, feedback: number | null): Promise<boolean> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const updated = await tx
        .update(coachMessages)
        .set({ feedback })
        .where(
          and(
            eq(coachMessages.id, messageId),
            eq(coachMessages.userId, userId),
            eq(coachMessages.role, CoachMessageRole.COACH),
          ),
        )
        .returning({ id: coachMessages.id });
      return updated.length > 0;
    });
  }

  /** Last `n` messages in chronological order — the multi-turn prompt window. */
  async lastN(userId: string, n: number): Promise<CoachMessageDto[]> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const rows = await tx
        .select()
        .from(coachMessages)
        .where(eq(coachMessages.userId, userId))
        .orderBy(desc(coachMessages.createdAt), desc(coachMessages.id))
        .limit(n);
      return rows.reverse().map(toDto);
    });
  }

  /** Paginated history, newest-first (mock-exam/mood list pattern). */
  async listPaged(userId: string, page: number, pageSize: number): Promise<Paginated<CoachMessageDto>> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const [rows, totals] = await Promise.all([
        tx
          .select()
          .from(coachMessages)
          .where(eq(coachMessages.userId, userId))
          .orderBy(desc(coachMessages.createdAt), desc(coachMessages.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        tx
          .select({ n: sql<number>`count(*)::int` })
          .from(coachMessages)
          .where(eq(coachMessages.userId, userId)),
      ]);
      return { items: rows.map(toDto), page, pageSize, total: totals[0]?.n ?? 0 };
    });
  }

  /** "Yeni sohbet" — clears the user's own rolling conversation. */
  async clearAll(userId: string): Promise<void> {
    await withUserContext(this.db, { userId }, async (tx) => {
      await tx.delete(coachMessages).where(eq(coachMessages.userId, userId));
    });
  }
}
