import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  CoachingEventTopic,
  type MockExamCreated,
  type NotebookEntryReviewed,
  type PlanAdapted,
  type PlanTaskCreated,
  type StreakMilestone,
  type StudySessionCompleted,
  type VisionBoardSaved,
  type WeeklyReviewCompleted,
} from "../../coaching/domain/coaching.events";
import {
  ForumEventTopic,
  type AnswerAccepted,
  type CommentReplied,
  type HelpfulVoteAdded,
  type QuestionAnswered,
  type ThreadCommented,
  type ThreadPosted,
} from "../../forum/domain/forum.events";
import { AchievementService } from "./achievement.service";
import { SessionService } from "../../coaching/application/session.service";

@Injectable()
export class AchievementEventsListener {
  private readonly logger = new Logger(AchievementEventsListener.name);

  constructor(
    private readonly achievements: AchievementService,
    private readonly sessions: SessionService,
  ) {}

  @OnEvent(CoachingEventTopic.SESSION_COMPLETED)
  async onSessionCompleted(event: StudySessionCompleted): Promise<void> {
    await this.grant(event.userId, "first_step", event.startedAt);
    const returned = await this.sessions
      .qualifiesForReturnAchievement(event.userId, event.startedAt)
      .catch((error: unknown) => {
        this.logger.warn(`return evidence failed for ${event.userId}: ${String(error)}`);
        return false;
      });
    if (returned) {
      await this.grant(event.userId, "returned_to_path", event.startedAt);
    }
  }

  @OnEvent(CoachingEventTopic.STREAK_MILESTONE)
  async onStreakMilestone(event: StreakMilestone): Promise<void> {
    if (event.milestone === 7) await this.grant(event.userId, "rhythm_found");
    if (event.milestone === 30) await this.grant(event.userId, "rhythm_kept");
  }

  @OnEvent(CoachingEventTopic.PLAN_TASK_CREATED)
  onPlanCreated(event: PlanTaskCreated): Promise<void> {
    return this.grant(event.userId, "route_drawn", event.createdAt);
  }

  @OnEvent(CoachingEventTopic.PLAN_ADAPTED)
  onPlanAdapted(event: PlanAdapted): Promise<void> {
    return this.grant(event.userId, "route_renewed", event.adaptedAt);
  }

  @OnEvent(CoachingEventTopic.VISION_BOARD_SAVED)
  onVisionBoardSaved(event: VisionBoardSaved): Promise<void> {
    return this.grant(event.userId, "dream_space_created", event.savedAt);
  }

  @OnEvent(CoachingEventTopic.MOCK_EXAM_CREATED)
  onMockExamCreated(event: MockExamCreated): Promise<void> {
    return this.grant(event.userId, "starting_point_set", event.createdAt);
  }

  @OnEvent(CoachingEventTopic.NOTEBOOK_ENTRY_REVIEWED)
  onNotebookReviewed(event: NotebookEntryReviewed): Promise<void> {
    return this.grant(event.userId, "mistake_revisited", event.reviewedAt);
  }

  @OnEvent(CoachingEventTopic.WEEKLY_REVIEW_COMPLETED)
  onWeeklyReview(event: WeeklyReviewCompleted): Promise<void> {
    return this.grant(event.userId, "week_reflected", event.completedAt);
  }

  @OnEvent(ForumEventTopic.THREAD_POSTED)
  onThreadPosted(event: ThreadPosted): Promise<void> {
    return this.grant(event.authorId, "first_hello");
  }

  @OnEvent(ForumEventTopic.THREAD_COMMENTED)
  onThreadCommented(event: ThreadCommented): Promise<void> {
    return this.grant(event.actorId, "first_hello");
  }

  @OnEvent(ForumEventTopic.COMMENT_REPLIED)
  onCommentReplied(event: CommentReplied): Promise<void> {
    return this.grant(event.actorId, "first_hello");
  }

  @OnEvent(ForumEventTopic.QUESTION_ANSWERED)
  onQuestionAnswered(event: QuestionAnswered): Promise<void> {
    return this.grant(event.actorId, "first_hello");
  }

  @OnEvent(ForumEventTopic.HELPFUL_VOTE_ADDED)
  onHelpfulVote(event: HelpfulVoteAdded): Promise<void> {
    return this.grant(event.recipientId, "helped_someone");
  }

  @OnEvent(ForumEventTopic.ANSWER_ACCEPTED)
  onAnswerAccepted(event: AnswerAccepted): Promise<void> {
    return this.grant(event.answerAuthorId, "helped_someone");
  }

  private async grant(
    userId: string,
    achievementId: Parameters<AchievementService["award"]>[1],
    earnedAt = new Date(),
  ): Promise<void> {
    await this.achievements.award(userId, achievementId, earnedAt).catch((error: unknown) => {
      this.logger.warn(`achievement ${achievementId} failed for ${userId}: ${String(error)}`);
    });
  }
}
