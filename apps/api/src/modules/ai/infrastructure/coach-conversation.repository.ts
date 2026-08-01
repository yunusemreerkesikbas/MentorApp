import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, exists, sql } from "drizzle-orm";
import type {
  CoachConversationDto,
  CoachConversationOriginDto,
  Paginated,
} from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { coachConversations, coachMessages } from "../../../database/schema";

/**
 * Coach chat threads (W3). One row per conversation; deleting one cascades its messages.
 * All access runs in the user's RLS context (per-user behavioral data, §4 #6 / KVKK).
 */
@Injectable()
export class CoachConversationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** True when the conversation exists and belongs to the user. */
  async isOwned(userId: string, conversationId: string): Promise<boolean> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const rows = await tx
        .select({ id: coachConversations.id })
        .from(coachConversations)
        .where(
          and(
            eq(coachConversations.id, conversationId),
            eq(coachConversations.userId, userId),
          ),
        )
        .limit(1);
      return rows.length > 0;
    });
  }

  /** Structural provenance for one owned conversation; null for legacy/non-bridge chats. */
  async getOrigin(
    userId: string,
    conversationId: string,
  ): Promise<CoachConversationOriginDto | null> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const [row] = await tx
        .select({
          originType: coachConversations.originType,
          originRefId: coachConversations.originRefId,
          originMeta: coachConversations.originMeta,
        })
        .from(coachConversations)
        .where(
          and(
            eq(coachConversations.id, conversationId),
            eq(coachConversations.userId, userId),
          ),
        )
        .limit(1);
      return this.toOrigin(row);
    });
  }

  /** Newest-active-first thread list with each thread's message count ("Son sohbetler"). */
  async listPaged(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<Paginated<CoachConversationDto>> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const messageCount = sql<number>`(
        select count(*)::int from ${coachMessages}
        where ${coachMessages.conversationId} = ${coachConversations.id}
      )`;
      const visible = and(
        eq(coachConversations.userId, userId),
        exists(
          tx
            .select({ id: coachMessages.id })
            .from(coachMessages)
            .where(
              eq(
                coachMessages.conversationId,
                coachConversations.id,
              ),
            ),
        ),
      );
      const [rows, totals] = await Promise.all([
        tx
          .select({
            id: coachConversations.id,
            title: coachConversations.title,
            lastMessageAt: coachConversations.lastMessageAt,
            messageCount,
            originType: coachConversations.originType,
            originRefId: coachConversations.originRefId,
            originMeta: coachConversations.originMeta,
          })
          .from(coachConversations)
          .where(visible)
          .orderBy(
            desc(coachConversations.lastMessageAt),
            desc(coachConversations.id),
          )
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        tx
          .select({ n: sql<number>`count(*)::int` })
          .from(coachConversations)
          .where(visible),
      ]);
      return {
        items: rows.map((row) => ({
          id: row.id,
          title: row.title,
          lastMessageAt: row.lastMessageAt.toISOString(),
          messageCount: row.messageCount,
          origin: this.toOrigin(row),
        })),
        page,
        pageSize,
        total: totals[0]?.n ?? 0,
      };
    });
  }

  private toOrigin(row: {
    originType: string | null;
    originRefId: string | null;
    originMeta: { intent: "PLAN" | "NEXT_STEP" | "STUDY_METHOD" | "STRATEGY"; tagSlug: string } | null;
  } | undefined): CoachConversationOriginDto | null {
    if (
      !row ||
      row.originType !== "COMMUNITY_THREAD" ||
      !row.originRefId ||
      !row.originMeta
    ) {
      return null;
    }
    return {
      type: "COMMUNITY_THREAD",
      refId: row.originRefId,
      meta: row.originMeta,
    };
  }

  /** KVKK erasure: drop ALL of a user's threads (their messages cascade). Idempotent. SERVICE ctx. */
  async deleteAllForUser(userId: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx
        .delete(coachConversations)
        .where(eq(coachConversations.userId, userId));
    });
  }

  /** Delete one thread (messages cascade). Returns false when it isn't the user's. */
  async delete(userId: string, conversationId: string): Promise<boolean> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const deleted = await tx
        .delete(coachConversations)
        .where(
          and(
            eq(coachConversations.id, conversationId),
            eq(coachConversations.userId, userId),
          ),
        )
        .returning({ id: coachConversations.id });
      return deleted.length > 0;
    });
  }
}
