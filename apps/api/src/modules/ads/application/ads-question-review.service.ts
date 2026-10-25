import { HttpStatus, Injectable } from "@nestjs/common";
import { ExamType, type AdQuestionContext, type AdQuestionReviewView } from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ForumPublicService } from "../../forum/application/forum-public.service";
import { AdQuestionReviewRepository } from "../infrastructure/ad-question-review.repository";

@Injectable()
export class AdsQuestionReviewService {
  constructor(private readonly repo: AdQuestionReviewRepository, private readonly forum: ForumPublicService) {}

  async preview(questionId: string): Promise<AdQuestionReviewView> {
    const [question, row] = await Promise.all([this.forum.getQuestion(questionId), this.repo.find(questionId)]);
    return {
      question,
      approval: row ? { contentRevision: row.contentRevision, reviewedAt: row.reviewedAt.toISOString(), reviewedBy: row.reviewedBy } : null,
      approved: Boolean(question?.contentRevision && question.contentRevision === row?.contentRevision),
    };
  }

  async approve(questionId: string, actorId: string, expectedRevision: string) {
    const question = await this.forum.getQuestion(questionId);
    if (!question?.contentRevision || !question.examType || !Object.values(ExamType).includes(question.examType)) {
      throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    if (question.contentRevision !== expectedRevision) throw new DomainError(ErrorCode.CONFLICT, HttpStatus.CONFLICT);
    await this.repo.approve(questionId, expectedRevision, actorId);
    return this.preview(questionId);
  }

  async revoke(questionId: string) { await this.repo.revoke(questionId); }

  async resolve(context?: AdQuestionContext): Promise<{ verified: boolean; examType: ExamType | null }> {
    const denied = { verified: false, examType: null } as const;
    if (!context) return denied;
    const view = await this.preview(context.questionId);
    const question = view.question;
    if (!view.approved || !question || question.contentRevision !== context.contentRevision ||
      !question.examType || !Object.values(ExamType).includes(question.examType)) return denied;
    return { verified: true, examType: question.examType };
  }
}
