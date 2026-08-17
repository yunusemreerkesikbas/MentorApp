import { HttpStatus, Injectable } from "@nestjs/common";
import type { ForumPollView } from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { calculatePollPercentages } from "../domain/forum-poll";
import {
  ForumPollRepository,
  type ForumPollAggregateRow,
} from "../infrastructure/forum-poll.repository";

@Injectable()
export class ForumPollService {
  constructor(private readonly polls: ForumPollRepository) {}

  async viewsForThreads(
    threadIds: string[],
    viewerId: string,
    now = new Date(),
  ): Promise<Map<string, ForumPollView>> {
    const rows = await this.polls.listByThreadIds(threadIds, viewerId);
    return new Map(rows.map((row) => [row.threadId, this.toView(row, now)]));
  }

  async vote(viewerId: string, pollId: string, optionId: string): Promise<ForumPollView> {
    const result = await this.polls.vote(pollId, optionId, viewerId);
    if (result !== "CREATED") {
      const errors = {
        POLL_NOT_FOUND: [ErrorCode.FORUM_POLL_NOT_FOUND, HttpStatus.NOT_FOUND],
        OPTION_INVALID: [ErrorCode.FORUM_POLL_OPTION_INVALID, HttpStatus.BAD_REQUEST],
        CLOSED: [ErrorCode.FORUM_POLL_CLOSED, HttpStatus.CONFLICT],
        ALREADY_VOTED: [ErrorCode.FORUM_POLL_ALREADY_VOTED, HttpStatus.CONFLICT],
      } as const;
      const [code, status] = errors[result];
      throw new DomainError(code, status);
    }
    const row = await this.polls.findById(pollId, viewerId);
    if (!row) throw new DomainError(ErrorCode.FORUM_POLL_NOT_FOUND, HttpStatus.NOT_FOUND);
    return this.toView(row, new Date());
  }

  private toView(row: ForumPollAggregateRow, now: Date): ForumPollView {
    const closed = row.endsAt.getTime() <= now.getTime();
    const resultsVisible = closed || row.myOptionId !== null;
    const counts = row.options.map((option) => option.voteCount);
    const percentages = calculatePollPercentages(counts);
    return {
      id: row.id,
      endsAt: row.endsAt.toISOString(),
      status: closed ? "CLOSED" : "ACTIVE",
      canVote: !closed && row.myOptionId === null,
      resultsVisible,
      myOptionId: row.myOptionId,
      totalVoteCount: counts.reduce((sum, count) => sum + count, 0),
      options: row.options.map((option, index) => ({
        id: option.id,
        text: option.text,
        position: option.position,
        voteCount: resultsVisible ? option.voteCount : null,
        percentage: resultsVisible ? (percentages[index] ?? 0) : null,
      })),
    };
  }
}
