import { HttpStatus, Injectable } from "@nestjs/common";
import type { AdAnnouncementContext, AnnouncementAdReviewView, ExamType } from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ForumAnnouncementPageService } from "../../forum/application/forum-announcement-page.service";
import type { ThreadActor } from "../../forum/application/forum-thread.service";
import { AdQuestionReviewRepository } from "../infrastructure/ad-question-review.repository";

@Injectable()
export class AdsAnnouncementReviewService {
  constructor(private readonly repo: AdQuestionReviewRepository, private readonly pages: ForumAnnouncementPageService) {}
  async preview(threadId: string, actor: ThreadActor): Promise<AnnouncementAdReviewView> {
    const [snapshot, row] = await Promise.all([this.pages.getReviewSnapshot(actor, threadId), this.repo.find(threadId, "ANNOUNCEMENT")]);
    return { snapshot, approved: Boolean(snapshot && snapshot.contentRevision === row?.contentRevision),
      approval: row ? { contentRevision: row.contentRevision, reviewedBy: row.reviewedBy, reviewedAt: row.reviewedAt.toISOString() } : null };
  }
  async approve(threadId: string, actor: ThreadActor, expectedRevision: string) {
    const view = await this.preview(threadId, actor);
    if (!view.snapshot) throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (view.snapshot.contentRevision !== expectedRevision) throw new DomainError(ErrorCode.CONFLICT, HttpStatus.CONFLICT);
    await this.repo.approve(threadId, expectedRevision, actor.id, "ANNOUNCEMENT");
    return this.preview(threadId, actor);
  }
  async revoke(threadId: string) { await this.repo.revoke(threadId, "ANNOUNCEMENT"); }
  async resolve(actor: ThreadActor, context?: AdAnnouncementContext): Promise<{ verified: boolean; examType: ExamType | null }> {
    if (!context) return { verified: false, examType: null };
    try {
      const view = await this.preview(context.threadId, actor);
      return view.approved && view.snapshot?.contentRevision === context.contentRevision
        ? { verified: true, examType: view.snapshot.examType } : { verified: false, examType: null };
    } catch { return { verified: false, examType: null }; }
  }
}
