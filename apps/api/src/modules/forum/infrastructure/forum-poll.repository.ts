import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import {
  forumPollOptions,
  forumPolls,
  forumPollVotes,
  forumThreads,
  forumZones,
} from "../../../database/schema";

export interface ForumPollAggregateRow {
  id: string;
  threadId: string;
  endsAt: Date;
  myOptionId: string | null;
  options: Array<{
    id: string;
    text: string;
    position: number;
    voteCount: number;
  }>;
}

export type ForumPollVoteResult =
  | "CREATED"
  | "POLL_NOT_FOUND"
  | "OPTION_INVALID"
  | "CLOSED"
  | "ALREADY_VOTED";

@Injectable()
export class ForumPollRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listByThreadIds(
    threadIds: string[],
    viewerId: string,
  ): Promise<ForumPollAggregateRow[]> {
    if (threadIds.length === 0) return [];
    return withServiceContext(this.db, async (tx) => {
      const polls = await tx
        .select({ id: forumPolls.id, threadId: forumPolls.threadId, endsAt: forumPolls.endsAt })
        .from(forumPolls)
        .where(inArray(forumPolls.threadId, threadIds));
      if (polls.length === 0) return [];
      const pollIds = polls.map((poll) => poll.id);
      const options = await tx
        .select({
          id: forumPollOptions.id,
          pollId: forumPollOptions.pollId,
          text: forumPollOptions.text,
          position: forumPollOptions.position,
          voteCount: sql<number>`count(${forumPollVotes.id})::int`,
        })
        .from(forumPollOptions)
        .leftJoin(forumPollVotes, eq(forumPollVotes.optionId, forumPollOptions.id))
        .where(inArray(forumPollOptions.pollId, pollIds))
        .groupBy(
          forumPollOptions.id,
          forumPollOptions.pollId,
          forumPollOptions.text,
          forumPollOptions.position,
        )
        .orderBy(asc(forumPollOptions.position));
      const mine = await tx
        .select({ pollId: forumPollVotes.pollId, optionId: forumPollVotes.optionId })
        .from(forumPollVotes)
        .where(and(inArray(forumPollVotes.pollId, pollIds), eq(forumPollVotes.userId, viewerId)));
      const myVoteByPoll = new Map(mine.map((vote) => [vote.pollId, vote.optionId]));
      const optionsByPoll = new Map<string, ForumPollAggregateRow["options"]>();
      for (const option of options) {
        const entries = optionsByPoll.get(option.pollId) ?? [];
        entries.push({
          id: option.id,
          text: option.text,
          position: option.position,
          voteCount: Number(option.voteCount),
        });
        optionsByPoll.set(option.pollId, entries);
      }
      return polls.map((poll) => ({
        ...poll,
        myOptionId: myVoteByPoll.get(poll.id) ?? null,
        options: optionsByPoll.get(poll.id) ?? [],
      }));
    });
  }

  async findById(pollId: string, viewerId: string): Promise<ForumPollAggregateRow | null> {
    const threadId = await this.visibleThreadId(pollId, viewerId);
    if (!threadId) return null;
    const rows = await this.listByThreadIds([threadId], viewerId);
    return rows[0] ?? null;
  }

  async vote(pollId: string, optionId: string, viewerId: string): Promise<ForumPollVoteResult> {
    const visible = await withUserContext(this.db, { userId: viewerId }, async (tx) => {
      const [row] = await tx
        .select({
          threadId: forumPolls.threadId,
          closed: sql<boolean>`${forumPolls.endsAt} <= now()`,
          optionValid: sql<boolean>`exists(
            select 1 from ${forumPollOptions}
            where ${forumPollOptions.pollId} = ${forumPolls.id}
              and ${forumPollOptions.id} = ${optionId}
          )`,
        })
        .from(forumPolls)
        .innerJoin(forumThreads, eq(forumThreads.id, forumPolls.threadId))
        .innerJoin(forumZones, eq(forumZones.id, forumThreads.zoneId))
        .where(and(eq(forumPolls.id, pollId), isNull(forumThreads.deletedAt)))
        .limit(1);
      return row ?? null;
    });
    if (!visible) return "POLL_NOT_FOUND";
    if (!visible.optionValid) return "OPTION_INVALID";
    if (visible.closed) return "CLOSED";

    return withServiceContext(this.db, async (tx) => {
      const inserted = await tx.execute<{ id: string }>(sql`
        insert into forum_poll_votes (poll_id, option_id, user_id)
        select ${pollId}::uuid, ${optionId}::uuid, ${viewerId}::uuid
        from forum_polls p
        where p.id = ${pollId}::uuid
          and p.ends_at > now()
          and exists (
            select 1 from forum_poll_options o
            where o.poll_id = p.id and o.id = ${optionId}::uuid
          )
        on conflict (poll_id, user_id) do nothing
        returning id
      `);
      if (inserted.rows.length > 0) return "CREATED";
      const [existing] = await tx
        .select({ id: forumPollVotes.id })
        .from(forumPollVotes)
        .where(and(eq(forumPollVotes.pollId, pollId), eq(forumPollVotes.userId, viewerId)))
        .limit(1);
      if (existing) return "ALREADY_VOTED";
      const [poll] = await tx
        .select({ closed: sql<boolean>`${forumPolls.endsAt} <= now()` })
        .from(forumPolls)
        .where(eq(forumPolls.id, pollId))
        .limit(1);
      return poll?.closed ? "CLOSED" : "OPTION_INVALID";
    });
  }

  private async visibleThreadId(pollId: string, viewerId: string): Promise<string | null> {
    return withUserContext(this.db, { userId: viewerId }, async (tx) => {
      const [row] = await tx
        .select({ threadId: forumPolls.threadId })
        .from(forumPolls)
        .innerJoin(forumThreads, eq(forumThreads.id, forumPolls.threadId))
        .innerJoin(forumZones, eq(forumZones.id, forumThreads.zoneId))
        .where(and(eq(forumPolls.id, pollId), isNull(forumThreads.deletedAt)))
        .limit(1);
      return row?.threadId ?? null;
    });
  }
}
